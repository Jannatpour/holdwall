/**
 * Approval Agent
 * 
 * Intelligent approval routing agent.
 * Part of the 8-agent autonomous architecture.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import type { Case, CaseResolution, UserRole } from "@prisma/client";

export interface ApprovalDecision {
  requiresApproval: boolean;
  approvalLevel: "low" | "medium" | "high" | "executive";
  requiredApprovers: string[];
  reason: string;
  riskScore: number; // 0-1
}

/**
 * Approval Agent
 * 
 * Intelligent approval routing
 */
export class ApprovalAgent {
  /**
   * Determine if case requires approval
   */
  async determineApprovalNecessity(
    case_: Case,
    resolution?: CaseResolution
  ): Promise<ApprovalDecision> {
    // Calculate risk score
    const riskScore = this.calculateRiskScore(case_, resolution);

    // Determine approval necessity
    let requiresApproval = false;
    let approvalLevel: "low" | "medium" | "high" | "executive" = "low";
    const requiredApprovers: string[] = [];
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
    const metadata = case_.metadata as Record<string, unknown> | null;
    const financialImpact = metadata?.financialImpact as number | undefined;
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
  private calculateRiskScore(case_: Case, resolution?: CaseResolution): number {
    let score = 0;

    // Severity weight: 30%
    const severityScores: Record<string, number> = {
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
    const metadata = case_.metadata as Record<string, unknown> | null;
    const financialImpact = metadata?.financialImpact as number | undefined;
    if (financialImpact) {
      const impactScore = Math.min(1, financialImpact / 50000); // Normalize to 0-1
      score += impactScore * 0.2;
    }

    // Case type: 15%
    const typeScores: Record<string, number> = {
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
  async routeToApprovers(
    case_: Case,
    approvalDecision: ApprovalDecision
  ): Promise<string[]> {
    const approvers: string[] = [];

    // Get approvers based on level
    switch (approvalDecision.approvalLevel) {
      case "executive":
        const executives = await db.user.findMany({
          where: {
            tenantId: case_.tenantId,
            role: { in: ["ADMIN", "APPROVER"] },
          },
          select: { id: true },
        });
        approvers.push(...executives.map((e) => e.id));
        break;

      case "high":
        const managers = await db.user.findMany({
          where: {
            tenantId: case_.tenantId,
            role: { in: ["ADMIN", "APPROVER"] },
          },
          select: { id: true },
        });
        approvers.push(...managers.map((m) => m.id));
        break;

      case "medium":
        const seniorAgents = await db.user.findMany({
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
      if (!role) continue;
      const users = await db.user.findMany({
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
  private mapApproverTypeToRole(approverType: string): UserRole | null {
    // Current `UserRole` enum is restricted (USER | ADMIN | APPROVER | VIEWER).
    // Map all approval-requiring groups to APPROVER (and ADMIN is handled above).
    const mapping: Record<string, UserRole> = {
      compliance_team: "APPROVER",
      executive_team: "ADMIN",
      finance_team: "APPROVER",
    };
    return mapping[approverType] || "APPROVER";
  }

  /**
   * Auto-approve low-risk cases
   */
  async autoApprove(caseId: string, tenantId: string): Promise<boolean> {
    const case_ = await db.case.findFirst({
      where: { id: caseId, tenantId },
    });

    if (!case_) {
      return false;
    }

    const resolution = await db.caseResolution.findUnique({
      where: { caseId },
    });

    const decision = await this.determineApprovalNecessity(case_, resolution || undefined);

    // Auto-approve if low risk and no specific requirements
    if (!decision.requiresApproval || decision.approvalLevel === "low") {
      if (resolution) {
        await db.caseResolution.update({
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

export const approvalAgent = new ApprovalAgent();
