/**
 * WebSocket Message Handlers
 * Handles WebSocket message routing and entity update broadcasting
 */

import { WebSocketMessage } from "./server";
import { logger } from "../logging/logger";

/**
 * Broadcast entity update to subscribed clients
 */
export function broadcastEntityUpdate(
  subscriptions: Map<string, string[]>,
  entityType: string,
  entityId: string,
  update: {
    action: string;
    data?: any;
  },
  sendToClient: (clientId: string, message: WebSocketMessage) => void
): void {
  const key = `${entityType}:${entityId}`;
  const clientIds = subscriptions.get(key) || [];

  if (clientIds.length === 0) {
    logger.debug("No subscribers for entity update", { entityType, entityId });
    return;
  }

  const message: WebSocketMessage = {
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
    } catch (error) {
      logger.error("Failed to send entity update to client", { error, clientId });
    }
  }

  logger.info("Entity update broadcasted", {
    entityType,
    entityId,
    subscribers: clientIds.length,
    sent,
  });
}

/**
 * Handle WebSocket message routing
 */
export function handleWebSocketMessage(
  clientId: string,
  message: WebSocketMessage
): WebSocketMessage | null {
  logger.debug("WebSocket message received", { clientId, type: message.type });

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
      logger.warn("Unknown WebSocket message type", { type: message.type, clientId });
      return null;
  }
}
