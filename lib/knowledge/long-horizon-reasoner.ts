/**
 * Long-Horizon Reasoner
 * 
 * Predicts entity state changes and long-term narrative evolution
 * using knowledge graph and temporal patterns.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export interface EntityStatePrediction {
  entity_id: string;
  entity_name: string;
  predicted_state: Record<string, unknown>;
  confidence: number;
  horizon_days: number;
  reasoning: string;
}

export interface NarrativePrediction {
  cluster_id: string;
  predicted_evolution: string;
  confidence: number;
  horizon_days: number;
  factors: string[];
}

export class LongHorizonReasoner {
  /**
   * Predict entity state changes
   */
  async predictEntityState(
    entityId: string,
    tenantId: string,
    horizonDays: number = 30
  ): Promise<EntityStatePrediction | null> {
    try {
      const entity = await db.entity.findUnique({
        where: { id: entityId },
        include: {
          events: {
            orderBy: { changedAt: "desc" },
            take: 10,
          },
          fromRelations: {
            include: {
              toEntity: true,
            },
          },
          toRelations: {
            include: {
              fromEntity: true,
            },
          },
        },
      });

      if (!entity || entity.tenantId !== tenantId) {
        return null;
      }

      const currentState = entity.currentState as Record<string, unknown>;
      const history = (entity.stateHistory as any[]) || [];

      // Analyze trends
      const trends = this.analyzeTrends(history);

      // Predict future state based on trends
      const predictedState = { ...currentState };
      let confidence = 0.5;
      const reasoning: string[] = [];

      // Predict ownership changes
      if (trends.ownership_changes > 0) {
        confidence += 0.2;
        reasoning.push(`Historical ownership change frequency: ${trends.ownership_changes}`);
      }

      // Predict based on relationships
      if (entity.fromRelations.length > 0 || entity.toRelations.length > 0) {
        confidence += 0.1;
        reasoning.push(`Entity has ${entity.fromRelations.length + entity.toRelations.length} relationships`);
      }

      confidence = Math.min(1.0, confidence);

      return {
        entity_id: entityId,
        entity_name: entity.name,
        predicted_state: predictedState,
        confidence,
        horizon_days: horizonDays,
        reasoning: reasoning.join("; "),
      };
    } catch (error) {
      logger.error("Failed to predict entity state", {
        error: error instanceof Error ? error.message : String(error),
        entity_id: entityId,
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Predict narrative evolution
   */
  async predictNarrativeEvolution(
    clusterId: string,
    tenantId: string,
    horizonDays: number = 30
  ): Promise<NarrativePrediction | null> {
    try {
      const cluster = await db.claimCluster.findUnique({
        where: { id: clusterId },
        include: {
          claims: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });

      if (!cluster || cluster.tenantId !== tenantId) {
        return null;
      }

      // Analyze claim trends
      const claimTrends = this.analyzeClaimTrends(cluster.claims);

      // Predict evolution
      let predictedEvolution = "Stable";
      let confidence = 0.5;
      const factors: string[] = [];

      if (claimTrends.velocity > 5) {
        predictedEvolution = "Increasing attention";
        confidence += 0.2;
        factors.push(`High claim velocity: ${claimTrends.velocity} claims/day`);
      }

      if (claimTrends.decisiveness_trend > 0.1) {
        predictedEvolution = "Becoming more decisive";
        confidence += 0.2;
        factors.push(`Decisiveness increasing: ${(claimTrends.decisiveness_trend * 100).toFixed(0)}%`);
      }

      confidence = Math.min(1.0, confidence);

      return {
        cluster_id: clusterId,
        predicted_evolution: predictedEvolution,
        confidence,
        horizon_days: horizonDays,
        factors,
      };
    } catch (error) {
      logger.error("Failed to predict narrative evolution", {
        error: error instanceof Error ? error.message : String(error),
        cluster_id: clusterId,
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Analyze trends from entity history
   */
  private analyzeTrends(history: any[]): {
    ownership_changes: number;
    state_changes: number;
    change_frequency: number;
  } {
    const ownershipChanges = history.filter((h) => h.state?.owner).length;
    const stateChanges = history.length;
    const timeSpan = history.length > 1
      ? new Date(history[history.length - 1].timestamp).getTime() -
        new Date(history[0].timestamp).getTime()
      : 0;
    const changeFrequency = timeSpan > 0 ? stateChanges / (timeSpan / (24 * 60 * 60 * 1000)) : 0;

    return {
      ownership_changes: ownershipChanges,
      state_changes: stateChanges,
      change_frequency: changeFrequency,
    };
  }

  /**
   * Analyze claim trends
   */
  private analyzeClaimTrends(claims: any[]): {
    velocity: number;
    decisiveness_trend: number;
  } {
    if (claims.length < 2) {
      return { velocity: 0, decisiveness_trend: 0 };
    }

    // Calculate velocity (claims per day)
    const timeSpan = new Date(claims[0].createdAt).getTime() - new Date(claims[claims.length - 1].createdAt).getTime();
    const days = timeSpan / (24 * 60 * 60 * 1000);
    const velocity = days > 0 ? claims.length / days : 0;

    // Calculate decisiveness trend
    const recentDecisiveness = claims.slice(0, Math.floor(claims.length / 2)).reduce((sum, c) => sum + c.decisiveness, 0) / Math.floor(claims.length / 2);
    const olderDecisiveness = claims.slice(Math.floor(claims.length / 2)).reduce((sum, c) => sum + c.decisiveness, 0) / Math.ceil(claims.length / 2);
    const decisivenessTrend = recentDecisiveness - olderDecisiveness;

    return {
      velocity,
      decisiveness_trend: decisivenessTrend,
    };
  }
}
