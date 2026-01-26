"use strict";
/**
 * Entity Update Broadcaster
 * Broadcasts entity updates to subscribed WebSocket clients
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.entityBroadcaster = exports.EntityBroadcaster = void 0;
const handlers_1 = require("../websocket/handlers");
const logger_1 = require("../logging/logger");
const send_push_1 = require("../pwa/send-push");
class EntityBroadcaster {
    constructor() {
        this.wsManager = null;
        this.subscriptions = new Map(); // entityKey -> clientIds[]
    }
    /**
     * Set WebSocket manager
     */
    setWebSocketManager(manager) {
        this.wsManager = manager;
    }
    /**
     * Subscribe client to entity updates
     */
    subscribe(clientId, entityType, entityId) {
        const key = `${entityType}:${entityId}`;
        if (!this.subscriptions.has(key)) {
            this.subscriptions.set(key, []);
        }
        const clients = this.subscriptions.get(key);
        if (!clients.includes(clientId)) {
            clients.push(clientId);
            logger_1.logger.info("Entity subscription added", { clientId, entityType, entityId });
        }
    }
    /**
     * Unsubscribe client from entity updates
     */
    unsubscribe(clientId, entityType, entityId) {
        const key = `${entityType}:${entityId}`;
        const clients = this.subscriptions.get(key);
        if (clients) {
            const index = clients.indexOf(clientId);
            if (index > -1) {
                clients.splice(index, 1);
                if (clients.length === 0) {
                    this.subscriptions.delete(key);
                }
                logger_1.logger.info("Entity subscription removed", { clientId, entityType, entityId });
            }
        }
    }
    /**
     * Broadcast entity update to all subscribed clients
     */
    broadcastUpdate(entityType, entityId, update, tenantId) {
        if (!this.wsManager) {
            logger_1.logger.warn("WebSocket manager not set, cannot broadcast");
            return;
        }
        // Broadcast via WebSocket
        (0, handlers_1.broadcastEntityUpdate)(this.subscriptions, entityType, entityId, update, (clientId, message) => {
            this.wsManager.sendToClient(clientId, message);
        });
        // Send push notification if tenant ID provided and update is significant
        if (tenantId && this.shouldSendPushNotification(entityType, update)) {
            this.sendPushNotification(tenantId, entityType, entityId, update).catch((error) => {
                logger_1.logger.warn("Failed to send push notification for entity update", {
                    entityType,
                    entityId,
                    error: error.message,
                });
            });
        }
    }
    /**
     * Determine if push notification should be sent
     */
    shouldSendPushNotification(entityType, update) {
        // Send push for important entity types
        const importantTypes = ["claim", "artifact", "approval", "forecast", "alert"];
        return importantTypes.includes(entityType.toLowerCase());
    }
    /**
     * Send push notification for entity update
     */
    async sendPushNotification(tenantId, entityType, entityId, update) {
        const title = this.getPushTitle(entityType, update);
        const body = this.getPushBody(entityType, update);
        if (!title || !body) {
            return; // Skip if no meaningful content
        }
        await send_push_1.pushService.sendToTenant(tenantId, {
            title,
            body,
            icon: "/icon-192x192.png",
            badge: "/badge-72x72.png",
            data: {
                entityType,
                entityId,
                action: update.action || "updated",
                url: this.getEntityUrl(entityType, entityId),
            },
        });
    }
    /**
     * Get push notification title
     */
    getPushTitle(entityType, update) {
        const action = update.action || "updated";
        const typeName = entityType.charAt(0).toUpperCase() + entityType.slice(1);
        switch (action) {
            case "created":
                return `New ${typeName} Created`;
            case "updated":
                return `${typeName} Updated`;
            case "approved":
                return `${typeName} Approved`;
            case "published":
                return `${typeName} Published`;
            default:
                return `${typeName} ${action.charAt(0).toUpperCase() + action.slice(1)}`;
        }
    }
    /**
     * Get push notification body
     */
    getPushBody(entityType, update) {
        if (update.title) {
            return update.title;
        }
        if (update.name) {
            return update.name;
        }
        if (update.canonicalText) {
            return update.canonicalText.substring(0, 100);
        }
        return `${entityType} has been updated`;
    }
    /**
     * Get entity URL
     */
    getEntityUrl(entityType, entityId) {
        const typeMap = {
            claim: "/claims",
            artifact: "/studio",
            approval: "/governance",
            forecast: "/forecasts",
            alert: "/alerts",
        };
        const basePath = typeMap[entityType.toLowerCase()] || `/${entityType}`;
        return `${basePath}/${entityId}`;
    }
    /**
     * Get subscription count for entity
     */
    getSubscriptionCount(entityType, entityId) {
        const key = `${entityType}:${entityId}`;
        return this.subscriptions.get(key)?.length || 0;
    }
    /**
     * Remove all subscriptions for a client (on disconnect)
     */
    removeClient(clientId) {
        for (const [key, clients] of this.subscriptions.entries()) {
            const index = clients.indexOf(clientId);
            if (index > -1) {
                clients.splice(index, 1);
                if (clients.length === 0) {
                    this.subscriptions.delete(key);
                }
            }
        }
        logger_1.logger.info("All subscriptions removed for client", { clientId });
    }
}
exports.EntityBroadcaster = EntityBroadcaster;
exports.entityBroadcaster = new EntityBroadcaster();
