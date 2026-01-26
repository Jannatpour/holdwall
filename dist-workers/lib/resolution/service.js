"use strict";
/**
 * Customer Resolution Service
 *
 * Routes refunds/escalations, integrates with support ticket systems,
 * and tracks remediation actions with SLA monitoring.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerResolutionService = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
const log_db_1 = require("@/lib/audit/log-db");
const crypto_1 = require("crypto");
class CustomerResolutionService {
    constructor() {
        this.auditLog = new log_db_1.DatabaseAuditLog();
    }
    /**
     * Create customer resolution
     */
    async createResolution(tenantId, clusterId, type, title, description, options) {
        try {
            // Calculate SLA deadline
            const slaDeadline = options?.sla_hours
                ? new Date(Date.now() + options.sla_hours * 60 * 60 * 1000)
                : this.calculateSLADeadline(type, options?.priority || "MEDIUM");
            const resolution = await client_1.db.customerResolution.create({
                data: {
                    tenantId,
                    clusterId,
                    type: type,
                    status: "OPEN",
                    priority: (options?.priority || "MEDIUM"),
                    title,
                    description,
                    customerInfo: options?.customer_info || undefined,
                    assignedTo: options?.assigned_to || undefined,
                    slaDeadline,
                    metadata: options?.metadata || undefined,
                },
            });
            // Create support ticket if needed
            if (type === "SUPPORT_TICKET" || type === "ESCALATION") {
                await this.createSupportTicket(resolution.id, tenantId, type);
            }
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
                    type: "resolution.created",
                    occurred_at: new Date().toISOString(),
                    correlation_id: (0, crypto_1.randomUUID)(),
                    schema_version: "1.0",
                    evidence_refs: [],
                    payload: {
                        resolution_id: resolution.id,
                        cluster_id: clusterId,
                        type,
                        priority: options?.priority || "MEDIUM",
                    },
                    signatures: [],
                },
                evidence_refs: [],
            });
            logger_1.logger.info("Customer resolution created", {
                resolution_id: resolution.id,
                cluster_id: clusterId,
                tenant_id: tenantId,
                type,
            });
            return this.mapToResolution(resolution);
        }
        catch (error) {
            logger_1.logger.error("Failed to create customer resolution", {
                error: error instanceof Error ? error.message : String(error),
                cluster_id: clusterId,
                tenant_id: tenantId,
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }
    /**
     * Route resolution based on type and priority
     */
    async routeResolution(resolutionId, tenantId) {
        try {
            const resolution = await client_1.db.customerResolution.findUnique({
                where: { id: resolutionId },
            });
            if (!resolution || resolution.tenantId !== tenantId) {
                throw new Error("Resolution not found or tenant mismatch");
            }
            const routes = [];
            // Route based on type and priority
            if (resolution.type === "REFUND" && resolution.priority === "URGENT") {
                routes.push("Finance", "Customer Support");
            }
            else if (resolution.type === "REFUND") {
                routes.push("Customer Support");
            }
            if (resolution.type === "ESCALATION") {
                routes.push("Management", "Customer Support");
            }
            if (resolution.type === "SUPPORT_TICKET") {
                routes.push("Customer Support");
            }
            if (resolution.priority === "URGENT" || resolution.priority === "HIGH") {
                routes.push("Escalation Team");
            }
            // Update resolution with routes
            await client_1.db.customerResolution.update({
                where: { id: resolutionId },
                data: {
                    metadata: {
                        ...(resolution.metadata || {}),
                        routes,
                        routed_at: new Date().toISOString(),
                    },
                },
            });
            return {
                routed: true,
                route_to: Array.from(new Set(routes)),
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to route resolution", {
                error: error instanceof Error ? error.message : String(error),
                resolution_id: resolutionId,
                tenant_id: tenantId,
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }
    /**
     * Create support ticket (integrate with external systems)
     */
    async createSupportTicket(resolutionId, tenantId, type) {
        try {
            // In production, integrate with Zendesk, Jira, ServiceNow, etc.
            // For now, create internal ticket record
            const ticket = await client_1.db.supportTicket.create({
                data: {
                    tenantId,
                    resolutionId,
                    externalSystem: "internal", // "zendesk", "jira", "servicenow"
                    externalId: `ticket-${Date.now()}`,
                    status: "OPEN",
                    priority: "MEDIUM",
                },
            });
            // Update resolution with ticket ID
            await client_1.db.customerResolution.update({
                where: { id: resolutionId },
                data: {
                    supportTicketId: ticket.id,
                    externalTicketId: ticket.externalId,
                },
            });
            logger_1.logger.info("Support ticket created", {
                ticket_id: ticket.id,
                resolution_id: resolutionId,
                tenant_id: tenantId,
            });
        }
        catch (error) {
            logger_1.logger.warn("Failed to create support ticket", {
                error: error instanceof Error ? error.message : String(error),
                resolution_id: resolutionId,
            });
        }
    }
    /**
     * Create remediation action
     */
    async createRemediationAction(resolutionId, tenantId, actionType, description, options) {
        try {
            const action = await client_1.db.remediationAction.create({
                data: {
                    resolutionId,
                    tenantId,
                    actionType,
                    description,
                    status: "PENDING",
                    assignedTo: options?.assigned_to || undefined,
                    dueDate: options?.due_date || undefined,
                    metadata: options?.metadata || undefined,
                },
            });
            logger_1.logger.info("Remediation action created", {
                action_id: action.id,
                resolution_id: resolutionId,
                tenant_id: tenantId,
            });
            return this.mapToRemediationAction(action);
        }
        catch (error) {
            logger_1.logger.error("Failed to create remediation action", {
                error: error instanceof Error ? error.message : String(error),
                resolution_id: resolutionId,
                tenant_id: tenantId,
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }
    /**
     * Get resolutions for cluster
     */
    async getResolutionsForCluster(clusterId, tenantId) {
        const resolutions = await client_1.db.customerResolution.findMany({
            where: {
                clusterId,
                tenantId,
            },
            orderBy: { createdAt: "desc" },
        });
        return resolutions.map((r) => this.mapToResolution(r));
    }
    /**
     * Calculate SLA deadline based on type and priority
     */
    calculateSLADeadline(type, priority) {
        let hours = 24; // Default
        if (priority === "URGENT") {
            hours = 2;
        }
        else if (priority === "HIGH") {
            hours = 4;
        }
        else if (priority === "MEDIUM") {
            hours = 24;
        }
        else {
            hours = 72;
        }
        // Adjust based on type
        if (type === "REFUND") {
            hours = Math.min(hours, 48);
        }
        else if (type === "ESCALATION") {
            hours = Math.min(hours, 4);
        }
        return new Date(Date.now() + hours * 60 * 60 * 1000);
    }
    /**
     * Map database record to CustomerResolution
     */
    mapToResolution(resolution) {
        return {
            id: resolution.id,
            tenant_id: resolution.tenantId,
            cluster_id: resolution.clusterId,
            type: resolution.type,
            status: resolution.status,
            priority: resolution.priority,
            title: resolution.title,
            description: resolution.description,
            customer_info: resolution.customerInfo || undefined,
            assigned_to: resolution.assignedTo || undefined,
            support_ticket_id: resolution.supportTicketId || undefined,
            external_ticket_id: resolution.externalTicketId || undefined,
            sla_deadline: resolution.slaDeadline?.toISOString() || undefined,
            resolved_at: resolution.resolvedAt?.toISOString() || undefined,
            resolution_details: resolution.resolutionDetails || undefined,
            metadata: resolution.metadata || undefined,
            created_at: resolution.createdAt.toISOString(),
            updated_at: resolution.updatedAt.toISOString(),
        };
    }
    /**
     * Map database record to RemediationAction
     */
    mapToRemediationAction(action) {
        return {
            id: action.id,
            resolution_id: action.resolutionId,
            tenant_id: action.tenantId,
            action_type: action.actionType,
            description: action.description,
            status: action.status,
            assigned_to: action.assignedTo || undefined,
            due_date: action.dueDate?.toISOString() || undefined,
            completed_at: action.completedAt?.toISOString() || undefined,
            verification_notes: action.verificationNotes || undefined,
            metadata: action.metadata || undefined,
            created_at: action.createdAt.toISOString(),
            updated_at: action.updatedAt.toISOString(),
        };
    }
}
exports.CustomerResolutionService = CustomerResolutionService;
