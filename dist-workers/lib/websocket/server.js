"use strict";
/**
 * WebSocket Server
 * Real-time communication for live updates
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsManager = exports.WebSocketManager = void 0;
const ws_1 = require("ws");
const logger_1 = require("@/lib/logging/logger");
const metrics_1 = require("@/lib/observability/metrics");
class WebSocketManager {
    constructor() {
        this.wss = null;
        this.clients = new Map(); // clientId -> WebSocket
        this.channelSubscriptions = new Map(); // channel -> Set<clientId>
    }
    /**
     * Initialize WebSocket server
     */
    initialize(server) {
        this.wss = new ws_1.WebSocketServer({ server, path: "/api/ws" });
        this.wss.on("connection", (ws, req) => {
            const clientId = this.generateClientId();
            this.clients.set(clientId, ws);
            logger_1.logger.info("WebSocket connection established", { clientId });
            // Send welcome message
            this.send(ws, {
                type: "connected",
                payload: { clientId },
                timestamp: Date.now(),
            });
            ws.on("message", async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    const response = await this.handleMessage(clientId, message, { ws });
                    if (response) {
                        this.send(ws, response);
                    }
                }
                catch (error) {
                    logger_1.logger.error("WebSocket message error", { error, clientId });
                    this.send(ws, {
                        type: "error",
                        payload: { message: "Invalid message format" },
                        timestamp: Date.now(),
                    });
                }
            });
            ws.on("close", () => {
                this.clients.delete(clientId);
                // Remove all channel subscriptions for this client
                for (const [channel, subscribers] of this.channelSubscriptions.entries()) {
                    subscribers.delete(clientId);
                    if (subscribers.size === 0) {
                        this.channelSubscriptions.delete(channel);
                    }
                }
                // Remove all entity subscriptions for this client
                const { entityBroadcaster } = require("../events/entity-broadcaster");
                entityBroadcaster.removeClient(clientId);
                logger_1.logger.info("WebSocket connection closed", { clientId });
                metrics_1.metrics.increment("websocket_disconnections");
            });
            ws.on("error", (error) => {
                logger_1.logger.error("WebSocket error", { error, clientId });
                metrics_1.metrics.increment("websocket_errors");
            });
            metrics_1.metrics.increment("websocket_connections");
        });
    }
    /**
     * Broadcast message to all clients
     */
    broadcast(message) {
        const serialized = JSON.stringify(message);
        let sent = 0;
        for (const [clientId, ws] of this.clients.entries()) {
            if (ws.readyState === 1) {
                // OPEN
                try {
                    ws.send(serialized);
                    sent++;
                }
                catch (error) {
                    logger_1.logger.error("WebSocket broadcast error", { error, clientId });
                    this.clients.delete(clientId);
                }
            }
        }
        metrics_1.metrics.increment("websocket_broadcasts", undefined, sent);
    }
    /**
     * Broadcast message to clients subscribed to a specific channel
     */
    broadcastToChannel(channel, message) {
        const subscribers = this.channelSubscriptions.get(channel);
        if (!subscribers || subscribers.size === 0) {
            logger_1.logger.debug("No subscribers for channel", { channel });
            return;
        }
        const serialized = JSON.stringify(message);
        let sent = 0;
        for (const clientId of subscribers) {
            const ws = this.clients.get(clientId);
            if (ws && ws.readyState === 1) {
                // OPEN
                try {
                    ws.send(serialized);
                    sent++;
                }
                catch (error) {
                    logger_1.logger.error("WebSocket channel broadcast error", { error, clientId, channel });
                    subscribers.delete(clientId);
                    this.clients.delete(clientId);
                }
            }
            else {
                // Client disconnected, remove from subscriptions
                subscribers.delete(clientId);
            }
        }
        logger_1.logger.info("Channel message broadcasted", { channel, subscribers: subscribers.size, sent });
        metrics_1.metrics.increment("websocket_channel_broadcasts", { channel }, sent);
    }
    /**
     * Send message to specific client
     */
    sendToClient(clientId, message) {
        const ws = this.clients.get(clientId);
        if (ws && ws.readyState === 1) {
            this.send(ws, message);
            return true;
        }
        return false;
    }
    /**
     * Send message to WebSocket
     */
    send(ws, message) {
        try {
            ws.send(JSON.stringify(message));
        }
        catch (error) {
            logger_1.logger.error("WebSocket send error", { error });
        }
    }
    /**
     * Handle incoming message
     */
    async handleMessage(clientId, message, context) {
        logger_1.logger.info("WebSocket message received", { clientId, type: message.type });
        switch (message.type) {
            case "ping":
                this.sendToClient(clientId, {
                    type: "pong",
                    payload: {},
                    timestamp: Date.now(),
                });
                break;
            case "subscribe":
                // Handle subscription to channels and entities
                const channels = message.payload.channels || [];
                const entityType = message.payload.entityType;
                const entityId = message.payload.entityId;
                // Subscribe to channels (e.g., "all-claims", "all-forecasts")
                for (const channel of channels) {
                    if (!this.channelSubscriptions.has(channel)) {
                        this.channelSubscriptions.set(channel, new Set());
                    }
                    this.channelSubscriptions.get(channel).add(clientId);
                }
                // Subscribe to specific entity (via entity broadcaster)
                if (entityType && entityId) {
                    const { entityBroadcaster } = await Promise.resolve().then(() => __importStar(require("../events/entity-broadcaster")));
                    entityBroadcaster.subscribe(clientId, entityType, entityId);
                }
                this.sendToClient(clientId, {
                    type: "subscribed",
                    payload: { channels, entityType, entityId },
                    timestamp: Date.now(),
                });
                break;
            case "unsubscribe":
                // Handle unsubscription from channels and entities
                const unsubChannels = message.payload.channels || [];
                const unsubEntityType = message.payload.entityType;
                const unsubEntityId = message.payload.entityId;
                // Unsubscribe from channels
                for (const channel of unsubChannels) {
                    const subscribers = this.channelSubscriptions.get(channel);
                    if (subscribers) {
                        subscribers.delete(clientId);
                        if (subscribers.size === 0) {
                            this.channelSubscriptions.delete(channel);
                        }
                    }
                }
                // Unsubscribe from specific entity
                if (unsubEntityType && unsubEntityId) {
                    const { entityBroadcaster } = await Promise.resolve().then(() => __importStar(require("../events/entity-broadcaster")));
                    entityBroadcaster.unsubscribe(clientId, unsubEntityType, unsubEntityId);
                }
                this.sendToClient(clientId, {
                    type: "unsubscribed",
                    payload: { channels: unsubChannels, entityType: unsubEntityType, entityId: unsubEntityId },
                    timestamp: Date.now(),
                });
                break;
            default:
                logger_1.logger.warn("Unknown WebSocket message type", { type: message.type, clientId });
                return null;
        }
        return null;
    }
    /**
     * Get connected clients count
     */
    getClientCount() {
        return this.clients.size;
    }
    /**
     * Generate unique client ID
     */
    generateClientId() {
        return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Close all connections
     */
    close() {
        for (const [clientId, ws] of this.clients.entries()) {
            try {
                ws.close();
            }
            catch (error) {
                logger_1.logger.error("Error closing WebSocket", { error, clientId });
            }
        }
        this.clients.clear();
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }
    }
}
exports.WebSocketManager = WebSocketManager;
exports.wsManager = new WebSocketManager();
