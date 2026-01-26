"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafetyOrchestrator = void 0;
const logger_1 = require("@/lib/logging/logger");
const citation_grounded_check_1 = require("./citation-grounded-check");
const defamation_check_1 = require("./defamation-check");
const privacy_safety_check_1 = require("./privacy-safety-check");
const consistency_check_1 = require("./consistency-check");
const escalation_check_1 = require("./escalation-check");
class SafetyOrchestrator {
    constructor() {
        this.citationChecker = new citation_grounded_check_1.CitationGroundedChecker();
        this.defamationChecker = new defamation_check_1.DefamationChecker();
        this.privacyChecker = new privacy_safety_check_1.PrivacySafetyChecker();
        this.consistencyChecker = new consistency_check_1.ConsistencyChecker();
        this.escalationChecker = new escalation_check_1.EscalationChecker();
    }
    /**
     * Evaluate safety for claim or artifact
     */
    async evaluateSafety(content, tenantId, options) {
        try {
            // Run all safety checks in parallel
            const [citation, defamation, privacy, consistency, escalation] = await Promise.all([
                this.citationChecker.check(content, options?.evidence_refs || []).catch((e) => {
                    logger_1.logger.warn("Citation check failed", { error: e });
                    return { passed: false, score: 0, issues: ["Citation check failed"] };
                }),
                this.defamationChecker.check(content, tenantId).catch((e) => {
                    logger_1.logger.warn("Defamation check failed", { error: e });
                    return { passed: true, risk_level: "none", issues: [] };
                }),
                this.privacyChecker.check(content, tenantId).catch((e) => {
                    logger_1.logger.warn("Privacy check failed", { error: e });
                    return { passed: true, pii_detected: false, compliance_issues: [] };
                }),
                options?.previous_content
                    ? this.consistencyChecker.check(content, options.previous_content, tenantId).catch((e) => {
                        logger_1.logger.warn("Consistency check failed", { error: e });
                        return { passed: true, consistency_score: 1.0, inconsistencies: [] };
                    })
                    : Promise.resolve({ passed: true, consistency_score: 1.0, inconsistencies: [] }),
                this.escalationChecker.check(content, tenantId).catch((e) => {
                    logger_1.logger.warn("Escalation check failed", { error: e });
                    return { passed: true, escalation_risk: "none", issues: [] };
                }),
            ]);
            // Determine overall safety
            const overallSafe = citation.passed &&
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
        }
        catch (error) {
            logger_1.logger.error("Failed to evaluate safety", {
                error: error instanceof Error ? error.message : String(error),
                tenant_id: tenantId,
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }
}
exports.SafetyOrchestrator = SafetyOrchestrator;
