"use strict";
/**
 * CAPA (Corrective Action and Preventive Action) Service
 *
 * Links claim clusters to corrective/preventive actions, tracks ownership,
 * and measures effectiveness to create a provable improvement loop.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAPAService = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
const log_db_1 = require("@/lib/audit/log-db");
const crypto_1 = require("crypto");
class CAPAService {
    constructor() {
        this.auditLog = new log_db_1.DatabaseAuditLog();
    }
    /**
     * Create corrective action
     */
    async createCorrectiveAction(tenantId, clusterId, title, description, options) {
        try {
            const action = await client_1.db.correctiveAction.create({
                data: {
                    tenantId,
                    clusterId,
                    title,
                    description,
                    status: "OPEN",
                    priority: options?.priority || "MEDIUM",
                    ownerId: options?.ownerId || undefined,
                    dueDate: options?.dueDate || undefined,
                    metadata: options?.metadata || undefined,
                },
            });
            // Audit log
            await this.auditLog.append({
                audit_id: (0, crypto_1.randomUUID)(),
                tenant_id: tenantId,
                actor_id: "system",
                type: "event",
                timestamp: new Date().toISOString(),
                correlation_id: (0, crypto_1.randomUUID)(),
                data: {
                    event_id: (0, crypto_1.randomUUID)(),
                    tenant_id: tenantId,
                    actor_id: "system",
                    type: "capa.created",
                    occurred_at: new Date().toISOString(),
                    correlation_id: (0, crypto_1.randomUUID)(),
                    schema_version: "1.0",
                    evidence_refs: [],
                    payload: {
                        action_id: action.id,
                        action_type: "corrective",
                        cluster_id: clusterId,
                        title,
                    },
                    signatures: [],
                },
                evidence_refs: [],
            });
            logger_1.logger.info("Corrective action created", {
                action_id: action.id,
                cluster_id: clusterId,
                tenant_id: tenantId,
            });
            return this.mapToCorrectiveAction(action);
        }
        catch (error) {
            logger_1.logger.error("Failed to create corrective action", {
                error: error instanceof Error ? error.message : String(error),
                cluster_id: clusterId,
                tenant_id: tenantId,
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }
    /**
     * Create preventive action
     */
    async createPreventiveAction(tenantId, clusterId, title, description, options) {
        try {
            const action = await client_1.db.preventiveAction.create({
                data: {
                    tenantId,
                    clusterId,
                    title,
                    description,
                    status: "OPEN",
                    priority: options?.priority || "MEDIUM",
                    ownerId: options?.ownerId || undefined,
                    dueDate: options?.dueDate || undefined,
                    metadata: options?.metadata || undefined,
                },
            });
            // Audit log
            await this.auditLog.append({
                audit_id: (0, crypto_1.randomUUID)(),
                tenant_id: tenantId,
                actor_id: "system",
                type: "event",
                timestamp: new Date().toISOString(),
                correlation_id: (0, crypto_1.randomUUID)(),
                data: {
                    event_id: (0, crypto_1.randomUUID)(),
                    tenant_id: tenantId,
                    actor_id: "system",
                    type: "capa.created",
                    occurred_at: new Date().toISOString(),
                    correlation_id: (0, crypto_1.randomUUID)(),
                    schema_version: "1.0",
                    evidence_refs: [],
                    payload: {
                        action_id: action.id,
                        action_type: "preventive",
                        cluster_id: clusterId,
                        title,
                    },
                    signatures: [],
                },
                evidence_refs: [],
            });
            logger_1.logger.info("Preventive action created", {
                action_id: action.id,
                cluster_id: clusterId,
                tenant_id: tenantId,
            });
            return this.mapToPreventiveAction(action);
        }
        catch (error) {
            logger_1.logger.error("Failed to create preventive action", {
                error: error instanceof Error ? error.message : String(error),
                cluster_id: clusterId,
                tenant_id: tenantId,
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }
    /**
     * Update action status
     */
    async updateActionStatus(actionId, actionType, status, tenantId, actorId) {
        try {
            if (actionType === "corrective") {
                const action = await client_1.db.correctiveAction.update({
                    where: { id: actionId },
                    data: {
                        status: status,
                        completedAt: status === "COMPLETED" ? new Date() : undefined,
                    },
                });
                if (action.tenantId !== tenantId) {
                    throw new Error("Tenant mismatch");
                }
                // Audit log
                await this.auditLog.append({
                    audit_id: (0, crypto_1.randomUUID)(),
                    tenant_id: tenantId,
                    actor_id: actorId,
                    type: "event",
                    timestamp: new Date().toISOString(),
                    correlation_id: (0, crypto_1.randomUUID)(),
                    data: {
                        event_id: (0, crypto_1.randomUUID)(),
                        tenant_id: tenantId,
                        actor_id: actorId,
                        type: "capa.status_updated",
                        occurred_at: new Date().toISOString(),
                        correlation_id: (0, crypto_1.randomUUID)(),
                        schema_version: "1.0",
                        evidence_refs: [],
                        payload: {
                            action_id: actionId,
                            action_type: "corrective",
                            old_status: action.status,
                            new_status: status,
                        },
                        signatures: [],
                    },
                    evidence_refs: [],
                });
                return this.mapToCorrectiveAction(action);
            }
            else {
                const action = await client_1.db.preventiveAction.update({
                    where: { id: actionId },
                    data: {
                        status: status,
                        completedAt: status === "COMPLETED" ? new Date() : undefined,
                    },
                });
                if (action.tenantId !== tenantId) {
                    throw new Error("Tenant mismatch");
                }
                // Audit log
                await this.auditLog.append({
                    audit_id: (0, crypto_1.randomUUID)(),
                    tenant_id: tenantId,
                    actor_id: actorId,
                    type: "event",
                    timestamp: new Date().toISOString(),
                    correlation_id: (0, crypto_1.randomUUID)(),
                    data: {
                        event_id: (0, crypto_1.randomUUID)(),
                        tenant_id: tenantId,
                        actor_id: actorId,
                        type: "capa.status_updated",
                        occurred_at: new Date().toISOString(),
                        correlation_id: (0, crypto_1.randomUUID)(),
                        schema_version: "1.0",
                        evidence_refs: [],
                        payload: {
                            action_id: actionId,
                            action_type: "preventive",
                            old_status: action.status,
                            new_status: status,
                        },
                        signatures: [],
                    },
                    evidence_refs: [],
                });
                return this.mapToPreventiveAction(action);
            }
        }
        catch (error) {
            logger_1.logger.error("Failed to update action status", {
                error: error instanceof Error ? error.message : String(error),
                action_id: actionId,
                action_type: actionType,
                tenant_id: tenantId,
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }
    /**
     * Assign owner to action
     */
    async assignOwner(actionId, actionType, ownerId, tenantId, actorId) {
        try {
            if (actionType === "corrective") {
                const action = await client_1.db.correctiveAction.findUnique({
                    where: { id: actionId },
                });
                if (!action || action.tenantId !== tenantId) {
                    throw new Error("Action not found or tenant mismatch");
                }
                await client_1.db.correctiveAction.update({
                    where: { id: actionId },
                    data: { ownerId },
                });
            }
            else {
                const action = await client_1.db.preventiveAction.findUnique({
                    where: { id: actionId },
                });
                if (!action || action.tenantId !== tenantId) {
                    throw new Error("Action not found or tenant mismatch");
                }
                await client_1.db.preventiveAction.update({
                    where: { id: actionId },
                    data: { ownerId },
                });
            }
            // Audit log
            await this.auditLog.append({
                audit_id: (0, crypto_1.randomUUID)(),
                tenant_id: tenantId,
                actor_id: actorId,
                type: "event",
                timestamp: new Date().toISOString(),
                correlation_id: (0, crypto_1.randomUUID)(),
                data: {
                    event_id: (0, crypto_1.randomUUID)(),
                    tenant_id: tenantId,
                    actor_id: actorId,
                    type: "capa.owner_assigned",
                    occurred_at: new Date().toISOString(),
                    correlation_id: (0, crypto_1.randomUUID)(),
                    schema_version: "1.0",
                    evidence_refs: [],
                    payload: {
                        action_id: actionId,
                        action_type: actionType,
                        owner_id: ownerId,
                    },
                    signatures: [],
                },
                evidence_refs: [],
            });
            logger_1.logger.info("Action owner assigned", {
                action_id: actionId,
                action_type: actionType,
                owner_id: ownerId,
                tenant_id: tenantId,
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to assign action owner", {
                error: error instanceof Error ? error.message : String(error),
                action_id: actionId,
                action_type: actionType,
                owner_id: ownerId,
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }
    /**
     * Get actions for cluster
     */
    async getActionsForCluster(clusterId, tenantId) {
        const corrective = await client_1.db.correctiveAction.findMany({
            where: {
                clusterId,
                tenantId,
            },
            orderBy: { createdAt: "desc" },
        });
        const preventive = await client_1.db.preventiveAction.findMany({
            where: {
                clusterId,
                tenantId,
            },
            orderBy: { createdAt: "desc" },
        });
        return {
            corrective: corrective.map((a) => this.mapToCorrectiveAction(a)),
            preventive: preventive.map((a) => this.mapToPreventiveAction(a)),
        };
    }
    /**
     * Create or get action owner
     */
    async getOrCreateOwner(tenantId, userId, name, options) {
        const existing = await client_1.db.actionOwner.findUnique({
            where: {
                tenantId_userId: {
                    tenantId,
                    userId,
                },
            },
        });
        if (existing) {
            return this.mapToActionOwner(existing);
        }
        const owner = await client_1.db.actionOwner.create({
            data: {
                tenantId,
                userId,
                name,
                email: options?.email || undefined,
                role: options?.role || undefined,
                metadata: options?.metadata || undefined,
            },
        });
        return this.mapToActionOwner(owner);
    }
    /**
     * Map database record to CorrectiveAction
     */
    mapToCorrectiveAction(action) {
        return {
            id: action.id,
            tenant_id: action.tenantId,
            cluster_id: action.clusterId,
            title: action.title,
            description: action.description,
            status: action.status,
            priority: action.priority,
            owner_id: action.ownerId || undefined,
            due_date: action.dueDate?.toISOString() || undefined,
            completed_at: action.completedAt?.toISOString() || undefined,
            effectiveness: action.effectiveness || undefined,
            metadata: action.metadata || undefined,
            created_at: action.createdAt.toISOString(),
            updated_at: action.updatedAt.toISOString(),
        };
    }
    /**
     * Map database record to PreventiveAction
     */
    mapToPreventiveAction(action) {
        return {
            id: action.id,
            tenant_id: action.tenantId,
            cluster_id: action.clusterId,
            title: action.title,
            description: action.description,
            status: action.status,
            priority: action.priority,
            owner_id: action.ownerId || undefined,
            due_date: action.dueDate?.toISOString() || undefined,
            completed_at: action.completedAt?.toISOString() || undefined,
            effectiveness: action.effectiveness || undefined,
            metadata: action.metadata || undefined,
            created_at: action.createdAt.toISOString(),
            updated_at: action.updatedAt.toISOString(),
        };
    }
    /**
     * Map database record to ActionOwner
     */
    mapToActionOwner(owner) {
        return {
            id: owner.id,
            tenant_id: owner.tenantId,
            user_id: owner.userId,
            name: owner.name,
            email: owner.email || undefined,
            role: owner.role || undefined,
            metadata: owner.metadata || undefined,
            created_at: owner.createdAt.toISOString(),
            updated_at: owner.updatedAt.toISOString(),
        };
    }
}
exports.CAPAService = CAPAService;
