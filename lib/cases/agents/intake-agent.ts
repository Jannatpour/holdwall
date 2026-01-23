/**
 * Intake Agent
 * 
 * Autonomous case creation and enrichment agent.
 * Part of the 8-agent autonomous architecture.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { AIOrchestrator } from "@/lib/ai/orchestrator";
import type { CaseType } from "@prisma/client";

const evidenceVault = new DatabaseEvidenceVault();
const orchestrator = new AIOrchestrator(evidenceVault);

export interface IntakeInput {
  tenantId: string;
  submittedBy: string;
  submittedByEmail?: string;
  submittedByName?: string;
  rawDescription: string;
  files?: File[];
  metadata?: Record<string, unknown>;
}

export interface EnrichedCase {
  type: CaseType;
  description: string;
  impact?: string;
  preferredResolution?: string;
  regulatorySensitivity: boolean;
  suggestedSeverity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
}

/**
 * Intake Agent
 * 
 * Autonomous case creation and enrichment
 */
export class IntakeAgent {
  /**
   * Process intake and create enriched case
   */
  async processIntake(input: IntakeInput): Promise<EnrichedCase> {
    // Auto-detect case type from description
    const detectedType = await this.detectCaseType(input.rawDescription, input.tenantId);

    // Enrich description with AI
    const enrichedDescription = await this.enrichDescription(
      input.rawDescription,
      detectedType,
      input.tenantId
    );

    // Extract impact and preferred resolution
    const { impact, preferredResolution } = await this.extractAdditionalInfo(
      input.rawDescription,
      input.tenantId
    );

    // Detect regulatory sensitivity
    const regulatorySensitivity = await this.detectRegulatorySensitivity(
      input.rawDescription,
      detectedType,
      input.tenantId
    );

    // Suggest initial severity
    const suggestedSeverity = await this.suggestSeverity(
      input.rawDescription,
      detectedType,
      regulatorySensitivity,
      input.tenantId
    );

    // Calculate confidence
    const confidence = this.calculateConfidence(
      input.rawDescription,
      detectedType,
      regulatorySensitivity
    );

    return {
      type: detectedType,
      description: enrichedDescription,
      impact,
      preferredResolution,
      regulatorySensitivity,
      suggestedSeverity,
      confidence,
    };
  }

  /**
   * Auto-detect case type from description
   */
  private async detectCaseType(description: string, tenantId: string): Promise<CaseType> {
    const prompt = `Classify this case description into one of: DISPUTE, FRAUD_ATO, OUTAGE_DELAY, COMPLAINT.

Description: ${description}

Return only the type (DISPUTE, FRAUD_ATO, OUTAGE_DELAY, or COMPLAINT).`;

    try {
      const response = await orchestrator.orchestrate({
        query: prompt,
        tenant_id: tenantId,
        use_rag: true,
        model: "gemini-3-pro",
        temperature: 0.2,
        max_tokens: 50,
      });

      const type = response.response.trim().toUpperCase();
      if (["DISPUTE", "FRAUD_ATO", "OUTAGE_DELAY", "COMPLAINT"].includes(type)) {
        return type as CaseType;
      }
    } catch (error) {
      logger.error("Failed to detect case type", { error });
    }

    // Fallback to COMPLAINT
    return "COMPLAINT";
  }

  /**
   * Enrich description with AI
   */
  private async enrichDescription(
    description: string,
    type: CaseType,
    tenantId: string
  ): Promise<string> {
    // In production, this would enhance the description with context
    // For now, return as-is
    return description;
  }

  /**
   * Extract impact and preferred resolution
   */
  private async extractAdditionalInfo(
    description: string,
    tenantId: string
  ): Promise<{ impact?: string; preferredResolution?: string }> {
    const prompt = `Extract impact and preferred resolution from this case description.

Description: ${description}

Return JSON:
{
  "impact": "Impact description or null",
  "preferredResolution": "Preferred resolution or null"
}`;

    try {
      const response = await orchestrator.orchestrate({
        query: prompt,
        tenant_id: tenantId,
        use_rag: true,
        model: "gemini-3-pro",
        temperature: 0.3,
        max_tokens: 500,
      });

      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          impact: parsed.impact || undefined,
          preferredResolution: parsed.preferredResolution || undefined,
        };
      }
    } catch (error) {
      logger.error("Failed to extract additional info", { error });
    }

    return {};
  }

  /**
   * Detect regulatory sensitivity
   */
  private async detectRegulatorySensitivity(
    description: string,
    type: CaseType,
    tenantId: string
  ): Promise<boolean> {
    const regulatoryKeywords = [
      "regulatory",
      "compliance",
      "cfpb",
      "finra",
      "sec",
      "gdpr",
      "violation",
      "breach",
      "lawsuit",
      "legal action",
    ];

    const descriptionLower = description.toLowerCase();
    return regulatoryKeywords.some((keyword) => descriptionLower.includes(keyword));
  }

  /**
   * Suggest initial severity
   */
  private async suggestSeverity(
    description: string,
    type: CaseType,
    regulatorySensitivity: boolean,
    tenantId: string
  ): Promise<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> {
    if (regulatorySensitivity || type === "FRAUD_ATO") {
      return "HIGH";
    }

    if (type === "DISPUTE") {
      return "MEDIUM";
    }

    return "MEDIUM";
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(
    description: string,
    type: CaseType,
    regulatorySensitivity: boolean
  ): number {
    let confidence = 0.7; // Base confidence

    // Increase confidence with description length
    if (description.length > 100) {
      confidence += 0.1;
    }

    // Increase confidence if type is clear
    if (type !== "COMPLAINT") {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Validate completeness before submission
   */
  async validateCompleteness(input: IntakeInput, enriched: EnrichedCase): Promise<{
    complete: boolean;
    missingFields: string[];
    suggestions: string[];
  }> {
    const missingFields: string[] = [];
    const suggestions: string[] = [];

    if (!input.rawDescription || input.rawDescription.length < 10) {
      missingFields.push("description");
      suggestions.push("Please provide a more detailed description (at least 10 characters)");
    }

    if (!input.submittedBy) {
      missingFields.push("contact");
      suggestions.push("Please provide your email or name");
    }

    // Check if evidence would be helpful
    if (enriched.type === "DISPUTE" && (!input.files || input.files.length === 0)) {
      suggestions.push("Consider uploading transaction receipts or statements for dispute cases");
    }

    return {
      complete: missingFields.length === 0,
      missingFields,
      suggestions,
    };
  }
}

export const intakeAgent = new IntakeAgent();
