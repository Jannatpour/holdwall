"use strict";
/**
 * RBAC/ABAC Implementation
 * Role-Based and Attribute-Based Access Control
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rbacService = exports.RBACService = void 0;
const client_1 = require("@/lib/db/client");
class RBACService {
    constructor() {
        this.roleDefinitions = new Map();
        this.initializeRoles();
    }
    /**
     * Initialize role definitions
     */
    initializeRoles() {
        // Admin: Full access
        this.roleDefinitions.set("ADMIN", {
            role: "ADMIN",
            permissions: [
                { resource: "*", action: "*" },
            ],
        });
        // Approver: Can approve/reject
        this.roleDefinitions.set("APPROVER", {
            role: "APPROVER",
            permissions: [
                { resource: "approval", action: "read" },
                { resource: "approval", action: "approve" },
                { resource: "approval", action: "reject" },
                { resource: "artifact", action: "read" },
                { resource: "claim", action: "read" },
            ],
        });
        // Editor: Can create/edit content
        this.roleDefinitions.set("EDITOR", {
            role: "EDITOR",
            permissions: [
                { resource: "artifact", action: "create" },
                { resource: "artifact", action: "update" },
                { resource: "artifact", action: "read" },
                { resource: "claim", action: "read" },
                { resource: "evidence", action: "read" },
                { resource: "signal", action: "read" },
            ],
        });
        // Analyst: Read-only access to analytics
        this.roleDefinitions.set("ANALYST", {
            role: "ANALYST",
            permissions: [
                { resource: "claim", action: "read" },
                { resource: "evidence", action: "read" },
                { resource: "signal", action: "read" },
                { resource: "forecast", action: "read" },
                { resource: "graph", action: "read" },
            ],
        });
        // Viewer: Read-only access
        this.roleDefinitions.set("VIEWER", {
            role: "VIEWER",
            permissions: [
                { resource: "overview", action: "read" },
                { resource: "claim", action: "read" },
            ],
        });
    }
    /**
     * Check if user has permission
     */
    async hasPermission(userId, resource, action, attributes) {
        // Get user from database
        const user = await client_1.db.user.findUnique({
            where: { id: userId },
            select: { role: true, tenantId: true },
        });
        if (!user) {
            return false;
        }
        const userRole = user.role;
        // Check role-based permissions
        const roleDef = this.roleDefinitions.get(userRole);
        if (!roleDef) {
            return false;
        }
        // Admin has all permissions
        if (userRole === "ADMIN") {
            return true;
        }
        // Check permissions
        for (const permission of roleDef.permissions) {
            if (this.matchesPermission(permission, resource, action)) {
                // Check ABAC conditions if present
                if (permission.conditions && attributes) {
                    if (!this.checkABACConditions(permission.conditions, attributes, user.tenantId)) {
                        continue;
                    }
                }
                return true;
            }
        }
        // Check inherited roles
        if (roleDef.inherits) {
            for (const inheritedRole of roleDef.inherits) {
                const inheritedDef = this.roleDefinitions.get(inheritedRole);
                if (inheritedDef) {
                    for (const permission of inheritedDef.permissions) {
                        if (this.matchesPermission(permission, resource, action)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
    /**
     * Check if permission matches resource/action
     */
    matchesPermission(permission, resource, action) {
        // Wildcard match
        if (permission.resource === "*" && permission.action === "*") {
            return true;
        }
        if (permission.resource === "*" && permission.action === action) {
            return true;
        }
        if (permission.resource === resource && permission.action === "*") {
            return true;
        }
        // Exact match
        return permission.resource === resource && permission.action === action;
    }
    /**
     * Check ABAC conditions
     */
    checkABACConditions(conditions, attributes, tenantId) {
        // Check tenant isolation
        if (conditions.tenant_id && conditions.tenant_id !== tenantId) {
            return false;
        }
        // Check custom attributes
        for (const [key, value] of Object.entries(conditions)) {
            if (key === "tenant_id")
                continue;
            const attr = attributes.find(a => a.key === key);
            if (!attr || attr.value !== value) {
                return false;
            }
        }
        return true;
    }
    /**
     * Get user's effective permissions
     */
    async getPermissions(userId) {
        const user = await client_1.db.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });
        if (!user) {
            return [];
        }
        const userRole = user.role;
        const roleDef = this.roleDefinitions.get(userRole);
        if (!roleDef) {
            return [];
        }
        const permissions = [...roleDef.permissions];
        // Add inherited permissions
        if (roleDef.inherits) {
            for (const inheritedRole of roleDef.inherits) {
                const inheritedDef = this.roleDefinitions.get(inheritedRole);
                if (inheritedDef) {
                    permissions.push(...inheritedDef.permissions);
                }
            }
        }
        return permissions;
    }
}
exports.RBACService = RBACService;
// Export singleton instance
exports.rbacService = new RBACService();
