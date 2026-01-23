/**
 * Enhanced Belief Graph Engineering (BGE)
 * 
 * POS: Makes negative content structurally irrelevant to decision-making
 * - Weak node detection (negative reviews become weak nodes)
 * - Structural irrelevance scoring
 * - Narrative activation tracking
 * - Trust reinforcement/decay modeling
 */

import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseBeliefGraphService } from "@/lib/graph/belief-implementation";
import type { BeliefNode, BeliefEdge } from "@/lib/graph/belief";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

const eventStore = new DatabaseEventStore();
const beliefGraph = new DatabaseBeliefGraphService();

export interface WeakNodeAnalysis {
  nodeId: string;
  trustScore: number;
  decisiveness: number;
  structuralIrrelevance: number; // 0-1, higher = more irrelevant
  reinforcingEdges: number;
  neutralizationEdges: number;
  decayEdges: number;
  isWeak: boolean;
  recommendation: "isolate" | "neutralize" | "decay" | "reinforce";
}

export interface NarrativeActivation {
  narrativeId: string;
  activationScore: number; // 0-1, how likely to activate distrust
  trustConversion: number; // -1 to 1, converts skepticism to trust
  evidenceStrength: number; // 0-1
  consensusAlignment: number; // 0-1, alignment with consensus signals
}

export class EnhancedBeliefGraphEngineering {
  /**
   * Analyze node for structural irrelevance
   * Negative content becomes irrelevant when it has:
   * - Low trust score
   * - Low decisiveness
   * - No reinforcing edges
   * - Only decay/neutralization edges
   */
  async analyzeStructuralIrrelevance(
    tenantId: string,
    nodeId: string
  ): Promise<WeakNodeAnalysis> {
    const node = await db.beliefNode.findUnique({
      where: { id: nodeId },
      include: {
        fromEdges: true,
        toEdges: true,
      },
    });

    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Calculate edge counts
    const reinforcingEdges = node.toEdges.filter(
      (e) => e.type === "REINFORCEMENT"
    ).length;
    const neutralizationEdges = node.toEdges.filter(
      (e) => e.type === "NEUTRALIZATION"
    ).length;
    const decayEdges = node.toEdges.filter((e) => e.type === "DECAY").length;

    // Calculate structural irrelevance score
    // Higher score = more irrelevant to decision-making
    let irrelevanceScore = 0;

    // Low trust score contributes to irrelevance
    if (node.trustScore < 0) {
      irrelevanceScore += 0.3 * Math.abs(node.trustScore);
    }

    // Low decisiveness contributes to irrelevance
    irrelevanceScore += 0.2 * (1 - node.decisiveness);

    // No reinforcing edges = isolated/irrelevant
    if (reinforcingEdges === 0) {
      irrelevanceScore += 0.3;
    }

    // Many neutralization/decay edges = actively suppressed
    const suppressionRatio =
      (neutralizationEdges + decayEdges) /
      Math.max(1, reinforcingEdges + neutralizationEdges + decayEdges);
    irrelevanceScore += 0.2 * suppressionRatio;

    // Clamp to 0-1
    irrelevanceScore = Math.min(1, Math.max(0, irrelevanceScore));

    const isWeak = irrelevanceScore >= 0.6;

    // Determine recommendation
    let recommendation: "isolate" | "neutralize" | "decay" | "reinforce";
    if (node.trustScore < -0.5) {
      recommendation = "neutralize"; // Actively neutralize very negative content
    } else if (isWeak && reinforcingEdges === 0) {
      recommendation = "isolate"; // Already isolated, keep it that way
    } else if (node.trustScore < 0) {
      recommendation = "decay"; // Let it decay naturally
    } else {
      recommendation = "reinforce"; // Positive content, reinforce it
    }

    const analysis: WeakNodeAnalysis = {
      nodeId,
      trustScore: node.trustScore,
      decisiveness: node.decisiveness,
      structuralIrrelevance: irrelevanceScore,
      reinforcingEdges,
      neutralizationEdges,
      decayEdges,
      isWeak,
      recommendation,
    };

    // Emit metrics
    metrics.histogram("bge.structural_irrelevance_score", irrelevanceScore, {
      tenant_id: tenantId,
      node_id: nodeId,
    });

    logger.debug("Structural irrelevance analyzed", {
      tenantId,
      nodeId,
      irrelevanceScore,
      isWeak,
    });

    return analysis;
  }

