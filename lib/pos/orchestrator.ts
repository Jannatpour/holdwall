/**
 * POS Orchestrator
 * 
 * Coordinates all POS components to create a unified perception operating system
 */

import { EnhancedBeliefGraphEngineering } from "./belief-graph-engineering";
import { ConsensusHijackingService } from "./consensus-hijacking";
import { AIAnswerAuthorityLayer } from "./ai-answer-authority";
import { NarrativePreemptionEngine } from "./narrative-preemption";
import { TrustSubstitutionMechanism } from "./trust-substitution";
import { DecisionFunnelDomination } from "./decision-funnel-domination";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

export interface POSMetrics {
  bge: {
    weakNodesCount: number;
    averageIrrelevance: number;
  };
  consensus: {
    totalSignals: number;
    consensusStrength: number;
  };
  aaal: {
    citationScore: number;
    publishedContent: number;
  };
  npe: {
    activePredictions: number;
    preemptiveActions: number;
  };
  tsm: {
    trustScore: number;
    validatorCount: number;
  };
  dfd: {
    overallControl: number;
    stageCoverage: number;
  };
  overall: {
    posScore: number; // 0-1, overall POS effectiveness
  };
}

export class POSOrchestrator {
  private bge: EnhancedBeliefGraphEngineering;
  private consensus: ConsensusHijackingService;
  private aaal: AIAnswerAuthorityLayer;
  private npe: NarrativePreemptionEngine;
  private tsm: TrustSubstitutionMechanism;
  private dfd: DecisionFunnelDomination;

  constructor() {
    this.bge = new EnhancedBeliefGraphEngineering();
    this.consensus = new ConsensusHijackingService();
    this.aaal = new AIAnswerAuthorityLayer();
    this.npe = new NarrativePreemptionEngine();
    this.tsm = new TrustSubstitutionMechanism();
    this.dfd = new DecisionFunnelDomination();
  }

