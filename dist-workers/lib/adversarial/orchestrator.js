"use strict";
/**
 * Adversarial Detection Orchestrator
 *
 * Unified orchestrator for all adversarial detection capabilities:
 * - Coordinated amplification
 * - Sockpuppet detection
 * - Claim template matching
 * - Cross-platform seeding
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdversarialOrchestrator = void 0;
const logger_1 = require("@/lib/logging/logger");
const coordinated_amplification_1 = require("./coordinated-amplification");
const sockpuppet_detector_1 = require("./sockpuppet-detector");
const claim_template_matcher_1 = require("./claim-template-matcher");
const cross_platform_seeder_1 = require("./cross-platform-seeder");
const client_1 = require("@/lib/db/client");
class AdversarialOrchestrator {
    constructor() {
        this.amplificationDetector = new coordinated_amplification_1.CoordinatedAmplificationDetector();
        this.sockpuppetDetector = new sockpuppet_detector_1.SockpuppetDetector();
        this.templateMatcher = new claim_template_matcher_1.ClaimTemplateMatcher();
        this.crossPlatformSeeder = new cross_platform_seeder_1.CrossPlatformSeeder();
    }
    /**
     * Detect all adversarial patterns for evidence
     */
    async detectAdversarialPatterns(evidenceId, tenantId) {
        try {
            // Get evidence and related signals
            const evidence = await client_1.db.evidence.findUnique({
                where: { id: evidenceId },
                include: {
                    claimRefs: {
                        include: {
                            claim: true,
                        },
                    },
                },
            });
            if (!evidence || evidence.tenantId !== tenantId) {
                throw new Error("Evidence not found or tenant mismatch");
            }
            // Run all detection algorithms
            const [amplification, sockpuppet, template, seeding] = await Promise.all([
                this.amplificationDetector.detect(evidenceId, tenantId).catch((e) => {
                    logger_1.logger.warn("Amplification detection failed", { error: e, evidenceId });
                    return { detected: false, confidence: 0, indicators: [] };
                }),
                this.sockpuppetDetector.detect(evidenceId, tenantId).catch((e) => {
                    logger_1.logger.warn("Sockpuppet detection failed", { error: e, evidenceId });
                    return { detected: false, confidence: 0, cluster_id: undefined, indicators: [] };
                }),
                this.templateMatcher.match(evidenceId, tenantId).catch((e) => {
                    logger_1.logger.warn("Template matching failed", { error: e, evidenceId });
                    return { detected: false, confidence: 0, template_id: undefined, similarity: 0 };
                }),
                this.crossPlatformSeeder.detect(evidenceId, tenantId).catch((e) => {
                    logger_1.logger.warn("Cross-platform seeding detection failed", { error: e, evidenceId });
                    return { detected: false, confidence: 0, platforms: [], timing_correlation: 0 };
                }),
            ]);
            // Calculate overall risk
            const riskScores = [
                amplification.detected ? amplification.confidence : 0,
                sockpuppet.detected ? sockpuppet.confidence : 0,
                template.detected ? template.confidence : 0,
                seeding.detected ? seeding.confidence : 0,
            ];
            const maxRisk = Math.max(...riskScores);
            let overallRisk;
            if (maxRisk >= 0.8) {
                overallRisk = "critical";
            }
            else if (maxRisk >= 0.6) {
                overallRisk = "high";
            }
            else if (maxRisk >= 0.4) {
                overallRisk = "medium";
            }
            else {
                overallRisk = "low";
            }
            const result = {
                evidence_id: evidenceId,
                tenant_id: tenantId,
                coordinated_amplification: amplification.detected
                    ? {
                        detected: true,
                        confidence: amplification.confidence,
                        indicators: amplification.indicators,
                    }
                    : undefined,
                sockpuppet: sockpuppet.detected
                    ? {
                        detected: true,
                        confidence: sockpuppet.confidence,
                        cluster_id: sockpuppet.cluster_id,
                        indicators: sockpuppet.indicators,
                    }
                    : undefined,
                claim_template: template.detected
                    ? {
                        detected: true,
                        confidence: template.confidence,
                        template_id: template.template_id,
                        similarity: template.similarity,
                    }
                    : undefined,
                cross_platform_seeding: seeding.detected
                    ? {
                        detected: true,
                        confidence: seeding.confidence,
                        platforms: seeding.platforms,
                        timing_correlation: seeding.timing_correlation,
                    }
                    : undefined,
                overall_risk: overallRisk,
                created_at: new Date().toISOString(),
            };
            // Store detection result
            await this.storeDetectionResult(result);
            return result;
        }
        catch (error) {
            logger_1.logger.error("Failed to detect adversarial patterns", {
                error: error instanceof Error ? error.message : String(error),
                evidence_id: evidenceId,
                tenant_id: tenantId,
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }
    /**
     * Store detection result in database
     */
    async storeDetectionResult(result) {
        try {
            // Check if pattern already exists
            const existing = await client_1.db.adversarialPattern.findFirst({
                where: {
                    tenantId: result.tenant_id,
                    evidenceId: result.evidence_id,
                    patternType: "MULTI",
                },
            });
            if (existing) {
                // Update existing
                await client_1.db.adversarialPattern.update({
                    where: { id: existing.id },
                    data: {
                        confidence: this.calculateOverallConfidence(result),
                        indicators: this.extractAllIndicators(result),
                        metadata: result,
                    },
                });
            }
            else {
                // Create new
                await client_1.db.adversarialPattern.create({
                    data: {
                        tenantId: result.tenant_id,
                        evidenceId: result.evidence_id,
                        patternType: "MULTI",
                        confidence: this.calculateOverallConfidence(result),
                        indicators: this.extractAllIndicators(result),
                        metadata: result,
                    },
                });
            }
        }
        catch (error) {
            logger_1.logger.warn("Failed to store adversarial detection result", {
                error: error instanceof Error ? error.message : String(error),
                evidence_id: result.evidence_id,
            });
        }
    }
    /**
     * Calculate overall confidence score
     */
    calculateOverallConfidence(result) {
        const confidences = [
            result.coordinated_amplification?.confidence || 0,
            result.sockpuppet?.confidence || 0,
            result.claim_template?.confidence || 0,
            result.cross_platform_seeding?.confidence || 0,
        ].filter((c) => c > 0);
        if (confidences.length === 0) {
            return 0;
        }
        // Use maximum confidence (if any pattern detected, use highest)
        return Math.max(...confidences);
    }
    /**
     * Extract all indicators from result
     */
    extractAllIndicators(result) {
        const indicators = [];
        if (result.coordinated_amplification?.indicators) {
            indicators.push(...result.coordinated_amplification.indicators);
        }
        if (result.sockpuppet?.indicators) {
            indicators.push(...result.sockpuppet.indicators);
        }
        if (result.claim_template?.template_id) {
            indicators.push(`Claim template match: ${result.claim_template.template_id}`);
        }
        if (result.cross_platform_seeding?.platforms.length) {
            indicators.push(`Cross-platform seeding across: ${result.cross_platform_seeding.platforms.join(", ")}`);
        }
        return indicators;
    }
}
exports.AdversarialOrchestrator = AdversarialOrchestrator;
