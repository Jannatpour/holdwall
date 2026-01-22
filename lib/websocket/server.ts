/**
 * WebSocket Server
 * Real-time communication for live updates
 */

import { Server as HTTPServer } from "http";
import { WebSocketServer } from "ws";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
  correlationId?: string;
}

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, any> = new Map(); // clientId -> WebSocket
  private channelSubscriptions: Map<string, Set<string>> = new Map(); // channel -> Set<clientId>

  /**
   * Initialize WebSocket server
   */
  initialize(server: HTTPServer): void {
    this.wss = new WebSocketServer({ server, path: "/api/ws" });

    this.wss.on("connection", (ws, req) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);

      logger.info("WebSocket connection established", { clientId });

      // Send welcome message
      this.send(ws, {
        type: "connected",
        payload: { clientId },
        timestamp: Date.now(),
      });

      ws.on("message", async (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          const response = await this.handleMessage(clientId, message, { ws });
          if (response) {
            this.send(ws, response);
          }
        } catch (error) {
          logger.error("WebSocket message error", { error, clientId });
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
        
        logger.info("WebSocket connection closed", { clientId });
        metrics.increment("websocket_disconnections");
      });

      ws.on("error", (error) => {
        logger.error("WebSocket error", { error, clientId });
        metrics.increment("websocket_errors");
      });

      metrics.increment("websocket_connections");
    });
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message: WebSocketMessage): void {
    const serialized = JSON.stringify(message);
    let sent = 0;

    for (const [clientId, ws] of this.clients.entries()) {
      if (ws.readyState === 1) {
        // OPEN
        try {
          ws.send(serialized);
          sent++;
        } catch (error) {
          logger.error("WebSocket broadcast error", { error, clientId });
          this.clients.delete(clientId);
        }
      }
    }

    metrics.increment("websocket_broadcasts", undefined, sent);
  }

  /**
   * Broadcast message to clients subscribed to a specific channel
   */
  broadcastToChannel(channel: string, message: WebSocketMessage): void {
    const subscribers = this.channelSubscriptions.get(channel);
    if (!subscribers || subscribers.size === 0) {
      logger.debug("No subscribers for channel", { channel });
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
        } catch (error) {
          logger.error("WebSocket channel broadcast error", { error, clientId, channel });
          subscribers.delete(clientId);
          this.clients.delete(clientId);
        }
      } else {
        // Client disconnected, remove from subscriptions
        subscribers.delete(clientId);
      }
    }

    logger.info("Channel message broadcasted", { channel, subscribers: subscribers.size, sent });
    metrics.increment("websocket_channel_broadcasts", { channel }, sent);
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: WebSocketMessage): boolean {
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
  private send(ws: any, message: WebSocketMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error("WebSocket send error", { error });
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(
    clientId: string,
    message: WebSocketMessage,
    context?: { ws?: any }
  ): Promise<WebSocketMessage | null> {
    logger.info("WebSocket message received", { clientId, type: message.type });

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
          this.channelSubscriptions.get(channel)!.add(clientId);
        }

        // Subscribe to specific entity (via entity broadcaster)
        if (entityType && entityId) {
          const { entityBroadcaster } = await import("../events/entity-broadcaster");
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
          const { entityBroadcaster } = await import("../events/entity-broadcaster");
          entityBroadcaster.unsubscribe(clientId, unsubEntityType, unsubEntityId);
        }

        this.sendToClient(clientId, {
          type: "unsubscribed",
          payload: { channels: unsubChannels, entityType: unsubEntityType, entityId: unsubEntityId },
          timestamp: Date.now(),
        });
        break;

      default:
        logger.warn("Unknown WebSocket message type", { type: message.type, clientId });
        return null;
    }
    
    return null;
  }

  /**
   * Get connected clients count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close all connections
   */
  close(): void {
    for (const [clientId, ws] of this.clients.entries()) {
      try {
        ws.close();
      } catch (error) {
        logger.error("Error closing WebSocket", { error, clientId });
      }
    }
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}

export const wsManager = new WebSocketManager();
