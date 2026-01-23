/**
 * Autonomous Analysis Automation
 * 
 * Fully autonomous analysis: claim extraction, clustering, adversarial detection,
 * safety evaluation, and CAPA linking.
 */

import { ClaimExtractionService } from "@/lib/claims/extraction";
import { DatabaseClaimClusteringService } from "@/lib/claims/clustering";
import { AdversarialOrchestrator } from "@/lib/adversarial/orchestrator";
import { SafetyOrchestrator } from "@/lib/evaluation/safety-orchestrator";
import { CAPAService } from "@/lib/capa/service";
import { CustomerResolutionService } from "@/lib/resolution/service";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export interface AnalysisResult {
  claims_extracted: number;
  clusters_created: number;
  adversarial_detections: number;
  safety_checks_passed: boolean;
  capa_actions_created: number;
  resolutions_created: number;
  errors: number;
  duration_ms: number;
}

export class AnalysisAutomation {
  private claimExtractor: ClaimExtractionService;
  private claimClustering: DatabaseClaimClusteringService;
  private adversarialOrchestrator: AdversarialOrchestrator;
  private safetyOrchestrator: SafetyOrchestrator;
  private capaService: CAPAService;
  private resolutionService: CustomerResolutionService;
  private evidenceVault: DatabaseEvidenceVault;

  constructor() {
    this.evidenceVault = new DatabaseEvidenceVault();
    const eventStore = new DatabaseEventStore();
    this.claimExtractor = new ClaimExtractionService(this.evidenceVault, eventStore);
    this.claimClustering = new DatabaseClaimClusteringService();
    this.adversarialOrchestrator = new AdversarialOrchestrator();
    this.safetyOrchestrator = new SafetyOrchestrator();
    this.capaService = new CAPAService();
    this.resolutionService = new CustomerResolutionService();
  }

  /**
   * Execute autonomous analysis
   */
  async execute(tenantId: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    let claimsExtracted = 0;
    let clustersCreated = 0;
    let adversarialDetections = 0;
    let safetyChecksPassed = true;
    let capaActionsCreated = 0;
    let resolutionsCreated = 0;
    let errors = 0;

    try {
      // Get recent evidence
      const evidence = await this.evidenceVault.query({
        tenant_id: tenantId,
        created_after: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      });

      // Extract claims (autonomous)
      const allClaimIds: string[] = [];
      for (const ev of evidence.slice(0, 100)) {
        try {
          const claims = await this.claimExtractor.extractClaims(ev.evidence_id, {
            use_llm: true,
          });
          allClaimIds.push(...claims.map((c) => c.claim_id));
          claimsExtracted += claims.length;
        } catch (error) {
          errors++;
          logger.warn("Failed to extract claims", {
            error: error instanceof Error ? error.message : String(error),
            evidence_id: ev.evidence_id,
          });
        }
      }

      // Cluster claims (autonomous)
      const claimRecords = await db.claim.findMany({
        where: {
          id: { in: allClaimIds },
          tenantId,
        },
      });

      const clusters = await this.claimClustering.clusterClaims(
        tenantId,
        claimRecords.map((c) => ({
          claim_id: c.id,
          tenant_id: tenantId,
          canonical_text: c.canonicalText,
          variants: c.variants,
          decisiveness: c.decisiveness,
          evidence_refs: [],
          created_at: c.createdAt.toISOString(),
        }))
      );
      clustersCreated = clusters.length;

      // Detect adversarial patterns (autonomous)
      for (const ev of evidence.slice(0, 50)) {
        try {
          const adversarial = await this.adversarialOrchestrator.detectAdversarialPatterns(
            ev.evidence_id,
            tenantId
          );
          if (adversarial.overall_risk !== "low") {
            adversarialDetections++;
          }
        } catch (error) {
          errors++;
          logger.warn("Failed to detect adversarial patterns", {
            error: error instanceof Error ? error.message : String(error),
            evidence_id: ev.evidence_id,
          });
        }
      }

      // Run safety checks (autonomous)
      for (const cluster of clusters.slice(0, 10)) {
        try {
          const primaryClaim = await db.claim.findUnique({
            where: { id: cluster.primary_claim.claim_id },
            include: {
              evidenceRefs: true,
            },
          });

          if (primaryClaim) {
            const safety = await this.safetyOrchestrator.evaluateSafety(
              primaryClaim.canonicalText,
              tenantId,
              {
                claim_id: primaryClaim.id,
                evidence_refs: primaryClaim.evidenceRefs.map((r) => r.evidenceId),
              }
            );

            if (!safety.overall_safe) {
              safetyChecksPassed = false;
            }
          }
        } catch (error) {
          errors++;
          logger.warn("Failed to run safety check", {
            error: error instanceof Error ? error.message : String(error),
            cluster_id: cluster.cluster_id,
          });
        }
      }

      // Create CAPA actions for high-decisiveness clusters (autonomous)
      for (const cluster of clusters.filter((c) => c.decisiveness > 0.7)) {
        try {
          await this.capaService.createCorrectiveAction(
            tenantId,
            cluster.cluster_id,
            `Address claim: ${cluster.primary_claim.canonical_text.substring(0, 100)}`,
            "Automated corrective action for high-decisiveness claim cluster",
            {
              priority: "HIGH",
            }
          );
          capaActionsCreated++;
        } catch (error) {
          errors++;
          logger.warn("Failed to create CAPA action", {
            error: error instanceof Error ? error.message : String(error),
            cluster_id: cluster.cluster_id,
          });
        }
      }

      // Create customer resolutions for high-priority clusters (autonomous)
      for (const cluster of clusters.filter((c) => c.decisiveness > 0.8)) {
        try {
          await this.resolutionService.createResolution(
            tenantId,
            cluster.cluster_id,
            "CLARIFICATION",
            `Clarification needed: ${cluster.primary_claim.canonical_text.substring(0, 100)}`,
            "Automated resolution for high-decisiveness claim cluster",
            {
              priority: "HIGH",
            }
          );
          resolutionsCreated++;
        } catch (error) {
          errors++;
          logger.warn("Failed to create resolution", {
            error: error instanceof Error ? error.message : String(error),
            cluster_id: cluster.cluster_id,
          });
        }
      }

      return {
        claims_extracted: claimsExtracted,
        clusters_created: clustersCreated,
        adversarial_detections: adversarialDetections,
        safety_checks_passed: safetyChecksPassed,
        capa_actions_created: capaActionsCreated,
        resolutions_created: resolutionsCreated,
        errors,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      logger.error("Autonomous analysis failed", {
        error: error instanceof Error ? error.message : String(error),
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        claims_extracted: claimsExtracted,
        clusters_created: clustersCreated,
        adversarial_detections: adversarialDetections,
        safety_checks_passed: false,
        capa_actions_created: capaActionsCreated,
        resolutions_created: resolutionsCreated,
        errors: errors + 1,
        duration_ms: Date.now() - startTime,
      };
    }
  }
}
