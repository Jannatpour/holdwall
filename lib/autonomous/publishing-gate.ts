/**
 * Publishing Gate
 * 
 * Human-gated publishing with legal/comms approval, redaction, and policy compliance checks.
 * Ensures no unauthorized publishing while allowing full autonomy for drafting.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { ApprovalGateway } from "@/lib/engagement/approval-gateway";
import { SafetyOrchestrator } from "@/lib/evaluation/safety-orchestrator";
import { EvidenceRedactionService } from "@/lib/evidence/redaction";

export interface PublishingGateResult {
  allowed: boolean;
  requires_approval: boolean;
  approval_id?: string;
  safety_checks_passed: boolean;
  redaction_required: boolean;
  issues: string[];
}

export class PublishingGate {
  private approvalGateway: ApprovalGateway;
  private safetyOrchestrator: SafetyOrchestrator;
  private redactionService: EvidenceRedactionService;

  constructor() {
    this.approvalGateway = new ApprovalGateway();
    this.safetyOrchestrator = new SafetyOrchestrator();
    this.redactionService = new EvidenceRedactionService();
  }

  /**
   * Check if publishing is allowed (human-gated)
   */
  async checkPublishingGate(
    artifactId: string,
    tenantId: string,
    workspaceId: string | undefined,
    actorId: string
  ): Promise<PublishingGateResult> {
    try {
      const artifact = await db.aAALArtifact.findUnique({
        where: { id: artifactId },
        include: {
          evidenceRefs: true,
        },
      });

      if (!artifact || artifact.tenantId !== tenantId) {
        return {
          allowed: false,
          requires_approval: false,
          safety_checks_passed: false,
          redaction_required: false,
          issues: ["Artifact not found or tenant mismatch"],
        };
      }

      const issues: string[] = [];
      let safetyChecksPassed = true;
      let redactionRequired = false;

      // Run safety checks
      const safety = await this.safetyOrchestrator.evaluateSafety(
        artifact.content,
        tenantId,
        {
          artifact_id: artifactId,
          evidence_refs: artifact.evidenceRefs.map((r) => r.evidenceId),
        }
      );

      if (!safety.overall_safe) {
        safetyChecksPassed = false;
        if (!safety.citation_grounded.passed) {
          issues.push("Citation-grounded check failed");
        }
        if (safety.defamation.risk_level !== "none") {
          issues.push(`Defamation risk: ${safety.defamation.risk_level}`);
        }
        if (!safety.privacy_safe.passed) {
          issues.push("Privacy safety check failed");
          redactionRequired = true;
        }
        if (!safety.consistent.passed) {
          issues.push("Consistency check failed");
        }
        if (safety.non_escalating.escalation_risk !== "none") {
          issues.push(`Escalation risk: ${safety.non_escalating.escalation_risk}`);
        }
      }

      // Always require approval for publishing (human-gated)
      const approval = await this.approvalGateway.requestApproval(
        {
          resourceType: "AAAL_ARTIFACT",
          resourceId: artifactId,
          action: "publish",
          content: artifact.content,
          requesterId: actorId,
          workspaceId: workspaceId,
        },
        tenantId
      );

      const requiresApproval = approval.status === "pending";

      // If redaction required, create redaction request
      if (redactionRequired) {
        // In production, automatically create redaction request
        issues.push("PII detected - redaction required before publishing");
      }

      return {
        allowed: !requiresApproval && safetyChecksPassed && !redactionRequired,
        requires_approval: requiresApproval,
        approval_id: approval.id,
        safety_checks_passed: safetyChecksPassed,
        redaction_required: redactionRequired,
        issues,
      };
    } catch (error) {
      logger.error("Publishing gate check failed", {
        error: error instanceof Error ? error.message : String(error),
        artifact_id: artifactId,
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        allowed: false,
        requires_approval: true,
        safety_checks_passed: false,
        redaction_required: false,
        issues: [`Gate check failed: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }
}
