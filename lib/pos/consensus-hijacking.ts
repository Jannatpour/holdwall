/**
 * Consensus Hijacking (CH)
 * 
 * POS: Creates authentic consensus signals by:
 * - Publishing neutral third-party analyses
 * - Commissioning comparative research
 * - Seeding expert commentary
 * - Amplifying balanced perspectives
 * 
 * Result: "Some complaints exist, but overall consensus indicates X"
 */

import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

const eventStore = new DatabaseEventStore();

export interface ConsensusSignalInput {
  tenantId: string;
  type: "THIRD_PARTY_ANALYSIS" | "EXPERT_COMMENTARY" | "COMPARATIVE_RESEARCH" | "BALANCED_PERSPECTIVE" | "INDEPENDENT_REVIEW";
  title: string;
  content: string;
  source: string;
  sourceUrl?: string;
  author?: string;
  authorCredential?: string;
  publishedAt: Date;
  relevanceScore?: number;
  trustScore?: number;
  amplification?: number;
  evidenceRefs?: string[];
  relatedNodeIds?: string[];
}

export interface ConsensusMetrics {
  totalSignals: number;
  averageTrustScore: number;
  averageRelevanceScore: number;
  consensusStrength: number; // 0-1, overall consensus strength
  coverage: number; // 0-1, how many narratives are covered
}

