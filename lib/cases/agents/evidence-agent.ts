/**
 * Evidence Agent
 * 
 * Self-directed evidence gathering agent.
 * Part of the 8-agent autonomous architecture.
 */

import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { logger } from "@/lib/logging/logger";
import { paymentProcessorAdapter } from "../integrations/payment-adapter";
import type { Case } from "@prisma/client";

const evidenceVault = new DatabaseEvidenceVault();

export interface EvidenceGatheringResult {
  evidenceIds: string[];
  missingEvidence: string[];
  evidenceQuality: "weak" | "moderate" | "strong";
  recommendations: string[];
}

/**
 * Evidence Agent
 * 
 * Self-directed evidence gathering
 */
export class EvidenceAgent {
  /**
   * Gather evidence for a case
   */
  async gatherEvidence(case_: Case): Promise<EvidenceGatheringResult> {
    const evidenceIds: string[] = [];
    const missingEvidence: string[] = [];
    const recommendations: string[] = [];

    // Get existing evidence
    const existingEvidence = await evidenceVault.query({
      tenant_id: case_.tenantId,
      type: "document",
    });

    // Check for transaction-related evidence if it's a dispute
    if (case_.type === "DISPUTE") {
      const transactionEvidence = await this.gatherTransactionEvidence(case_);
      evidenceIds.push(...transactionEvidence.evidenceIds);
      missingEvidence.push(...transactionEvidence.missing);
      recommendations.push(...transactionEvidence.recommendations);
    }

    // Check for fraud-related evidence
    if (case_.type === "FRAUD_ATO") {
      const fraudEvidence = await this.gatherFraudEvidence(case_);
      evidenceIds.push(...fraudEvidence.evidenceIds);
      missingEvidence.push(...fraudEvidence.missing);
      recommendations.push(...fraudEvidence.recommendations);
    }

    // Assess evidence quality
    const evidenceQuality = this.assessEvidenceQuality(evidenceIds.length, missingEvidence.length);

    return {
      evidenceIds,
      missingEvidence,
      evidenceQuality,
      recommendations,
    };
  }

  /**
   * Gather transaction evidence for disputes
   */
  private async gatherTransactionEvidence(case_: Case): Promise<{
    evidenceIds: string[];
    missing: string[];
    recommendations: string[];
  }> {
    const evidenceIds: string[] = [];
    const missing: string[] = [];
    const recommendations: string[] = [];

    // Extract transaction ID from description or metadata
    const metadata = case_.metadata as Record<string, unknown> | null;
    const transactionId = metadata?.transactionId as string | undefined;
    const processor = metadata?.paymentProcessor as string | undefined;

    if (transactionId && processor) {
      try {
        // Fetch transaction details from payment processor
        const transaction = await paymentProcessorAdapter.fetchTransaction(processor, transactionId);
        if (transaction) {
          // Store transaction evidence
          const evidenceId = await evidenceVault.store({
            tenant_id: case_.tenantId,
            // `DatabaseEvidenceVault` currently supports: metric | artifact | signal | document | external
            type: "document",
            source: {
              type: "api",
              id: transactionId,
              url: undefined,
              collected_at: new Date().toISOString(),
              collected_by: "evidence-agent",
              method: "api",
            },
            content: {
              raw: JSON.stringify(transaction),
              normalized: JSON.stringify(transaction),
              metadata: {
                processor,
                transactionId,
              },
            },
            provenance: {
              collection_method: "api",
              retention_policy: "case_evidence",
              compliance_flags: [],
            },
            metadata: {
              caseId: case_.id,
              collectedBy: "evidence-agent",
            },
          });
          evidenceIds.push(evidenceId);
        }
      } catch (error) {
        logger.error("Failed to fetch transaction evidence", {
          case_id: case_.id,
          transaction_id: transactionId,
          error: error instanceof Error ? error.message : String(error),
        });
        missing.push("Transaction details");
        recommendations.push("Please provide transaction ID and payment processor for automatic evidence gathering");
      }
    } else {
      missing.push("Transaction details");
      recommendations.push("Please provide transaction ID and payment processor");
    }

    return { evidenceIds, missing, recommendations };
  }

  /**
   * Gather fraud evidence
   */
  private async gatherFraudEvidence(case_: Case): Promise<{
    evidenceIds: string[];
    missing: string[];
    recommendations: string[];
  }> {
    const evidenceIds: string[] = [];
    const missing: string[] = [];
    const recommendations: string[] = [];

    // Check for account activity logs
    missing.push("Account activity logs");
    recommendations.push("Please provide account activity logs if available");

    // Check for communication records
    missing.push("Communication records");
    recommendations.push("Please provide any suspicious emails or messages");

    return { evidenceIds, missing, recommendations };
  }

  /**
   * Assess evidence quality
   */
  private assessEvidenceQuality(
    evidenceCount: number,
    missingCount: number
  ): "weak" | "moderate" | "strong" {
    if (evidenceCount === 0) {
      return "weak";
    }

    if (missingCount === 0) {
      return "strong";
    }

    if (evidenceCount > missingCount) {
      return "moderate";
    }

    return "weak";
  }

  /**
   * Detect missing evidence
   */
  async detectMissingEvidence(case_: Case): Promise<string[]> {
    const missing: string[] = [];

    if (case_.type === "DISPUTE") {
      const metadata = case_.metadata as Record<string, unknown> | null;
      if (!metadata?.transactionId) {
        missing.push("Transaction ID");
      }
      if (!metadata?.paymentProcessor) {
        missing.push("Payment processor information");
      }
    }

    if (case_.type === "FRAUD_ATO") {
      missing.push("Account activity logs");
      missing.push("Suspicious communication records");
    }

    return missing;
  }

  /**
   * Assess evidence quality for case
   */
  async assessEvidenceQualityForCase(case_: Case): Promise<{
    quality: "weak" | "moderate" | "strong";
    score: number;
    recommendations: string[];
  }> {
    const existingEvidence = await evidenceVault.query({
      tenant_id: case_.tenantId,
      type: "document",
    });

    const missing = await this.detectMissingEvidence(case_);

    const quality = this.assessEvidenceQuality(existingEvidence.length, missing.length);
    const score = existingEvidence.length / (existingEvidence.length + missing.length);

    return {
      quality,
      score,
      recommendations: missing.map((item) => `Please provide: ${item}`),
    };
  }
}

export const evidenceAgent = new EvidenceAgent();
