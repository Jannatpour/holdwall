/**
 * Claim Template Matcher
 * 
 * Detects repeated claim templates using fuzzy matching and semantic similarity.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { EmbeddingService } from "@/lib/vector/embeddings";

export interface ClaimTemplateResult {
  detected: boolean;
  confidence: number;
  template_id?: string;
  similarity: number;
}

export class ClaimTemplateMatcher {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Match claim template for evidence
   */
  async match(evidenceId: string, tenantId: string): Promise<ClaimTemplateResult> {
    try {
      const evidence = await db.evidence.findUnique({
        where: { id: evidenceId },
      });

      if (!evidence || evidence.tenantId !== tenantId) {
        return { detected: false, confidence: 0, similarity: 0 };
      }

      const content = evidence.contentRaw || evidence.contentNormalized || "";
      if (!content.trim()) {
        return { detected: false, confidence: 0, similarity: 0 };
      }

      // Get existing claim templates
      const templates = await db.claimTemplate.findMany({
        where: { tenantId },
        orderBy: { lastSeen: "desc" },
        take: 100,
      });

      if (templates.length === 0) {
        return { detected: false, confidence: 0, similarity: 0 };
      }

      // Check similarity against templates
      let bestMatch: { template: any; similarity: number } | null = null;

      for (const template of templates) {
        const similarity = await this.calculateSimilarity(content, template.canonicalText);
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { template, similarity };
        }
      }

      if (!bestMatch || bestMatch.similarity < 0.7) {
        return { detected: false, confidence: 0, similarity: bestMatch?.similarity || 0 };
      }

      // Update template frequency
      await db.claimTemplate.update({
        where: { id: bestMatch.template.id },
        data: {
          frequency: bestMatch.template.frequency + 1,
          lastSeen: new Date(),
          variants: Array.from(new Set([...bestMatch.template.variants, content.substring(0, 200)])),
        },
      });

      const confidence = Math.min(1.0, bestMatch.similarity * (1 + bestMatch.template.frequency / 10));

      return {
        detected: true,
        confidence,
        template_id: bestMatch.template.templateId,
        similarity: bestMatch.similarity,
      };
    } catch (error) {
      logger.error("Failed to match claim template", {
        error: error instanceof Error ? error.message : String(error),
        evidence_id: evidenceId,
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return { detected: false, confidence: 0, similarity: 0 };
    }
  }

  /**
   * Calculate similarity between content and template
   */
  private async calculateSimilarity(content: string, template: string): Promise<number> {
    try {
      // Use embeddings for semantic similarity
      const contentEmbedding = await this.embeddingService.embed(content);
      const templateEmbedding = await this.embeddingService.embed(template);
      return this.embeddingService.cosineSimilarity(
        contentEmbedding.vector,
        templateEmbedding.vector
      );
    } catch (error) {
      logger.warn("Failed to calculate semantic similarity, using text similarity", {
        error: error instanceof Error ? error.message : String(error),
      });
      // Fallback to simple text similarity
      return this.textSimilarity(content, template);
    }
  }

  /**
   * Simple text similarity (fallback)
   */
  private textSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }

  /**
   * Create claim template from claim
   */
  async createTemplate(
    tenantId: string,
    canonicalText: string,
    variants: string[] = []
  ): Promise<string> {
    const template = await db.claimTemplate.create({
      data: {
        tenantId,
        templateId: `template-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        canonicalText,
        variants,
        frequency: 1,
      },
    });

    return template.templateId;
  }
}
