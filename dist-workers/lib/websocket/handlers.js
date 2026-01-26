"use strict";
/**
 * WebSocket Message Handlers
 * Handles WebSocket message routing and entity update broadcasting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastEntityUpdate = broadcastEntityUpdate;
exports.handleWebSocketMessage = handleWebSocketMessage;
const logger_1 = require("../logging/logger");
/**
 * Broadcast entity update to subscribed clients
 */
function broadcastEntityUpdate(subscriptions, entityType, entityId, update, sendToClient) {
    const key = `${entityType}:${entityId}`;
    const clientIds = subscriptions.get(key) || [];
    if (clientIds.length === 0) {
        logger_1.logger.debug("No subscribers for entity update", { entityType, entityId });
        return;
    }
    const message = {
        type: "entity_update",
        payload: {
            entityType,
            entityId,
            action: update.action,
            data: update.data,
        },
        timestamp: Date.now(),
    };
    let sent = 0;
    for (const clientId of clientIds) {
        try {
            sendToClient(clientId, message);
            sent++;
        }
        catch (error) {
            logger_1.logger.error("Failed to send entity update to client", { error, clientId });
        }
    }
    logger_1.logger.info("Entity update broadcasted", {
        entityType,
        entityId,
        subscribers: clientIds.length,
        sent,
    });
}
/**
 * Handle WebSocket message routing
 */
function handleWebSocketMessage(clientId, message) {
    logger_1.logger.debug("WebSocket message received", { clientId, type: message.type });
    switch (message.type) {
        case "ping":
            return {
                type: "pong",
                payload: {},
                timestamp: Date.now(),
            };
        case "subscribe":
            // Subscription handling is done by WebSocketManager
            return {
                type: "subscribed",
                payload: { channels: message.payload.channels || [] },
                timestamp: Date.now(),
            };
        default:
            logger_1.logger.warn("Unknown WebSocket message type", { type: message.type, clientId });
            return null;
    }
}
