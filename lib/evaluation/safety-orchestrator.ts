/**
 * Safety Evaluation Orchestrator
 * 
 * Unified orchestrator for all safety evaluation checks:
 * - Citation-grounded verification
 * - Defamation detection
 * - Privacy safety
 * - Consistency checking
 * - Escalation detection
 */

import { logger } from "@/lib/logging/logger";
import { CitationGroundedChecker } from "./citation-grounded-check";
import { DefamationChecker } from "./defamation-check";
import { PrivacySafetyChecker } from "./privacy-safety-check";
import { ConsistencyChecker } from "./consistency-check";
import { EscalationChecker } from "./escalation-check";

export interface SafetyEvaluationResult {
  claim_id?: string;
  artifact_id?: string;
  citation_grounded: {
    passed: boolean;
    score: number;
    issues: string[];
  };
  defamation: {
    passed: boolean;
    risk_level: "none" | "low" | "medium" | "high";
    issues: string[];
  };
  privacy_safe: {
    passed: boolean;
    pii_detected: boolean;
    compliance_issues: string[];
  };
  consistent: {
    passed: boolean;
    consistency_score: number;
    inconsistencies: string[];
  };
  non_escalating: {
    passed: boolean;
    escalation_risk: "none" | "low" | "medium" | "high";
    issues: string[];
  };
  overall_safe: boolean;
  created_at: string;
}

export class SafetyOrchestrator {
  private citationChecker: CitationGroundedChecker;
  private defamationChecker: DefamationChecker;
  private privacyChecker: PrivacySafetyChecker;
  private consistencyChecker: ConsistencyChecker;
  private escalationChecker: EscalationChecker;

  constructor() {
    this.citationChecker = new CitationGroundedChecker();
    this.defamationChecker = new DefamationChecker();
    this.privacyChecker = new PrivacySafetyChecker();
    this.consistencyChecker = new ConsistencyChecker();
    this.escalationChecker = new EscalationChecker();
  }

  /**
   * Evaluate safety for claim or artifact
   */
  async evaluateSafety(
    content: string,
    tenantId: string,
    options?: {
      claim_id?: string;
      artifact_id?: string;
      evidence_refs?: string[];
      previous_content?: string;
    }
  ): Promise<SafetyEvaluationResult> {
    try {
      // Run all safety checks in parallel
      const [citation, defamation, privacy, consistency, escalation] = await Promise.all([
        this.citationChecker.check(content, options?.evidence_refs || []).catch((e) => {
          logger.warn("Citation check failed", { error: e });
          return { passed: false, score: 0, issues: ["Citation check failed"] };
        }),
        this.defamationChecker.check(content, tenantId).catch((e) => {
          logger.warn("Defamation check failed", { error: e });
          return { passed: true, risk_level: "none" as const, issues: [] };
        }),
        this.privacyChecker.check(content, tenantId).catch((e) => {
          logger.warn("Privacy check failed", { error: e });
          return { passed: true, pii_detected: false, compliance_issues: [] };
        }),
        options?.previous_content
          ? this.consistencyChecker.check(content, options.previous_content, tenantId).catch((e) => {
              logger.warn("Consistency check failed", { error: e });
              return { passed: true, consistency_score: 1.0, inconsistencies: [] };
            })
          : Promise.resolve({ passed: true, consistency_score: 1.0, inconsistencies: [] }),
        this.escalationChecker.check(content, tenantId).catch((e) => {
          logger.warn("Escalation check failed", { error: e });
          return { passed: true, escalation_risk: "none" as const, issues: [] };
        }),
      ]);

      // Determine overall safety
      const overallSafe =
        citation.passed &&
        defamation.risk_level === "none" &&
        privacy.passed &&
        consistency.passed &&
        escalation.escalation_risk === "none";

      return {
        claim_id: options?.claim_id,
        artifact_id: options?.artifact_id,
        citation_grounded: citation,
        defamation,
        privacy_safe: privacy,
        consistent: consistency,
        non_escalating: escalation,
        overall_safe: overallSafe,
        created_at: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to evaluate safety", {
        error: error instanceof Error ? error.message : String(error),
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
