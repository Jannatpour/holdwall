"use strict";
/**
 * Approval Agent
 *
 * Intelligent approval routing agent.
 * Part of the 8-agent autonomous architecture.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalAgent = exports.ApprovalAgent = void 0;
const client_1 = require("@/lib/db/client");
/**
 * Approval Agent
 *
 * Intelligent approval routing
 */
class ApprovalAgent {
    /**
     * Determine if case requires approval
     */
    async determineApprovalNecessity(case_, resolution) {
        // Calculate risk score
        const riskScore = this.calculateRiskScore(case_, resolution);
        // Determine approval necessity
        let requiresApproval = false;
        let approvalLevel = "low";
        const requiredApprovers = [];
        let reason = "";
        // High-risk factors
        if (case_.regulatorySensitivity) {
            requiresApproval = true;
            approvalLevel = "high";
            requiredApprovers.push("compliance_team");
            reason = "Regulatory sensitivity requires compliance approval";
        }
        if (case_.severity === "CRITICAL") {
            requiresApproval = true;
            approvalLevel = "executive";
            requiredApprovers.push("executive_team");
            reason = "Critical severity requires executive approval";
        }
        // Financial threshold
        const metadata = case_.metadata;
        const financialImpact = metadata?.financialImpact;
        if (financialImpact && financialImpact > 10000) {
            requiresApproval = true;
            if (approvalLevel === "low") {
                approvalLevel = "medium";
            }
            requiredApprovers.push("finance_team");
            reason = `High financial impact ($${financialImpact.toLocaleString()}) requires approval`;
        }
        // Resolution-specific approval (check status instead of metadata)
        if (resolution && resolution.status === "PENDING_APPROVAL") {
            requiresApproval = true;
            if (approvalLevel === "low") {
                approvalLevel = "medium";
            }
            reason = "Resolution plan requires approval";
        }
        // Risk-based approval
        if (riskScore > 0.7 && !requiresApproval) {
            requiresApproval = true;
            approvalLevel = "medium";
            reason = "High risk score requires approval";
        }
        return {
            requiresApproval,
            approvalLevel,
            requiredApprovers,
            reason,
            riskScore,
        };
    }
    /**
     * Calculate risk score
     */
    calculateRiskScore(case_, resolution) {
        let score = 0;
        // Severity weight: 30%
        const severityScores = {
            LOW: 0.2,
            MEDIUM: 0.4,
            HIGH: 0.7,
            CRITICAL: 1.0,
        };
        score += severityScores[case_.severity] * 0.3;
        // Regulatory sensitivity: 25%
        if (case_.regulatorySensitivity) {
            score += 0.25;
        }
        // Financial impact: 20%
        const metadata = case_.metadata;
        const financialImpact = metadata?.financialImpact;
        if (financialImpact) {
            const impactScore = Math.min(1, financialImpact / 50000); // Normalize to 0-1
            score += impactScore * 0.2;
        }
        // Case type: 15%
        const typeScores = {
            DISPUTE: 0.3,
            FRAUD_ATO: 0.8,
            OUTAGE_DELAY: 0.5,
            COMPLAINT: 0.2,
        };
        score += typeScores[case_.type] * 0.15;
        // Resolution confidence: 10% (use status as proxy)
        if (resolution) {
            // If resolution is in draft, assume lower confidence
            if (resolution.status === "DRAFT") {
                score += 0.1; // Higher risk for draft resolutions
            }
        }
        return Math.min(1, score);
    }
    /**
     * Route to appropriate approvers
     */
    async routeToApprovers(case_, approvalDecision) {
        const approvers = [];
        // Get approvers based on level
        switch (approvalDecision.approvalLevel) {
            case "executive":
                const executives = await client_1.db.user.findMany({
                    where: {
                        tenantId: case_.tenantId,
                        role: { in: ["ADMIN", "APPROVER"] },
                    },
                    select: { id: true },
                });
                approvers.push(...executives.map((e) => e.id));
                break;
            case "high":
                const managers = await client_1.db.user.findMany({
                    where: {
                        tenantId: case_.tenantId,
                        role: { in: ["ADMIN", "APPROVER"] },
                    },
                    select: { id: true },
                });
                approvers.push(...managers.map((m) => m.id));
                break;
            case "medium":
                const seniorAgents = await client_1.db.user.findMany({
                    where: {
                        tenantId: case_.tenantId,
                        role: "APPROVER",
                    },
                    select: { id: true },
                    take: 1,
                });
                approvers.push(...seniorAgents.map((s) => s.id));
                break;
            case "low":
                // Low-level approvals can be auto-approved
                break;
        }
        // Add specific approvers from decision
        for (const approverType of approvalDecision.requiredApprovers) {
            const role = this.mapApproverTypeToRole(approverType);
            if (!role)
                continue;
            const users = await client_1.db.user.findMany({
                where: {
                    tenantId: case_.tenantId,
                    role,
                },
                select: { id: true },
            });
            approvers.push(...users.map((u) => u.id));
        }
        return [...new Set(approvers)]; // Remove duplicates
    }
    /**
     * Map approver type to user role
     */
    mapApproverTypeToRole(approverType) {
        // Current `UserRole` enum is restricted (USER | ADMIN | APPROVER | VIEWER).
        // Map all approval-requiring groups to APPROVER (and ADMIN is handled above).
        const mapping = {
            compliance_team: "APPROVER",
            executive_team: "ADMIN",
            finance_team: "APPROVER",
        };
        return mapping[approverType] || "APPROVER";
    }
    /**
     * Auto-approve low-risk cases
     */
    async autoApprove(caseId, tenantId) {
        const case_ = await client_1.db.case.findFirst({
            where: { id: caseId, tenantId },
        });
        if (!case_) {
            return false;
        }
        const resolution = await client_1.db.caseResolution.findUnique({
            where: { caseId },
        });
        const decision = await this.determineApprovalNecessity(case_, resolution || undefined);
        // Auto-approve if low risk and no specific requirements
        if (!decision.requiresApproval || decision.approvalLevel === "low") {
            if (resolution) {
                await client_1.db.caseResolution.update({
                    where: { caseId },
                    data: {
                        status: "APPROVED",
                    },
                });
            }
            return true;
        }
        return false;
    }
}
exports.ApprovalAgent = ApprovalAgent;
exports.approvalAgent = new ApprovalAgent();
