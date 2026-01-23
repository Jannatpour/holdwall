/**
 * Coordinated Amplification Detector
 * 
 * Detects coordinated campaigns by analyzing timing, content similarity,
 * and network patterns across signals and claims.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { EmbeddingService } from "@/lib/vector/embeddings";

export interface CoordinatedAmplificationResult {
  detected: boolean;
  confidence: number;
  indicators: string[];
}

export class CoordinatedAmplificationDetector {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Detect coordinated amplification for evidence
   */
  async detect(evidenceId: string, tenantId: string): Promise<CoordinatedAmplificationResult> {
    try {
      // Get evidence
      const evidence = await db.evidence.findUnique({
        where: { id: evidenceId },
      });

      if (!evidence || evidence.tenantId !== tenantId) {
        return { detected: false, confidence: 0, indicators: [] };
      }

      // Get related evidence from same source/timeframe
      const timeWindow = 24 * 60 * 60 * 1000; // 24 hours
      const relatedEvidence = await db.evidence.findMany({
        where: {
          tenantId,
          sourceType: evidence.sourceType,
          createdAt: {
            gte: new Date(new Date(evidence.createdAt).getTime() - timeWindow),
            lte: new Date(new Date(evidence.createdAt).getTime() + timeWindow),
          },
          id: { not: evidenceId },
        },
        take: 100,
      });

      if (relatedEvidence.length < 3) {
        return { detected: false, confidence: 0, indicators: [] };
      }

      const indicators: string[] = [];
      let confidence = 0;

      // Check timing correlation
      const timingScore = this.analyzeTiming(evidence, relatedEvidence);
      if (timingScore > 0.7) {
        indicators.push(`High timing correlation: ${(timingScore * 100).toFixed(0)}%`);
        confidence += 0.3;
      }

      // Check content similarity
      const contentScore = await this.analyzeContentSimilarity(evidence, relatedEvidence);
      if (contentScore > 0.7) {
        indicators.push(`High content similarity: ${(contentScore * 100).toFixed(0)}%`);
        confidence += 0.3;
      }

      // Check network patterns (same source IDs, similar metadata)
      const networkScore = this.analyzeNetworkPatterns(evidence, relatedEvidence);
      if (networkScore > 0.7) {
        indicators.push(`Suspicious network patterns detected`);
        confidence += 0.2;
      }

      // Check velocity (posts per hour)
      const velocity = relatedEvidence.length / (timeWindow / (60 * 60 * 1000));
      if (velocity > 10) {
        indicators.push(`High posting velocity: ${velocity.toFixed(1)} posts/hour`);
        confidence += 0.2;
      }

      const detected = confidence >= 0.5;

      return {
        detected,
        confidence: Math.min(1.0, confidence),
        indicators,
      };
    } catch (error) {
      logger.error("Failed to detect coordinated amplification", {
        error: error instanceof Error ? error.message : String(error),
        evidence_id: evidenceId,
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return { detected: false, confidence: 0, indicators: [] };
    }
  }

  /**
   * Analyze timing correlation
   */
  private analyzeTiming(
    evidence: any,
    relatedEvidence: any[]
  ): number {
    const evidenceTime = new Date(evidence.createdAt).getTime();
    const times = relatedEvidence.map((e) => new Date(e.createdAt).getTime());

    // Calculate time differences
    const timeDiffs = times.map((t) => Math.abs(t - evidenceTime));
    const avgDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
    const maxDiff = Math.max(...timeDiffs);

    // Lower average difference = higher correlation
    const correlation = 1 - Math.min(1, avgDiff / (24 * 60 * 60 * 1000));

    return correlation;
  }

  /**
   * Analyze content similarity using embeddings
   */
  private async analyzeContentSimilarity(
    evidence: any,
    relatedEvidence: any[]
  ): Promise<number> {
    try {
      const content = evidence.contentRaw || evidence.contentNormalized || "";
      if (!content.trim()) {
        return 0;
      }

      const evidenceEmbedding = await this.embeddingService.embed(content);
      const similarities: number[] = [];

      for (const related of relatedEvidence.slice(0, 20)) {
        const relatedContent = related.contentRaw || related.contentNormalized || "";
        if (!relatedContent.trim()) {
          continue;
        }

        const relatedEmbedding = await this.embeddingService.embed(relatedContent);
        const similarity = this.embeddingService.cosineSimilarity(
          evidenceEmbedding.vector,
          relatedEmbedding.vector
        );
        similarities.push(similarity);
      }

      if (similarities.length === 0) {
        return 0;
      }

      // Return average similarity
      return similarities.reduce((a, b) => a + b, 0) / similarities.length;
    } catch (error) {
      logger.warn("Failed to analyze content similarity", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Analyze network patterns
   */
  private analyzeNetworkPatterns(evidence: any, relatedEvidence: any[]): number {
    // Check for same source IDs (potential bot network)
    const sourceIds = new Set(relatedEvidence.map((e) => e.sourceId));
    const sourceIdOverlap = sourceIds.size / relatedEvidence.length;
    // Lower unique source IDs = higher suspicion
    const sourceScore = 1 - sourceIdOverlap;

    // Check metadata similarity
    const evidenceMetadata = JSON.stringify(evidence.metadata || {});
    const metadataMatches = relatedEvidence.filter((e) => {
      const relatedMetadata = JSON.stringify(e.metadata || {});
      return relatedMetadata === evidenceMetadata;
    }).length;
    const metadataScore = metadataMatches / relatedEvidence.length;

    // Combined score
    return (sourceScore * 0.6 + metadataScore * 0.4);
  }
}
