"use strict";
/**
 * Financial Services Escalation Enforcer
 *
 * Automatically applies escalation rules to claims and signals
 * based on Financial Services operating mode configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.escalationEnforcer = exports.FinancialServicesEscalationEnforcer = void 0;
const client_1 = require("@/lib/db/client");
const operating_mode_1 = require("./operating-mode");
const logger_1 = require("@/lib/logging/logger");
const log_db_1 = require("@/lib/audit/log-db");
const store_db_1 = require("@/lib/events/store-db");
const service_1 = require("@/lib/alerts/service");
const crypto_1 = require("crypto");
const metrics_1 = require("@/lib/observability/metrics");
const auditLog = new log_db_1.DatabaseAuditLog();
const eventStore = new store_db_1.DatabaseEventStore();
const alertsService = new service_1.AlertsService(eventStore);
class FinancialServicesEscalationEnforcer {
    /**
     * Check and apply escalation rules to a claim
     */
    async checkAndEscalateClaim(tenantId, claimId, claimText, velocity) {
        try {
            const config = await operating_mode_1.financialServicesMode.getConfig(tenantId);
            if (!config.enabled) {
                return {
                    requiresEscalation: false,
                    severity: "low",
                    routeTo: [],
                };
            }
            // Categorize the claim
            const category = await this.categorizeClaim(claimText, config.narrativeCategories);
            // Check escalation rules
            const escalation = await operating_mode_1.financialServicesMode.checkEscalation(tenantId, category, claimText, velocity);
            // If escalation required, create alert or route to appropriate team
            if (escalation.requiresEscalation) {
                await this.createEscalationAlert(tenantId, claimId, claimText, escalation, category);
            }
            // Check for auto-downgrade conditions
            const autoDowngrade = await this.checkAutoDowngrade(tenantId, claimText, config);
            return {
                ...escalation,
                autoDowngrade,
            };
        }
        catch (error) {
            logger_1.logger.error("Financial Services escalation check failed", {
                error: error instanceof Error ? error.message : String(error),
                tenantId,
                claimId,
            });
            // Return safe default
            return {
                requiresEscalation: false,
                severity: "low",
                routeTo: [],
            };
        }
    }
    /**
     * Check and apply escalation rules to a signal
     */
    async checkAndEscalateSignal(tenantId, signalId, signalContent, velocity) {
        try {
            const config = await operating_mode_1.financialServicesMode.getConfig(tenantId);
            if (!config.enabled) {
                return {
                    requiresEscalation: false,
                    severity: "low",
                    routeTo: [],
                };
            }
            // Categorize the signal
            const category = await this.categorizeClaim(signalContent, config.narrativeCategories);
            // Check escalation rules
            const escalation = await operating_mode_1.financialServicesMode.checkEscalation(tenantId, category, signalContent, velocity);
            // If escalation required, create alert
            if (escalation.requiresEscalation) {
                await this.createEscalationAlert(tenantId, signalId, signalContent, escalation, category, "signal");
            }
            return escalation;
        }
        catch (error) {
            logger_1.logger.error("Financial Services signal escalation check failed", {
                error: error instanceof Error ? error.message : String(error),
                tenantId,
                signalId,
            });
            return {
                requiresEscalation: false,
                severity: "low",
                routeTo: [],
            };
        }
    }
    /**
     * Categorize claim by financial narrative type
     */
    async categorizeClaim(text, categories) {
        const lowerText = text.toLowerCase();
        // Simple keyword matching (in production, use NLP)
        if (lowerText.includes("scam") || lowerText.includes("fraud")) {
            return "scam_fraud";
        }
        if (lowerText.includes("freeze") || lowerText.includes("frozen") || lowerText.includes("hold")) {
            return "account_freezes";
        }
        if (lowerText.includes("fee") || lowerText.includes("charge") || lowerText.includes("cost")) {
            return "hidden_fees";
        }
        if (lowerText.includes("transaction") && (lowerText.includes("fail") || lowerText.includes("error"))) {
            return "transaction_failures";
        }
        if (lowerText.includes("insurance") && (lowerText.includes("deny") || lowerText.includes("refuse"))) {
            return "insurance_denials";
        }
        if (lowerText.includes("privacy") || lowerText.includes("data") || lowerText.includes("breach")) {
            return "data_privacy";
        }
        if (lowerText.includes("regulator") || lowerText.includes("compliance") || lowerText.includes("violation")) {
            return "regulatory_allegations";
        }
        if (lowerText.includes("outage") || lowerText.includes("down") || lowerText.includes("unavailable")) {
            return "platform_outages";
        }
        // Default
        return "scam_fraud";
    }
    /**
     * Check for auto-downgrade conditions
     */
    async checkAutoDowngrade(tenantId, text, config) {
        for (const rule of config.escalationRules || []) {
            if (!rule.enabled || !rule.autoDowngrade)
                continue;
            const lowerText = text.toLowerCase();
            const lowerCondition = rule.condition.toLowerCase();
            if (lowerCondition.includes("already resolved") && lowerText.includes("resolved")) {
                return true;
            }
        }
        return false;
    }
    /**
     * Create escalation alert
     */
    async createEscalationAlert(tenantId, resourceId, content, escalation, category, resourceType = "claim") {
        try {
            // Get users in the roles that need to be notified
            const routeToRoles = escalation.routeTo.map((r) => r.toUpperCase());
            const users = await client_1.db.user.findMany({
                where: {
                    tenantId,
                    OR: [
                        { role: "ADMIN" },
                        { role: "APPROVER" },
                    ],
                },
                select: { email: true },
            });
            const recipients = users.map((u) => u.email).filter(Boolean);
            // Create alert using AlertsService
            const alertId = await alertsService.createAlert(tenantId, "system", escalation.severity === "high" ? "critical" : escalation.severity === "medium" ? "high" : "medium", `Financial Services Escalation: ${category}`, `High-severity ${category} ${resourceType} requires immediate attention. Route to: ${escalation.routeTo.join(", ")}`, [resourceId], recipients.length > 0 ? recipients : ["admin@example.com"] // Fallback if no users found
            );
            // Send alert immediately
            await alertsService.sendAlert(alertId);
            // Audit log
            await auditLog.append({
                audit_id: (0, crypto_1.randomUUID)(),
                tenant_id: tenantId,
                actor_id: "financial-services-escalation",
                type: "event",
                timestamp: new Date().toISOString(),
                correlation_id: `escalation-${resourceId}-${Date.now()}`,
                causation_id: undefined,
                data: {
                    action: "escalation_created",
                    alert_id: alertId,
                    resource_id: resourceId,
                    resource_type: resourceType,
                    category,
                    severity: escalation.severity,
                    route_to: escalation.routeTo,
                },
                evidence_refs: [resourceId],
            });
            // Metrics
            metrics_1.metrics.increment("financial_services_escalation_total", {
                tenantId,
                category,
                severity: escalation.severity,
            });
            logger_1.logger.info("Financial Services escalation alert created", {
                tenantId,
                alertId,
                resourceId,
                category,
                severity: escalation.severity,
                routeTo: escalation.routeTo,
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to create escalation alert", {
                error: error instanceof Error ? error.message : String(error),
                tenantId,
                resourceId,
            });
        }
    }
}
exports.FinancialServicesEscalationEnforcer = FinancialServicesEscalationEnforcer;
exports.escalationEnforcer = new FinancialServicesEscalationEnforcer();
