"use strict";
/**
 * Evidence Access Control Service
 *
 * Manages RBAC/ABAC access controls for evidence with full audit logging.
 * Tracks all access attempts and enforces permissions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidenceAccessControlService = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
const rbac_1 = require("@/lib/auth/rbac");
class EvidenceAccessControlService {
    constructor() {
        this.rbacService = new rbac_1.RBACService();
    }
    /**
     * Check if actor can access evidence
     */
    async checkAccess(request) {
        try {
            // Get evidence to check tenant
            const evidence = await client_1.db.evidence.findUnique({
                where: { id: request.evidence_id },
                select: { tenantId: true, type: true, complianceFlags: true },
            });
            if (!evidence) {
                return {
                    allowed: false,
                    reason: "Evidence not found",
                    requires_approval: false,
                };
            }
            // Check tenant match
            if (evidence.tenantId !== request.tenant_id) {
                return {
                    allowed: false,
                    reason: "Tenant mismatch",
                    requires_approval: false,
                };
            }
            // Check RBAC permissions
            const resource = `evidence:${evidence.type.toLowerCase()}`;
            const action = this.mapAccessTypeToAction(request.access_type);
            const attributes = [
                { key: "tenantId", value: request.tenant_id },
                { key: "evidenceType", value: evidence.type },
                { key: "accessType", value: request.access_type },
            ];
            // Add compliance flags as attributes
            if (evidence.complianceFlags && evidence.complianceFlags.length > 0) {
                attributes.push({
                    key: "complianceFlags",
                    value: evidence.complianceFlags,
                });
            }
            const hasPermission = await this.rbacService.hasPermission(request.actor_id, resource, action, attributes);
            if (!hasPermission) {
                // Log denied access
                await this.logAccess({
                    ...request,
                    allowed: false,
                });
                return {
                    allowed: false,
                    reason: "Insufficient permissions",
                    requires_approval: false,
                };
            }
            // Check if approval required for sensitive operations
            const requiresApproval = this.requiresApproval(request.access_type, evidence.complianceFlags);
            if (requiresApproval) {
                // Log access request requiring approval
                await this.logAccess({
                    ...request,
                    allowed: false,
                    requires_approval: true,
                });
                return {
                    allowed: false,
                    reason: "Approval required",
                    requires_approval: true,
                };
            }
            // Log allowed access
            await this.logAccess({
                ...request,
                allowed: true,
            });
            return {
                allowed: true,
                requires_approval: false,
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to check evidence access", {
                error: error instanceof Error ? error.message : String(error),
                evidence_id: request.evidence_id,
                actor_id: request.actor_id,
                stack: error instanceof Error ? error.stack : undefined,
            });
            return {
                allowed: false,
                reason: "Access check failed",
                requires_approval: false,
            };
        }
    }
    /**
     * Log evidence access
     */
    async logAccess(request) {
        try {
            await client_1.db.evidenceAccessLog.create({
                data: {
                    evidenceId: request.evidence_id,
                    tenantId: request.tenant_id,
                    actorId: request.actor_id,
                    accessType: request.access_type,
                    ipAddress: request.ip_address || undefined,
                    userAgent: request.user_agent || undefined,
                    reason: request.reason || undefined,
                    approvedBy: request.approved_by || undefined,
                },
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to log evidence access", {
                error: error instanceof Error ? error.message : String(error),
                evidence_id: request.evidence_id,
                actor_id: request.actor_id,
                stack: error instanceof Error ? error.stack : undefined,
            });
        }
    }
    /**
     * Get access log for evidence
     */
    async getAccessLog(evidenceId, options) {
        const where = {
            evidenceId,
        };
        if (options?.access_type) {
            where.accessType = options.access_type;
        }
        if (options?.actor_id) {
            where.actorId = options.actor_id;
        }
        const logs = await client_1.db.evidenceAccessLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: options?.limit || 100,
            skip: options?.offset || 0,
        });
        return logs.map((log) => ({
            id: log.id,
            evidence_id: log.evidenceId,
            tenant_id: log.tenantId,
            actor_id: log.actorId,
            access_type: log.accessType,
            ip_address: log.ipAddress || undefined,
            user_agent: log.userAgent || undefined,
            reason: log.reason || undefined,
            approved_by: log.approvedBy || undefined,
            created_at: log.createdAt.toISOString(),
        }));
    }
    /**
     * Get access log for tenant
     */
    async getTenantAccessLog(tenantId, options) {
        const where = {
            tenantId,
        };
        if (options?.access_type) {
            where.accessType = options.access_type;
        }
        if (options?.actor_id) {
            where.actorId = options.actor_id;
        }
        if (options?.evidence_id) {
            where.evidenceId = options.evidence_id;
        }
        const logs = await client_1.db.evidenceAccessLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: options?.limit || 100,
            skip: options?.offset || 0,
        });
        return logs.map((log) => ({
            id: log.id,
            evidence_id: log.evidenceId,
            tenant_id: log.tenantId,
            actor_id: log.actorId,
            access_type: log.accessType,
            ip_address: log.ipAddress || undefined,
            user_agent: log.userAgent || undefined,
            reason: log.reason || undefined,
            approved_by: log.approvedBy || undefined,
            created_at: log.createdAt.toISOString(),
        }));
    }
    /**
     * Map access type to RBAC action
     */
    mapAccessTypeToAction(accessType) {
        switch (accessType) {
            case "READ":
                return "read";
            case "WRITE":
                return "update";
            case "DELETE":
                return "delete";
            case "EXPORT":
                return "export";
            case "REDACT":
                return "redact";
            default:
                return "read";
        }
    }
    /**
     * Check if access type requires approval
     */
    requiresApproval(accessType, complianceFlags) {
        // Sensitive operations always require approval
        if (accessType === "DELETE" || accessType === "REDACT") {
            return true;
        }
        // Export requires approval if evidence has compliance flags
        if (accessType === "EXPORT" && complianceFlags && complianceFlags.length > 0) {
            return true;
        }
        return false;
    }
}
exports.EvidenceAccessControlService = EvidenceAccessControlService;
