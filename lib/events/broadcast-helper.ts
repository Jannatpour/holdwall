/**
 * Entity Broadcast Helper
 * Utility to broadcast entity updates after database operations
 */

import { entityBroadcaster } from "./entity-broadcaster";
import { wsManager } from "../websocket/server";
import { logger } from "@/lib/logging/logger";

/**
 * Initialize broadcaster with WebSocket manager
 * Note: WebSocket manager must be initialized separately via HTTP server
 */
export function initializeBroadcaster(): void {
  // WebSocket manager will be set when HTTP server is available
  // For now, just ensure the broadcaster is ready
  if (wsManager) {
    entityBroadcaster.setWebSocketManager(wsManager);
  }
}

/**
 * Broadcast entity update
 */
export async function broadcastEntityUpdate(
  entityType: "claim" | "forecast" | "artifact" | "cluster",
  entityId: string,
  update: {
    action: "created" | "updated" | "deleted" | "published" | "approved";
    data?: any;
  },
  tenantId?: string
): Promise<void> {
  try {
    entityBroadcaster.broadcastUpdate(entityType, entityId, update, tenantId);
  } catch (error) {
    // Fail silently - broadcasting is non-critical
    logger.warn("Failed to broadcast entity update", {
      error: error instanceof Error ? error.message : String(error),
      entityType,
      entityId,
      tenantId,
    });
  }
}

/**
 * Broadcast after claim operations
 */
export async function broadcastClaimUpdate(
  claimId: string,
  action: "created" | "updated" | "deleted",
  data?: any,
  tenantId?: string
): Promise<void> {
  await broadcastEntityUpdate("claim", claimId, { action, data }, tenantId);
}

/**
 * Broadcast after forecast operations
 */
export async function broadcastForecastUpdate(
  forecastId: string,
  action: "created" | "updated" | "deleted",
  data?: any,
  tenantId?: string
): Promise<void> {
  await broadcastEntityUpdate("forecast", forecastId, { action, data }, tenantId);
}

/**
 * Broadcast after artifact operations
 */
export async function broadcastArtifactUpdate(
  artifactId: string,
  action: "created" | "updated" | "deleted" | "published" | "approved",
  data?: any,
  tenantId?: string
): Promise<void> {
  await broadcastEntityUpdate("artifact", artifactId, { action, data }, tenantId);
}

/**
 * Broadcast after cluster operations
 */
export async function broadcastClusterUpdate(
  clusterId: string,
  action: "created" | "updated",
  data?: any,
  tenantId?: string
): Promise<void> {
  await broadcastEntityUpdate("cluster", clusterId, { action, data }, tenantId);
}
