/**
 * Adversarial Detection Orchestrator
 * 
 * Unified orchestrator for all adversarial detection capabilities:
 * - Coordinated amplification
 * - Sockpuppet detection
 * - Claim template matching
 * - Cross-platform seeding
 */

import { logger } from "@/lib/logging/logger";
import { CoordinatedAmplificationDetector } from "./coordinated-amplification";
import { SockpuppetDetector } from "./sockpuppet-detector";
import { ClaimTemplateMatcher } from "./claim-template-matcher";
import { CrossPlatformSeeder } from "./cross-platform-seeder";
import { db } from "@/lib/db/client";

export interface AdversarialDetectionResult {
  evidence_id: string;
  tenant_id: string;
  coordinated_amplification?: {
    detected: boolean;
    confidence: number;
    indicators: string[];
  };
  sockpuppet?: {
    detected: boolean;
    confidence: number;
    cluster_id?: string;
    indicators: string[];
  };
  claim_template?: {
    detected: boolean;
    confidence: number;
    template_id?: string;
    similarity: number;
  };
  cross_platform_seeding?: {
    detected: boolean;
    confidence: number;
    platforms: string[];
    timing_correlation: number;
  };
  overall_risk: "low" | "medium" | "high" | "critical";
  created_at: string;
}

export class AdversarialOrchestrator {
  private amplificationDetector: CoordinatedAmplificationDetector;
  private sockpuppetDetector: SockpuppetDetector;
  private templateMatcher: ClaimTemplateMatcher;
  private crossPlatformSeeder: CrossPlatformSeeder;

  constructor() {
    this.amplificationDetector = new CoordinatedAmplificationDetector();
    this.sockpuppetDetector = new SockpuppetDetector();
    this.templateMatcher = new ClaimTemplateMatcher();
    this.crossPlatformSeeder = new CrossPlatformSeeder();
  }

  /**
   * Detect all adversarial patterns for evidence
   */
  async detectAdversarialPatterns(
    evidenceId: string,
    tenantId: string
  ): Promise<AdversarialDetectionResult> {
    try {
      // Get evidence and related signals
      const evidence = await db.evidence.findUnique({
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
          logger.warn("Amplification detection failed", { error: e, evidenceId });
          return { detected: false, confidence: 0, indicators: [] };
        }),
        this.sockpuppetDetector.detect(evidenceId, tenantId).catch((e) => {
          logger.warn("Sockpuppet detection failed", { error: e, evidenceId });
          return { detected: false, confidence: 0, cluster_id: undefined, indicators: [] };
        }),
        this.templateMatcher.match(evidenceId, tenantId).catch((e) => {
          logger.warn("Template matching failed", { error: e, evidenceId });
          return { detected: false, confidence: 0, template_id: undefined, similarity: 0 };
        }),
        this.crossPlatformSeeder.detect(evidenceId, tenantId).catch((e) => {
          logger.warn("Cross-platform seeding detection failed", { error: e, evidenceId });
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

      let overallRisk: "low" | "medium" | "high" | "critical";
      if (maxRisk >= 0.8) {
        overallRisk = "critical";
      } else if (maxRisk >= 0.6) {
        overallRisk = "high";
      } else if (maxRisk >= 0.4) {
        overallRisk = "medium";
      } else {
        overallRisk = "low";
      }

      const result: AdversarialDetectionResult = {
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
    } catch (error) {
      logger.error("Failed to detect adversarial patterns", {
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
  private async storeDetectionResult(result: AdversarialDetectionResult): Promise<void> {
    try {
      // Check if pattern already exists
      const existing = await db.adversarialPattern.findFirst({
        where: {
          tenantId: result.tenant_id,
          evidenceId: result.evidence_id,
          patternType: "MULTI",
        },
      });

      if (existing) {
        // Update existing
        await db.adversarialPattern.update({
          where: { id: existing.id },
          data: {
            confidence: this.calculateOverallConfidence(result),
            indicators: this.extractAllIndicators(result),
            metadata: result as any,
          },
        });
      } else {
        // Create new
        await db.adversarialPattern.create({
          data: {
            tenantId: result.tenant_id,
            evidenceId: result.evidence_id,
            patternType: "MULTI",
            confidence: this.calculateOverallConfidence(result),
            indicators: this.extractAllIndicators(result),
            metadata: result as any,
          },
        });
      }
    } catch (error) {
      logger.warn("Failed to store adversarial detection result", {
        error: error instanceof Error ? error.message : String(error),
        evidence_id: result.evidence_id,
      });
    }
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(result: AdversarialDetectionResult): number {
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
  private extractAllIndicators(result: AdversarialDetectionResult): string[] {
    const indicators: string[] = [];

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
      indicators.push(
        `Cross-platform seeding across: ${result.cross_platform_seeding.platforms.join(", ")}`
      );
    }

    return indicators;
  }
}
