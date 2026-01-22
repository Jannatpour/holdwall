/**
 * Citation Quality Rules (AI Governance)
 * Enforce citation requirements and quality standards for AI-generated content
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { AIAnswerEvaluationHarness } from "@/lib/evaluation/harness";

export interface CitationRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  enabled: boolean;
  minCitations: number;
  maxCitations?: number;
  requiredTypes: string[];
  qualityThreshold: number;
  enforcement: "WARNING" | "BLOCK" | "REQUIRE_FIX";
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CitationValidationResult {
  valid: boolean;
  score: number;
  violations: string[];
  warnings: string[];
  citations: {
    count: number;
    types: string[];
    quality: number;
  };
}

export class CitationRulesService {
  private evaluationHarness: AIAnswerEvaluationHarness;

  constructor() {
    this.evaluationHarness = new AIAnswerEvaluationHarness();
  }

  /**
   * Create a citation rule
   */
  async create(
    tenantId: string,
    name: string,
    options: {
      description?: string;
      minCitations?: number;
      maxCitations?: number;
      requiredTypes?: string[];
      qualityThreshold?: number;
      enforcement?: "WARNING" | "BLOCK" | "REQUIRE_FIX";
      metadata?: Record<string, unknown>;
    }
  ): Promise<string> {
    const rule = await db.citationRule.create({
      data: {
        tenantId,
        name,
        description: options.description,
        enabled: true,
        minCitations: options.minCitations || 1,
        maxCitations: options.maxCitations,
        requiredTypes: options.requiredTypes || [],
        qualityThreshold: options.qualityThreshold || 0.7,
        enforcement: options.enforcement || "WARNING",
        metadata: options.metadata as any,
      },
    });

    logger.info("Citation rule created", {
      tenantId,
      name,
      enforcement: options.enforcement || "WARNING",
    });

    return rule.id;
  }

  /**
   * Validate citations in content against rules
   */
  async validate(
    tenantId: string,
    content: string,
    citations: string[],
    evidenceIds?: string[]
  ): Promise<CitationValidationResult> {
    // Get active rules for tenant
    const rules = await db.citationRule.findMany({
      where: {
        tenantId,
        enabled: true,
      },
    });

    if (rules.length === 0) {
      // No rules, always valid
      return {
        valid: true,
        score: 1.0,
        violations: [],
        warnings: [],
        citations: {
          count: citations.length,
          types: [],
          quality: 1.0,
        },
      };
    }

    const violations: string[] = [];
    const warnings: string[] = [];
    let overallScore = 1.0;

    // Extract citations from content (markdown-style [1], [evidence-id], etc.)
    const citationMatches = content.match(/\[([^\]]+)\]/g) || [];
    const extractedCitations = citationMatches.map((match) => match.slice(1, -1));

    // Evaluate citation quality using evaluation harness
    let citationQuality = 1.0;
    if (evidenceIds && evidenceIds.length > 0) {
      try {
        const evaluation = await this.evaluationHarness.evaluate(
          content,
          content, // Using content as both prompt and response for evaluation
          evidenceIds,
          { tenantId }
        );
        citationQuality = evaluation.citation_capture_score;
        overallScore = evaluation.overall_score;
      } catch (error) {
        logger.warn("Citation quality evaluation failed", { error });
      }
    }

    // Check each rule
    for (const rule of rules) {
      // Check minimum citations
      if (extractedCitations.length < rule.minCitations) {
        const violation = `Minimum citations not met: ${extractedCitations.length} < ${rule.minCitations}`;
        if (rule.enforcement === "BLOCK" || rule.enforcement === "REQUIRE_FIX") {
          violations.push(violation);
        } else {
          warnings.push(violation);
        }
        overallScore = Math.min(overallScore, 0.5);
      }

      // Check maximum citations
      if (rule.maxCitations && extractedCitations.length > rule.maxCitations) {
        const violation = `Maximum citations exceeded: ${extractedCitations.length} > ${rule.maxCitations}`;
        if (rule.enforcement === "BLOCK") {
          violations.push(violation);
        } else {
          warnings.push(violation);
        }
      }

      // Check quality threshold
      if (citationQuality < rule.qualityThreshold) {
        const violation = `Citation quality below threshold: ${citationQuality.toFixed(2)} < ${rule.qualityThreshold}`;
        if (rule.enforcement === "BLOCK" || rule.enforcement === "REQUIRE_FIX") {
          violations.push(violation);
        } else {
          warnings.push(violation);
        }
        overallScore = Math.min(overallScore, citationQuality);
      }

      // Check required types (if specified)
      if (rule.requiredTypes.length > 0) {
        // Simple type detection based on citation format
        const citationTypes = extractedCitations.map((cite) => {
          if (cite.startsWith("evidence-")) return "evidence" as const;
          if (cite.startsWith("claim-")) return "claim" as const;
          if (cite.startsWith("forecast-")) return "forecast" as const;
          return "unknown" as const;
        });

        const missingTypes = rule.requiredTypes.filter(
          (type) => !citationTypes.includes(type as "evidence" | "claim" | "forecast" | "unknown")
        );

        if (missingTypes.length > 0) {
          const violation = `Required citation types missing: ${missingTypes.join(", ")}`;
          if (rule.enforcement === "BLOCK" || rule.enforcement === "REQUIRE_FIX") {
            violations.push(violation);
          } else {
            warnings.push(violation);
          }
        }
      }
    }

    const valid = violations.length === 0;

    return {
      valid,
      score: overallScore,
      violations,
      warnings,
      citations: {
        count: extractedCitations.length,
        types: Array.from(new Set(extractedCitations.map((c) => {
          if (c.startsWith("evidence-")) return "evidence" as const;
          if (c.startsWith("claim-")) return "claim" as const;
          if (c.startsWith("forecast-")) return "forecast" as const;
          return "unknown" as const;
        }))),
        quality: citationQuality,
      },
    };
  }

  /**
   * List rules for a tenant
   */
  async list(tenantId: string, enabledOnly: boolean = false): Promise<CitationRule[]> {
    const where: any = {
      tenantId,
    };

    if (enabledOnly) {
      where.enabled = true;
    }

    const rules = await db.citationRule.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return rules.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      name: r.name,
      description: r.description || undefined,
      enabled: r.enabled,
      minCitations: r.minCitations,
      maxCitations: r.maxCitations || undefined,
      requiredTypes: (r.requiredTypes || []) as string[],
      qualityThreshold: r.qualityThreshold,
      enforcement: r.enforcement as CitationRule["enforcement"],
      metadata: (r.metadata as Record<string, unknown>) || undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })) as CitationRule[];
  }

  /**
   * Update a rule
   */
  async update(
    ruleId: string,
    updates: {
      enabled?: boolean;
      minCitations?: number;
      maxCitations?: number;
      qualityThreshold?: number;
      enforcement?: "WARNING" | "BLOCK" | "REQUIRE_FIX";
    }
  ): Promise<void> {
    await db.citationRule.update({
      where: { id: ruleId },
      data: updates as any,
    });

    logger.info("Citation rule updated", {
      ruleId,
      updates,
    });
  }

  /**
   * Delete a rule
   */
  async delete(ruleId: string): Promise<void> {
    await db.citationRule.delete({
      where: { id: ruleId },
    });

    logger.info("Citation rule deleted", {
      ruleId,
    });
  }
}

export const citationRulesService = new CitationRulesService();
