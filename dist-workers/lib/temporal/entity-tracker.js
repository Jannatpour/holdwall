"use strict";
/**
 * Entity Tracker
 *
 * Tracks entities (people, policies, vendors, organizations) over time
 * to detect ownership changes, policy revisions, and vendor changes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityTracker = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
class EntityTracker {
    /**
     * Track entity state change
     */
    async trackEntityChange(tenantId, entityType, entityName, newState, options) {
        try {
            // Find or create entity
            let entity = await client_1.db.entity.findFirst({
                where: {
                    tenantId,
                    type: entityType,
                    name: entityName,
                },
            });
            const currentTimestamp = new Date().toISOString();
            if (!entity) {
                // Create new entity
                entity = await client_1.db.entity.create({
                    data: {
                        tenantId,
                        type: entityType,
                        name: entityName,
                        aliases: options?.aliases || [],
                        currentState: newState,
                        stateHistory: [
                            {
                                timestamp: currentTimestamp,
                                state: newState,
                                changed_by: options?.changed_by,
                                change_reason: options?.change_reason,
                            },
                        ],
                    },
                });
            }
            else {
                // Update existing entity
                const oldState = entity.currentState || {};
                const stateHistory = entity.stateHistory || [];
                entity = await client_1.db.entity.update({
                    where: { id: entity.id },
                    data: {
                        currentState: newState,
                        stateHistory: [
                            ...stateHistory,
                            {
                                timestamp: currentTimestamp,
                                state: newState,
                                changed_by: options?.changed_by,
                                change_reason: options?.change_reason,
                            },
                        ],
                        aliases: Array.from(new Set([...(entity.aliases || []), ...(options?.aliases || [])])),
                    },
                });
            }
            // Record change event
            const history = entity.stateHistory ? entity.stateHistory : [];
            const historyLen = history.length;
            await client_1.db.entityEvent.create({
                data: {
                    tenantId,
                    entityId: entity.id,
                    type: historyLen === 1 ? "CREATED" : "STATE_CHANGED",
                    oldState: historyLen > 1 ? history[historyLen - 2].state : undefined,
                    newState: newState,
                    changedBy: options?.changed_by || "system",
                    changeReason: options?.change_reason || undefined,
                },
            });
            return this.mapToEntity(entity);
        }
        catch (error) {
            logger_1.logger.error("Failed to track entity change", {
                error: error instanceof Error ? error.message : String(error),
                tenant_id: tenantId,
                entity_type: entityType,
                entity_name: entityName,
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }
    /**
     * Get entity by name and type
     */
    async getEntity(tenantId, entityType, entityName) {
        const entity = await client_1.db.entity.findFirst({
            where: {
                tenantId,
                type: entityType,
                OR: [
                    { name: entityName },
                    { aliases: { has: entityName } },
                ],
            },
        });
        if (!entity) {
            return null;
        }
        return this.mapToEntity(entity);
    }
    /**
     * Get entity change history
     */
    async getEntityHistory(entityId, tenantId) {
        const events = await client_1.db.entityEvent.findMany({
            where: {
                entityId,
                tenantId,
            },
            orderBy: { changedAt: "asc" },
        });
        const entity = await client_1.db.entity.findUnique({
            where: { id: entityId },
        });
        if (!entity) {
            return [];
        }
        return events.map((e) => ({
            entity_id: e.entityId,
            entity_name: entity.name,
            entity_type: entity.type,
            change_type: e.type,
            old_state: e.oldState || undefined,
            new_state: e.newState || {},
            changed_by: e.changedBy,
            changed_at: e.changedAt.toISOString(),
            change_reason: e.changeReason || undefined,
        }));
    }
    /**
     * Map database record to Entity
     */
    mapToEntity(entity) {
        return {
            id: entity.id,
            tenant_id: entity.tenantId,
            type: entity.type,
            name: entity.name,
            aliases: entity.aliases || [],
            current_state: entity.currentState || {},
            state_history: (entity.stateHistory || []).map((h) => ({
                timestamp: h.timestamp,
                state: h.state,
                changed_by: h.changed_by,
                change_reason: h.change_reason,
            })),
            metadata: entity.metadata || undefined,
            created_at: entity.createdAt.toISOString(),
            updated_at: entity.updatedAt.toISOString(),
        };
    }
}
exports.EntityTracker = EntityTracker;
