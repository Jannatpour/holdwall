"use strict";
/**
 * Case Escalation Service
 *
 * Handles automatic escalation rules and escalation management.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.caseEscalationService = exports.CaseEscalationService = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
const metrics_1 = require("@/lib/observability/metrics");
const store_db_1 = require("@/lib/events/store-db");
const notifications_1 = require("./notifications");
const crypto_1 = __importDefault(require("crypto"));
const eventStore = new store_db_1.DatabaseEventStore();
/**
 * Case Escalation Service
 */
class CaseEscalationService {
    /**
     * Check and execute escalation rules for a case
     */
    async checkEscalationRules(case_) {
        const escalations = [];
        // Get escalation rules for tenant
        const rules = await this.getEscalationRules(case_.tenantId);
        for (const rule of rules) {
            if (!rule.enabled) {
                continue;
            }
            // Check if rule conditions are met
            const shouldEscalate = await this.evaluateConditions(case_, rule.conditions);
            if (shouldEscalate) {
                // Check if already escalated by this rule
                const existingEscalation = await client_1.db.caseEscalation.findFirst({
                    where: {
                        caseId: case_.id,
                        reason: {
                            contains: rule.name,
                        },
                    },
                });
                if (!existingEscalation) {
                    // Execute escalation
                    const escalation = await this.executeEscalation(case_, rule);
                    escalations.push(escalation);
                }
            }
        }
        return escalations;
    }
    /**
     * Get escalation rules for tenant
     */
    async getEscalationRules(tenantId) {
        // In production, these would be stored in database
        // For now, return default rules
        return [
            {
                id: "sla-50-percent",
                name: "SLA 50% Deadline",
                tenantId,
                conditions: [
                    {
                        type: "sla_deadline",
                        operator: "less_than",
                        value: 0.5, // 50% of SLA time remaining
                    },
                ],
                actions: [
                    {
                        type: "notify_manager",
                        target: "case_manager",
                    },
                ],
                enabled: true,
            },
            {
                id: "sla-80-percent",
                name: "SLA 80% Deadline",
                tenantId,
                conditions: [
                    {
                        type: "sla_deadline",
                        operator: "less_than",
                        value: 0.2, // 20% of SLA time remaining
                    },
                ],
                actions: [
                    {
                        type: "notify_manager",
                        target: "case_manager",
                    },
                    {
                        type: "create_alert",
                        target: "high_priority",
                    },
                ],
                enabled: true,
            },
            {
                id: "sla-breach",
                name: "SLA Breach",
                tenantId,
                conditions: [
                    {
                        type: "sla_deadline",
                        operator: "less_than",
                        value: 0, // SLA deadline passed
                    },
                ],
                actions: [
                    {
                        type: "notify_manager",
                        target: "case_manager",
                    },
                    {
                        type: "notify_compliance",
                        target: "compliance_team",
                    },
                    {
                        type: "create_alert",
                        target: "critical",
                    },
                ],
                enabled: true,
            },
            {
                id: "critical-severity",
                name: "Critical Severity Escalation",
                tenantId,
                conditions: [
                    {
                        type: "severity",
                        operator: "equals",
                        value: "CRITICAL",
                    },
                ],
                actions: [
                    {
                        type: "notify_manager",
                        target: "executive_team",
                    },
                    {
                        type: "create_alert",
                        target: "critical",
                    },
                ],
                enabled: true,
            },
            {
                id: "no-response-24h",
                name: "No Response 24 Hours",
                tenantId,
                conditions: [
                    {
                        type: "no_response",
                        operator: "greater_than",
                        value: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
                    },
                ],
                actions: [
                    {
                        type: "reassign",
                        target: "senior_team",
                    },
                ],
                enabled: true,
            },
            {
                id: "regulatory-deadline",
                name: "Regulatory Deadline",
                tenantId,
                conditions: [
                    {
                        type: "regulatory_deadline",
                        operator: "less_than",
                        value: 7 * 24 * 60 * 60 * 1000, // 7 days
                    },
                ],
                actions: [
                    {
                        type: "notify_compliance",
                        target: "compliance_team",
                    },
                ],
                enabled: true,
            },
        ];
    }
    /**
     * Evaluate escalation conditions
     */
    async evaluateConditions(case_, conditions) {
        for (const condition of conditions) {
            const met = await this.evaluateCondition(case_, condition);
            if (!met) {
                return false;
            }
        }
        return true;
    }
    /**
     * Evaluate single condition
     */
    async evaluateCondition(case_, condition) {
        switch (condition.type) {
            case "sla_deadline":
                return this.evaluateSLACondition(case_, condition);
            case "severity":
                return this.evaluateSeverityCondition(case_, condition);
            case "status":
                return this.evaluateStatusCondition(case_, condition);
            case "no_response":
                return await this.evaluateNoResponseCondition(case_, condition);
            case "regulatory_deadline":
                return this.evaluateRegulatoryCondition(case_, condition);
            default:
                return false;
        }
    }
    /**
     * Evaluate SLA deadline condition
     */
    evaluateSLACondition(case_, condition) {
        if (!case_.slaDeadline) {
            return false;
        }
        const now = new Date();
        const deadline = case_.slaDeadline;
        const totalTime = deadline.getTime() - case_.createdAt.getTime();
        const remainingTime = deadline.getTime() - now.getTime();
        const remainingRatio = totalTime > 0 ? remainingTime / totalTime : 0;
        const threshold = condition.value;
        switch (condition.operator) {
            case "less_than":
                return remainingRatio < threshold;
            case "greater_than":
                return remainingRatio > threshold;
            default:
                return false;
        }
    }
    /**
     * Evaluate severity condition
     */
    evaluateSeverityCondition(case_, condition) {
        const caseSeverity = case_.severity;
        const conditionValue = condition.value;
        switch (condition.operator) {
            case "equals":
                return caseSeverity === conditionValue;
            case "in":
                return Array.isArray(condition.value) && condition.value.includes(caseSeverity);
            default:
                return false;
        }
    }
    /**
     * Evaluate status condition
     */
    evaluateStatusCondition(case_, condition) {
        const caseStatus = case_.status;
        const conditionValue = condition.value;
        switch (condition.operator) {
            case "equals":
                return caseStatus === conditionValue;
            case "in":
                return Array.isArray(condition.value) && condition.value.includes(caseStatus);
            default:
                return false;
        }
    }
    /**
     * Evaluate no response condition
     */
    async evaluateNoResponseCondition(case_, condition) {
        if (!case_.assignedTo) {
            return false;
        }
        // Get last activity timestamp
        const lastActivity = await this.getLastActivityTimestamp(case_.id);
        if (!lastActivity) {
            return false;
        }
        const now = Date.now();
        const timeSinceActivity = now - lastActivity.getTime();
        const threshold = condition.value;
        switch (condition.operator) {
            case "greater_than":
                return timeSinceActivity > threshold;
            case "less_than":
                return timeSinceActivity < threshold;
            default:
                return false;
        }
    }
    /**
     * Evaluate regulatory deadline condition
     */
    evaluateRegulatoryCondition(case_, condition) {
        if (!case_.regulatorySensitivity) {
            return false;
        }
        // Check if there's a regulatory deadline in metadata
        const metadata = case_.metadata;
        const regulatoryDeadline = metadata?.regulatoryDeadline;
        if (!regulatoryDeadline) {
            return false;
        }
        const deadline = new Date(regulatoryDeadline);
        const now = new Date();
        const timeUntilDeadline = deadline.getTime() - now.getTime();
        const threshold = condition.value;
        switch (condition.operator) {
            case "less_than":
                return timeUntilDeadline < threshold;
            case "greater_than":
                return timeUntilDeadline > threshold;
            default:
                return false;
        }
    }
    /**
     * Get last activity timestamp for case
     */
    async getLastActivityTimestamp(caseId) {
        // Get most recent comment, status update, or evidence addition
        const [lastComment, events] = await Promise.all([
            client_1.db.caseComment.findFirst({
                where: { caseId },
                orderBy: { createdAt: "desc" },
                select: { createdAt: true },
            }),
            eventStore.query({
                correlation_id: caseId,
            }),
        ]);
        const lastEvent = events.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()).slice(0, 1)[0];
        const timestamps = [
            lastComment?.createdAt,
            lastEvent?.occurred_at ? new Date(lastEvent.occurred_at) : null,
        ].filter(Boolean);
        return timestamps.length > 0 ? new Date(Math.max(...timestamps.map((d) => d.getTime()))) : null;
    }
    /**
     * Execute escalation
     */
    async executeEscalation(case_, rule) {
        // Determine escalation level
        const fromLevel = this.getCurrentEscalationLevel(case_);
        const toLevel = this.getTargetEscalationLevel(rule);
        // Create escalation record
        const escalation = await client_1.db.caseEscalation.create({
            data: {
                caseId: case_.id,
                reason: `Automatic escalation: ${rule.name}`,
                fromLevel,
                toLevel,
                escalatedBy: "system",
            },
        });
        // Execute escalation actions
        for (const action of rule.actions) {
            await this.executeAction(case_, action);
        }
        // Emit event
        await eventStore.append({
            event_id: crypto_1.default.randomUUID(),
            tenant_id: case_.tenantId,
            actor_id: "system",
            type: "case.escalated",
            occurred_at: new Date().toISOString(),
            correlation_id: case_.id,
            schema_version: "1.0",
            evidence_refs: [],
            payload: {
                case_id: case_.id,
                escalation_id: escalation.id,
                rule_name: rule.name,
                from_level: fromLevel,
                to_level: toLevel,
            },
            signatures: [],
        });
        logger_1.logger.info("Case escalated", {
            tenant_id: case_.tenantId,
            case_id: case_.id,
            escalation_id: escalation.id,
            rule_name: rule.name,
            from_level: fromLevel,
            to_level: toLevel,
        });
        metrics_1.metrics.increment("case_escalations_total", {
            tenant_id: case_.tenantId,
            rule_id: rule.id,
        });
        return escalation;
    }
    /**
     * Get current escalation level
     */
    getCurrentEscalationLevel(case_) {
        if (case_.severity === "CRITICAL") {
            return "executive";
        }
        if (case_.severity === "HIGH") {
            return "manager";
        }
        if (case_.assignedTeam) {
            return "team";
        }
        return "agent";
    }
    /**
     * Get target escalation level from rule
     */
    getTargetEscalationLevel(rule) {
        // Determine target level from actions
        if (rule.actions.some((a) => a.target === "executive_team")) {
            return "executive";
        }
        if (rule.actions.some((a) => a.target === "case_manager")) {
            return "manager";
        }
        if (rule.actions.some((a) => a.target === "compliance_team")) {
            return "compliance";
        }
        if (rule.actions.some((a) => a.target === "senior_team")) {
            return "senior";
        }
        return "team";
    }
    /**
     * Execute escalation action
     */
    async executeAction(case_, action) {
        switch (action.type) {
            case "notify_manager":
                await this.notifyManager(case_, action.target);
                break;
            case "reassign":
                await this.reassignCase(case_, action.target);
                break;
            case "create_alert":
                await this.createAlert(case_, action.target);
                break;
            case "notify_compliance":
                await this.notifyCompliance(case_, action.target);
                break;
            case "trigger_playbook":
                await this.triggerPlaybook(case_, action);
                break;
        }
    }
    /**
     * Notify manager
     */
    async notifyManager(case_, target) {
        // Get manager email from tenant configuration or user roles
        const managers = await client_1.db.user.findMany({
            where: {
                tenantId: case_.tenantId,
                role: {
                    in: ["ADMIN", "APPROVER"],
                },
            },
            select: { email: true },
        });
        for (const manager of managers) {
            await notifications_1.caseNotificationsService.sendInternalNotification(case_.id, case_.tenantId, `Case ${case_.caseNumber} requires attention: ${case_.severity} severity, ${case_.status} status`, undefined);
        }
    }
    /**
     * Reassign case
     */
    async reassignCase(case_, target) {
        // Get senior team members
        const seniorTeam = await client_1.db.user.findMany({
            where: {
                tenantId: case_.tenantId,
                role: "APPROVER",
            },
            select: { id: true },
            take: 1,
        });
        if (seniorTeam.length > 0) {
            await client_1.db.case.update({
                where: { id: case_.id },
                data: {
                    assignedTo: seniorTeam[0].id,
                    assignedTeam: target,
                },
            });
        }
    }
    /**
     * Create alert
     */
    async createAlert(case_, target) {
        // Create alert in alerting system
        // This would integrate with the existing alerting system
        logger_1.logger.info("Alert created for case escalation", {
            case_id: case_.id,
            target,
        });
    }
    /**
     * Notify compliance team
     */
    async notifyCompliance(case_, target) {
        // Get compliance team emails
        const complianceTeam = await client_1.db.user.findMany({
            where: {
                tenantId: case_.tenantId,
                role: "APPROVER",
            },
            select: { email: true },
        });
        for (const member of complianceTeam) {
            await notifications_1.caseNotificationsService.sendInternalNotification(case_.id, case_.tenantId, `Regulatory case ${case_.caseNumber} requires compliance review`, undefined);
        }
    }
    /**
     * Trigger playbook
     */
    async triggerPlaybook(case_, action) {
        // Trigger emergency playbook
        logger_1.logger.info("Playbook triggered for case escalation", {
            case_id: case_.id,
            playbook: action.parameters?.playbookId,
        });
    }
    /**
     * Resolve escalation
     */
    async resolveEscalation(escalationId, resolvedBy) {
        await client_1.db.caseEscalation.update({
            where: { id: escalationId },
            data: {
                resolvedAt: new Date(),
            },
        });
        logger_1.logger.info("Escalation resolved", {
            escalation_id: escalationId,
            resolved_by: resolvedBy,
        });
    }
}
exports.CaseEscalationService = CaseEscalationService;
exports.caseEscalationService = new CaseEscalationService();