export class ConsensusHijackingService {
  /**
   * Create a consensus signal
   */
  async createConsensusSignal(
    input: ConsensusSignalInput
  ): Promise<string> {
    // Calculate relevance if not provided
    const relevanceScore =
      input.relevanceScore ??
      (await this.calculateRelevance(input.tenantId, input.content));

    // Calculate trust score if not provided
    const trustScore =
      input.trustScore ?? (await this.calculateTrustScore(input.source, input.author));

    // Calculate amplification if not provided
    const amplification =
      input.amplification ??
      (await this.calculateAmplification(input.type, trustScore));

    const signal = await db.consensusSignal.create({
      data: {
        tenantId: input.tenantId,
        type: input.type,
        title: input.title,
        content: input.content,
        source: input.source,
        sourceUrl: input.sourceUrl,
        author: input.author,
        authorCredential: input.authorCredential,
        publishedAt: input.publishedAt,
        relevanceScore,
        trustScore,
        amplification,
        evidenceRefs: input.evidenceRefs || [],
        relatedNodeIds: input.relatedNodeIds || [],
      },
    });

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      actor_id: "consensus-hijacking",
      type: "consensus.signal.created",
      occurred_at: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      schema_version: "1.0",
      evidence_refs: input.evidenceRefs || [],
      payload: {
        signal_id: signal.id,
        type: input.type,
        source: input.source,
        trust_score: trustScore,
      },
      signatures: [],
    });

    // Emit metrics
    metrics.increment("consensus.signals.created", {
      tenant_id: input.tenantId,
      type: input.type,
    });

    logger.info("Consensus signal created", {
      tenantId: input.tenantId,
      signalId: signal.id,
      type: input.type,
      trustScore,
    });

    return signal.id;
  }

  /**
   * Calculate relevance score for content
   */
  private async calculateRelevance(
    tenantId: string,
    content: string
  ): Promise<number> {
    // Simple keyword matching for now
    // In production, use semantic similarity with tenant's narratives
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return 0.5; // Default relevance
    }

    // Check if content mentions tenant name or related terms
    const tenantName = tenant.name.toLowerCase();
    const contentLower = content.toLowerCase();
    const mentions = contentLower.includes(tenantName) ? 1 : 0;

    // Basic relevance: 0.3 base + 0.7 if mentions tenant
    return 0.3 + 0.7 * mentions;
  }

  /**
   * Calculate trust score for source/author
   */
  private async calculateTrustScore(
    source: string,
    author?: string
  ): Promise<number> {
    // Check if source is a known validator
    const validator = await db.externalValidator.findFirst({
      where: {
        name: { contains: source, mode: "insensitive" },
        isActive: true,
      },
    });

    if (validator) {
      return validator.trustLevel;
    }

    // Default trust scores based on source type
    const sourceLower = source.toLowerCase();
    if (
      sourceLower.includes("university") ||
      sourceLower.includes("research") ||
      sourceLower.includes("institute")
    ) {
      return 0.8; // High trust for research institutions
    }
    if (
      sourceLower.includes("expert") ||
      sourceLower.includes("professor") ||
      author
    ) {
      return 0.7; // Good trust for experts
    }

    return 0.5; // Default trust
  }

  /**
   * Calculate amplification factor
   */
  private async calculateAmplification(
    type: ConsensusSignalInput["type"],
    trustScore: number
  ): Promise<number> {
    // Amplification depends on type and trust
    const typeMultipliers: Record<ConsensusSignalInput["type"], number> = {
      THIRD_PARTY_ANALYSIS: 0.8,
      EXPERT_COMMENTARY: 0.9,
      COMPARATIVE_RESEARCH: 1.0, // Highest amplification
      BALANCED_PERSPECTIVE: 0.7,
      INDEPENDENT_REVIEW: 0.85,
    };

    return typeMultipliers[type] * trustScore;
  }

  /**
   * Get consensus metrics for a tenant
   */
  async getConsensusMetrics(tenantId: string): Promise<ConsensusMetrics> {
    try {
      const signals = await db.consensusSignal.findMany({
        where: { tenantId },
      });

      if (signals.length === 0) {
        return {
          totalSignals: 0,
          averageTrustScore: 0,
          averageRelevanceScore: 0,
          consensusStrength: 0,
          coverage: 0,
        };
      }

      const averageTrustScore =
        signals.reduce((sum, s) => sum + s.trustScore, 0) / signals.length;
      const averageRelevanceScore =
        signals.reduce((sum, s) => sum + s.relevanceScore, 0) / signals.length;

      // Consensus strength = weighted average of trust * amplification
      const consensusStrength =
        signals.reduce(
          (sum, s) => sum + s.trustScore * s.amplification,
          0
        ) / signals.length;

      // Coverage = unique narratives covered / total narratives
      const uniqueNarratives = new Set(
        signals.flatMap((s) => s.relatedNodeIds || [])
      );
      let totalNarratives = 0;
      try {
        totalNarratives = await db.beliefNode.count({
          where: { tenantId, type: "NARRATIVE" },
        });
      } catch (error) {
        logger.warn("Failed to count narrative nodes for coverage", {
          tenantId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      const coverage =
        totalNarratives > 0 ? uniqueNarratives.size / totalNarratives : 0;

      return {
        totalSignals: signals.length,
        averageTrustScore,
        averageRelevanceScore,
        consensusStrength,
        coverage,
      };
    } catch (error) {
      logger.error("Failed to get consensus metrics", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return default metrics on error
      return {
        totalSignals: 0,
        averageTrustScore: 0,
        averageRelevanceScore: 0,
        consensusStrength: 0,
        coverage: 0,
      };
    }
  }

  /**
   * Find consensus signals for a narrative
   */
  async findConsensusForNarrative(
    tenantId: string,
    narrativeNodeId: string
  ) {
    return db.consensusSignal.findMany({
      where: {
        tenantId,
        relatedNodeIds: { has: narrativeNodeId },
      },
      orderBy: { trustScore: "desc" },
      take: 10,
    });
  }

  /**
   * Generate consensus summary
   * "Some complaints exist, but overall consensus indicates X"
   */
  async generateConsensusSummary(
    tenantId: string,
    narrativeNodeId: string
  ): Promise<string> {
    const signals = await this.findConsensusForNarrative(
      tenantId,
      narrativeNodeId
    );

    if (signals.length === 0) {
      return "No consensus signals available for this narrative.";
    }

    const positiveSignals = signals.filter((s) => s.trustScore > 0.6);
    const negativeSignals = signals.filter((s) => s.trustScore < 0.4);

    if (positiveSignals.length > negativeSignals.length * 2) {
      return `Overall consensus from ${signals.length} sources indicates strong support. Some concerns exist, but the majority of expert analysis and third-party research supports this position.`;
    } else if (positiveSignals.length > negativeSignals.length) {
      return `Consensus from ${signals.length} sources is generally positive, though some concerns have been raised. The balance of evidence supports this narrative.`;
    } else {
      return `Consensus signals are mixed. While some sources raise concerns, there is evidence supporting this position from ${positiveSignals.length} sources.`;
    }
  }
}
