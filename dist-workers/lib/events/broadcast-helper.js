"use strict";
/**
 * Entity Broadcast Helper
 * Utility to broadcast entity updates after database operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeBroadcaster = initializeBroadcaster;
exports.broadcastEntityUpdate = broadcastEntityUpdate;
exports.broadcastClaimUpdate = broadcastClaimUpdate;
exports.broadcastForecastUpdate = broadcastForecastUpdate;
exports.broadcastArtifactUpdate = broadcastArtifactUpdate;
exports.broadcastClusterUpdate = broadcastClusterUpdate;
const entity_broadcaster_1 = require("./entity-broadcaster");
const server_1 = require("../websocket/server");
const logger_1 = require("@/lib/logging/logger");
/**
 * Initialize broadcaster with WebSocket manager
 * Note: WebSocket manager must be initialized separately via HTTP server
 */
function initializeBroadcaster() {
    // WebSocket manager will be set when HTTP server is available
    // For now, just ensure the broadcaster is ready
    if (server_1.wsManager) {
        entity_broadcaster_1.entityBroadcaster.setWebSocketManager(server_1.wsManager);
    }
}
/**
 * Broadcast entity update
 */
async function broadcastEntityUpdate(entityType, entityId, update, tenantId) {
    try {
        entity_broadcaster_1.entityBroadcaster.broadcastUpdate(entityType, entityId, update, tenantId);
    }
    catch (error) {
        // Fail silently - broadcasting is non-critical
        logger_1.logger.warn("Failed to broadcast entity update", {
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
async function broadcastClaimUpdate(claimId, action, data, tenantId) {
    await broadcastEntityUpdate("claim", claimId, { action, data }, tenantId);
}
/**
 * Broadcast after forecast operations
 */
async function broadcastForecastUpdate(forecastId, action, data, tenantId) {
    await broadcastEntityUpdate("forecast", forecastId, { action, data }, tenantId);
}
/**
 * Broadcast after artifact operations
 */
async function broadcastArtifactUpdate(artifactId, action, data, tenantId) {
    await broadcastEntityUpdate("artifact", artifactId, { action, data }, tenantId);
}
/**
 * Broadcast after cluster operations
 */
async function broadcastClusterUpdate(clusterId, action, data, tenantId) {
    await broadcastEntityUpdate("cluster", clusterId, { action, data }, tenantId);
}