  /**
   * Track narrative activation - how likely a narrative is to activate distrust
   */
  async analyzeNarrativeActivation(
    tenantId: string,
    narrativeNodeId: string
  ): Promise<NarrativeActivation> {
    const node = await db.beliefNode.findUnique({
      where: { id: narrativeNodeId },
      include: {
        fromEdges: true,
        toEdges: true,
      },
    });

    if (!node || node.type !== "NARRATIVE") {
      throw new Error(`Narrative node ${narrativeNodeId} not found`);
    }

    // Calculate activation score (likelihood to activate distrust)
    // Negative trust score + high decisiveness = high activation
    let activationScore = 0;
    if (node.trustScore < 0) {
      activationScore = Math.abs(node.trustScore) * node.decisiveness;
    }

    // Calculate trust conversion (how well it converts skepticism to trust)
    // Positive trust score + high decisiveness = good conversion
    const trustConversion = node.trustScore * node.decisiveness;

    // Evidence strength from connected proof points
    const proofPointNodeIds = node.toEdges
      .filter((e) => e.type === "REINFORCEMENT")
      .map((e) => e.toNodeId);
    const proofPointNodes = await db.beliefNode.findMany({
      where: {
        id: { in: proofPointNodeIds },
        type: "PROOF_POINT",
      },
    });
    const evidenceStrength = Math.min(
      1,
      proofPointNodes.length / 3
    ); // Normalize to 0-1

    // Consensus alignment (check consensus signals)
    const consensusSignals = await db.consensusSignal.findMany({
      where: {
        tenantId,
        relatedNodeIds: { has: narrativeNodeId },
      },
      take: 10,
    });

    const avgConsensusTrust =
      consensusSignals.length > 0
        ? consensusSignals.reduce(
            (sum, s) => sum + s.trustScore,
            0
          ) / consensusSignals.length
        : 0.5;
    const consensusAlignment = Math.max(0, Math.min(1, avgConsensusTrust));

    const activation: NarrativeActivation = {
      narrativeId: narrativeNodeId,
      activationScore,
      trustConversion,
      evidenceStrength,
      consensusAlignment,
    };

    // Emit metrics
    metrics.histogram("bge.narrative_activation_score", activationScore, {
      tenant_id: tenantId,
      narrative_id: narrativeNodeId,
    });

    logger.debug("Narrative activation analyzed", {
      tenantId,
      narrativeNodeId,
      activationScore,
      trustConversion,
    });

    return activation;
  }

  /**
   * Make negative content structurally irrelevant
   * Creates neutralization/decay edges to isolate weak nodes
   */
  async makeStructurallyIrrelevant(
    tenantId: string,
    nodeId: string,
    strategy: "isolate" | "neutralize" | "decay" = "neutralize"
  ): Promise<string[]> {
    const analysis = await this.analyzeStructuralIrrelevance(tenantId, nodeId);

    if (!analysis.isWeak) {
      logger.warn("Node is not weak, skipping structural irrelevance", {
        tenantId,
        nodeId,
        irrelevanceScore: analysis.structuralIrrelevance,
      });
      return [];
    }

    const createdEdgeIds: string[] = [];

    // Find positive proof points to create neutralization edges
    const positiveProofPoints = await db.beliefNode.findMany({
      where: {
        tenantId,
        type: "PROOF_POINT",
        trustScore: { gt: 0.5 },
      },
      take: 3,
    });

    if (strategy === "neutralize" && positiveProofPoints.length > 0) {
      // Create neutralization edges from proof points to negative node
      for (const proofPoint of positiveProofPoints) {
        const edgeId = await beliefGraph.upsertEdge({
          tenant_id: tenantId,
          from_node_id: proofPoint.id,
          to_node_id: nodeId,
          type: "neutralization",
          weight: -0.5, // Neutralize negative content
          actor_weights: {},
        });
        createdEdgeIds.push(edgeId);
      }
    }

    if (strategy === "decay") {
      // Create decay edges to accelerate time decay
      const decayEdgeId = await beliefGraph.upsertEdge({
        tenant_id: tenantId,
        from_node_id: nodeId,
        to_node_id: nodeId, // Self-decay (will be handled specially)
        type: "decay",
        weight: -0.8, // Strong decay
        actor_weights: {},
      });
      createdEdgeIds.push(decayEdgeId);
    }

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: tenantId,
      actor_id: "bge-service",
      type: "bge.structural_irrelevance_applied",
      occurred_at: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      schema_version: "1.0",
      evidence_refs: [],
      payload: {
        node_id: nodeId,
        strategy,
        edge_ids: createdEdgeIds,
        irrelevance_score: analysis.structuralIrrelevance,
      },
      signatures: [],
    });

    logger.info("Made node structurally irrelevant", {
      tenantId,
      nodeId,
      strategy,
      edgesCreated: createdEdgeIds.length,
    });

    return createdEdgeIds;
  }

  /**
   * Find weak nodes that should be made irrelevant
   */
  async findWeakNodes(
    tenantId: string,
    options?: {
      minIrrelevance?: number;
      limit?: number;
    }
  ): Promise<WeakNodeAnalysis[]> {
    try {
      const nodes = await db.beliefNode.findMany({
        where: {
          tenantId,
          trustScore: { lt: 0 }, // Negative trust
        },
        take: options?.limit || 50,
      });

      if (nodes.length === 0) {
        return [];
      }

      const analyses = await Promise.allSettled(
        nodes.map((node) =>
          this.analyzeStructuralIrrelevance(tenantId, node.id)
        )
      );

      // Filter out failed analyses and extract successful ones
      const successfulAnalyses = analyses
        .filter((result): result is PromiseFulfilledResult<WeakNodeAnalysis> => 
          result.status === "fulfilled"
        )
        .map((result) => result.value);

      // Log any failures
      const failures = analyses.filter((result) => result.status === "rejected");
      if (failures.length > 0) {
        logger.warn("Some weak node analyses failed", {
          tenantId,
          total: nodes.length,
          failed: failures.length,
          errors: failures.map((f) => 
            f.status === "rejected" ? f.reason : undefined
          ),
        });
      }

      // Filter by minimum irrelevance score
      const filtered = options?.minIrrelevance
        ? successfulAnalyses.filter(
            (a) => a.structuralIrrelevance >= options.minIrrelevance!
          )
        : successfulAnalyses;

      // Sort by irrelevance score (highest first)
      return filtered.sort(
        (a, b) => b.structuralIrrelevance - a.structuralIrrelevance
      );
    } catch (error) {
      logger.error("Failed to find weak nodes", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return empty array on error rather than throwing
      return [];
    }
  }
}