  /**
   * Get comprehensive POS metrics
   */
  async getMetrics(tenantId: string): Promise<POSMetrics> {
    // Default values for all metrics
    let weakNodes: any[] = [];
    let averageIrrelevance = 0;
    let consensusMetrics = {
      totalSignals: 0,
      consensusStrength: 0,
    };
    let citationScore = {
      rebuttalScore: 0,
      incidentScore: 0,
      dashboardScore: 0,
      overallScore: 0,
    };
    let activePredictions = 0;
    let preemptiveActions = 0;
    let trustScore = {
      validatorScore: 0.5,
      auditScore: 0,
      slaScore: 0,
      overallScore: 0.5,
    };
    let validatorCount = 0;
    let funnelMetrics = {
      awarenessControl: 0,
      researchControl: 0,
      comparisonControl: 0,
      decisionControl: 0,
      postPurchaseControl: 0,
      overallControl: 0,
    };

    try {
      // BGE metrics
      weakNodes = await this.bge.findWeakNodes(tenantId, { limit: 100 });
      averageIrrelevance =
        weakNodes.length > 0
          ? weakNodes.reduce((sum, n) => sum + n.structuralIrrelevance, 0) /
            weakNodes.length
          : 0;
    } catch (error) {
      logger.error("Failed to get BGE metrics", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      // Consensus metrics
      consensusMetrics = await this.consensus.getConsensusMetrics(tenantId);
    } catch (error) {
      logger.error("Failed to get consensus metrics", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      // AAAL metrics
      citationScore = await this.aaal.getAICitationScore(tenantId);
    } catch (error) {
      logger.error("Failed to get AAAL metrics", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      // NPE metrics
      const { db } = await import("@/lib/db/client");
      activePredictions = await db.predictedComplaint.count({
        where: { tenantId, status: "ACTIVE" },
      });
      preemptiveActions = await db.predictedComplaint.count({
        where: {
          tenantId,
          status: "ADDRESSED",
          preemptiveActionId: { not: null },
        },
      });
    } catch (error) {
      logger.error("Failed to get NPE metrics", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      // TSM metrics
      trustScore = await this.tsm.getTrustSubstitutionScore(tenantId);
      const { db } = await import("@/lib/db/client");
      validatorCount = await db.externalValidator.count({
        where: { tenantId, isActive: true },
      });
    } catch (error) {
      logger.error("Failed to get TSM metrics", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      // DFD metrics
      funnelMetrics = await this.dfd.getFunnelMetrics(tenantId);
    } catch (error) {
      logger.error("Failed to get DFD metrics", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Overall POS score (weighted average)
    const posScore =
      averageIrrelevance * 0.15 + // BGE: structural irrelevance
      consensusMetrics.consensusStrength * 0.2 + // Consensus
      citationScore.overallScore * 0.2 + // AAAL
      (activePredictions > 0 ? 0.1 : 0) + // NPE: active predictions
      trustScore.overallScore * 0.2 + // TSM
      funnelMetrics.overallControl * 0.15; // DFD

    const posMetricsData: POSMetrics = {
      bge: {
        weakNodesCount: weakNodes.length,
        averageIrrelevance,
      },
      consensus: {
        totalSignals: consensusMetrics.totalSignals,
        consensusStrength: consensusMetrics.consensusStrength,
      },
      aaal: {
        citationScore: citationScore.overallScore,
        publishedContent:
          citationScore.rebuttalScore +
          citationScore.incidentScore +
          citationScore.dashboardScore,
      },
      npe: {
        activePredictions,
        preemptiveActions,
      },
      tsm: {
        trustScore: trustScore.overallScore,
        validatorCount,
      },
      dfd: {
        overallControl: funnelMetrics.overallControl,
        stageCoverage:
          (funnelMetrics.awarenessControl > 0 ? 1 : 0) +
          (funnelMetrics.researchControl > 0 ? 1 : 0) +
          (funnelMetrics.comparisonControl > 0 ? 1 : 0) +
          (funnelMetrics.decisionControl > 0 ? 1 : 0) +
          (funnelMetrics.postPurchaseControl > 0 ? 1 : 0),
      },
      overall: {
        posScore,
      },
    };

    // Emit metrics
    Object.entries(posMetricsData).forEach(([component, componentMetrics]) => {
      Object.entries(componentMetrics as Record<string, unknown>).forEach(([key, value]) => {
        if (typeof value === "number") {
          metrics.setGauge(`pos.${component}.${key}`, value, {
            tenant_id: tenantId,
          });
        }
      });
    });

    metrics.setGauge("pos.overall.score", posScore, { tenant_id: tenantId });

    return posMetricsData;
  }

  /**
   * Execute complete POS cycle
   * Runs all POS components in coordination
   */
  async executePOSCycle(tenantId: string): Promise<{
    success: boolean;
    actions: string[];
    metrics: POSMetrics;
  }> {
    const actions: string[] = [];

    try {
      // 1. BGE: Find and neutralize weak nodes
      const weakNodes = await this.bge.findWeakNodes(tenantId, {
        minIrrelevance: 0.6,
        limit: 10,
      });
      for (const node of weakNodes.slice(0, 5)) {
        // Limit to 5 to avoid overwhelming
        // Map "reinforce" to "neutralize" since makeStructurallyIrrelevant doesn't accept "reinforce"
        const strategy = node.recommendation === "reinforce" ? "neutralize" : node.recommendation;
        const edgeIds = await this.bge.makeStructurallyIrrelevant(
          tenantId,
          node.nodeId,
          strategy as "isolate" | "neutralize" | "decay"
        );
        actions.push(`BGE: Made ${node.nodeId} structurally irrelevant`);
      }

      // 2. NPE: Predict and preempt complaints
      const predictionIds = await this.npe.predictComplaints(tenantId, 7);
      for (const predictionId of predictionIds.slice(0, 3)) {
        // Limit to 3
        const action = await this.npe.generatePreemptiveAction(predictionId);
        if (action) {
          actions.push(`NPE: Generated preemptive action for ${predictionId}`);
        }
      }

      // 3. Get metrics
      const posMetrics = await this.getMetrics(tenantId);

      logger.info("POS cycle executed", {
        tenantId,
        actionsCount: actions.length,
        posScore: posMetrics.overall.posScore,
      });

      return {
        success: true,
        actions,
        metrics: posMetrics,
      };
    } catch (error) {
      logger.error("POS cycle execution failed", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get POS recommendations
   */
  async getRecommendations(tenantId: string): Promise<string[]> {
    const recommendations: string[] = [];
    let metrics: POSMetrics;
    
    try {
      metrics = await this.getMetrics(tenantId);
    } catch (error) {
      logger.error("Failed to get metrics for recommendations", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Return default recommendations if metrics fail
      return [
        "Unable to generate recommendations at this time. Please check system status.",
      ];
    }

    // BGE recommendations
    if (metrics.bge.averageIrrelevance < 0.5) {
      recommendations.push(
        "Increase structural irrelevance of negative content by creating more neutralization edges."
      );
    }

    // Consensus recommendations
    if (metrics.consensus.consensusStrength < 0.6) {
      recommendations.push(
        "Create more consensus signals (third-party analyses, expert commentary) to strengthen consensus."
      );
    }

    // AAAL recommendations
    if (metrics.aaal.citationScore < 0.7) {
      recommendations.push(
        "Publish more rebuttal documents, incident explanations, and metrics dashboards to improve AI citation score."
      );
    }

    // NPE recommendations
    if (metrics.npe.activePredictions === 0) {
      recommendations.push(
        "Run complaint prediction to identify potential issues before they trend."
      );
    }

    // TSM recommendations
    try {
      const tsmRecommendation = await this.tsm.generateRecommendation(tenantId);
      if (tsmRecommendation !== "No specific recommendations.") {
        recommendations.push(tsmRecommendation);
      }
    } catch (error) {
      logger.error("Failed to get TSM recommendations", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // DFD recommendations
    if (metrics.dfd.overallControl < 0.7) {
      recommendations.push(
        "Setup complete funnel control to dominate all decision checkpoints."
      );
    }

    return recommendations;
  }
}
