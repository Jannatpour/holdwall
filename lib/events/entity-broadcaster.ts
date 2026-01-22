/**
 * Entity Update Broadcaster
 * Broadcasts entity updates to subscribed WebSocket clients
 */

import { WebSocketManager } from "../websocket/server";
import { broadcastEntityUpdate } from "../websocket/handlers";
import { logger } from "../logging/logger";
import { pushService } from "../pwa/send-push";

export class EntityBroadcaster {
  private wsManager: WebSocketManager | null = null;
  private subscriptions: Map<string, string[]> = new Map(); // entityKey -> clientIds[]

  /**
   * Set WebSocket manager
   */
  setWebSocketManager(manager: WebSocketManager): void {
    this.wsManager = manager;
  }

  /**
   * Subscribe client to entity updates
   */
  subscribe(clientId: string, entityType: string, entityId: string): void {
    const key = `${entityType}:${entityId}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, []);
    }
    
    const clients = this.subscriptions.get(key)!;
    if (!clients.includes(clientId)) {
      clients.push(clientId);
      logger.info("Entity subscription added", { clientId, entityType, entityId });
    }
  }

  /**
   * Unsubscribe client from entity updates
   */
  unsubscribe(clientId: string, entityType: string, entityId: string): void {
    const key = `${entityType}:${entityId}`;
    const clients = this.subscriptions.get(key);
    
    if (clients) {
      const index = clients.indexOf(clientId);
      if (index > -1) {
        clients.splice(index, 1);
        if (clients.length === 0) {
          this.subscriptions.delete(key);
        }
        logger.info("Entity subscription removed", { clientId, entityType, entityId });
      }
    }
  }

  /**
   * Broadcast entity update to all subscribed clients
   */
  broadcastUpdate(entityType: string, entityId: string, update: any, tenantId?: string): void {
    if (!this.wsManager) {
      logger.warn("WebSocket manager not set, cannot broadcast");
      return;
    }

    // Broadcast via WebSocket
    broadcastEntityUpdate(
      this.subscriptions,
      entityType,
      entityId,
      update,
      (clientId, message) => {
        this.wsManager!.sendToClient(clientId, message);
      }
    );

    // Send push notification if tenant ID provided and update is significant
    if (tenantId && this.shouldSendPushNotification(entityType, update)) {
      this.sendPushNotification(tenantId, entityType, entityId, update).catch((error) => {
        logger.warn("Failed to send push notification for entity update", {
          entityType,
          entityId,
          error: (error as Error).message,
        });
      });
    }
  }

  /**
   * Determine if push notification should be sent
   */
  private shouldSendPushNotification(entityType: string, update: any): boolean {
    // Send push for important entity types
    const importantTypes = ["claim", "artifact", "approval", "forecast", "alert"];
    return importantTypes.includes(entityType.toLowerCase());
  }

  /**
   * Send push notification for entity update
   */
  private async sendPushNotification(
    tenantId: string,
    entityType: string,
    entityId: string,
    update: any
  ): Promise<void> {
    const title = this.getPushTitle(entityType, update);
    const body = this.getPushBody(entityType, update);

    if (!title || !body) {
      return; // Skip if no meaningful content
    }

    await pushService.sendToTenant(tenantId, {
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
  private getPushTitle(entityType: string, update: any): string | null {
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
  private getPushBody(entityType: string, update: any): string | null {
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
  private getEntityUrl(entityType: string, entityId: string): string {
    const typeMap: Record<string, string> = {
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
  getSubscriptionCount(entityType: string, entityId: string): number {
    const key = `${entityType}:${entityId}`;
    return this.subscriptions.get(key)?.length || 0;
  }

  /**
   * Remove all subscriptions for a client (on disconnect)
   */
  removeClient(clientId: string): void {
    for (const [key, clients] of this.subscriptions.entries()) {
      const index = clients.indexOf(clientId);
      if (index > -1) {
        clients.splice(index, 1);
        if (clients.length === 0) {
          this.subscriptions.delete(key);
        }
      }
    }
    logger.info("All subscriptions removed for client", { clientId });
  }
}

export const entityBroadcaster = new EntityBroadcaster();
