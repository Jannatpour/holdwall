/**
 * Production Belief Graph Implementation
 * Database-backed belief graph
 */

import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import type { BeliefNode, BeliefEdge, BeliefPath } from "./belief";

const eventStore = new DatabaseEventStore();

export class DatabaseBeliefGraphService {
  private calibrationEngine: Promise<import("@/lib/graph/calibration").CalibrationEngine> | null = null;

  private getCalibrationEngine(): Promise<import("@/lib/graph/calibration").CalibrationEngine> {
    if (!this.calibrationEngine) {
      this.calibrationEngine = (async () => {
        const { CalibrationEngine } = await import("@/lib/graph/calibration");
        return new CalibrationEngine();
      })();
    }
    return this.calibrationEngine;
  }

  async upsertNode(node: Omit<BeliefNode, "node_id" | "created_at">): Promise<string> {
    // Apply calibration to trust score if calibration model exists
    let calibratedTrustScore = node.trust_score;
    try {
      const calibration = await this.getCalibrationEngine();
      const calibrated = calibration.calibrate(`${node.tenant_id}:trust`, node.trust_score);
      calibratedTrustScore = calibrated.calibrated_score;
    } catch (error) {
      // If calibration fails, use raw score
    }

    const result = await db.beliefNode.create({
      data: {
        tenantId: node.tenant_id,
        type: node.type.toUpperCase() as any,
        content: node.content,
        trustScore: calibratedTrustScore,
        decisiveness: node.decisiveness,
        actorWeights: node.actor_weights as any,
        decayFactor: node.decay_factor,
      },
    });

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: node.tenant_id,
      actor_id: "belief-graph",
      type: "graph.node.created",
      occurred_at: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      schema_version: "1.0",
      evidence_refs: [],
      payload: {
        node_id: result.id,
        type: node.type,
      },
      signatures: [],
    });

    return result.id;
  }

  async upsertEdge(edge: Omit<BeliefEdge, "edge_id" | "created_at">): Promise<string> {
    const result = await db.beliefEdge.create({
      data: {
        tenantId: edge.tenant_id,
        fromNodeId: edge.from_node_id,
        toNodeId: edge.to_node_id,
        type: edge.type.toUpperCase() as any,
        weight: edge.weight,
        actorWeights: edge.actor_weights as any,
      },
    });

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: edge.tenant_id,
      actor_id: "belief-graph",
      type: "graph.edge.created",
      occurred_at: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      schema_version: "1.0",
      evidence_refs: [],
      payload: {
        edge_id: result.id,
        from_node_id: edge.from_node_id,
        to_node_id: edge.to_node_id,
        type: edge.type,
      },
      signatures: [],
    });

    return result.id;
  }

  async findPaths(
    from_node_id: string,
    to_node_id: string,
    max_depth: number = 5,
    options?: {
      actor_id?: string;
      edge_types?: Array<"reinforcement" | "neutralization" | "decay">;
      min_strength?: number;
    }
  ): Promise<BeliefPath[]> {
    // Enhanced pathfinding with actor weighting and edge type filtering
    const paths: BeliefPath[] = [];
    const queue: Array<{
      path: string[];
      depth: number;
      trust_impact: number;
      strength: number;
      edges: string[];
    }> = [
      { path: [from_node_id], depth: 0, trust_impact: 0, strength: 1, edges: [] },
    ];
    const visited = new Map<string, number>(); // node_id -> best_strength

    while (queue.length > 0 && paths.length < 20) {
      // Sort queue by strength (best first)
      queue.sort((a, b) => b.strength - a.strength);
      const current = queue.shift()!;
      const currentNodeId = current.path[current.path.length - 1];

      if (currentNodeId === to_node_id) {
        // Found a path - fetch nodes and edges
        const nodes = await db.beliefNode.findMany({
          where: { id: { in: current.path } },
        });

        const edgeIds = current.edges;
        const edges = await db.beliefEdge.findMany({
          where: { id: { in: edgeIds } },
        });

        // Apply time decay to nodes
        const currentTime = new Date().toISOString();
        const processedNodes = await Promise.all(
          nodes.map(async (n) => {
            const age_ms = new Date(currentTime).getTime() - n.createdAt.getTime();
            const age_days = age_ms / (1000 * 60 * 60 * 24);
            const decayed_trust = n.trustScore * Math.pow(n.decayFactor, age_days);
            const decayed_decisiveness = n.decisiveness * Math.pow(n.decayFactor, age_days);

            // Apply actor weighting if specified
            let final_trust = decayed_trust;
            let final_decisiveness = decayed_decisiveness;
            if (options?.actor_id) {
              const actorWeights = n.actorWeights as Record<string, number> || {};
              const actorWeight = actorWeights[options.actor_id] || 1.0;
              final_trust *= actorWeight;
              final_decisiveness *= actorWeight;
            }

            return {
              node_id: n.id,
              tenant_id: n.tenantId,
              type: n.type.toLowerCase() as any,
              content: n.content,
              trust_score: final_trust,
              decisiveness: final_decisiveness,
              actor_weights: n.actorWeights as any,
              created_at: n.createdAt.toISOString(),
              updated_at: n.updatedAt?.toISOString(),
              decay_factor: n.decayFactor,
            };
          })
        );

        // Calculate path metrics with actor weighting
        let pathTrustImpact = 0;
        let pathStrength = 1;
        for (const edge of edges) {
          let edgeWeight = edge.weight;
          if (options?.actor_id) {
            const actorWeights = edge.actorWeights as Record<string, number> || {};
            const actorWeight = actorWeights[options.actor_id] || 1.0;
            edgeWeight *= actorWeight;
          }

          pathTrustImpact += edgeWeight;
          pathStrength *= Math.abs(edgeWeight) || 0.1;
        }

        // Filter by minimum strength if specified
        if (options?.min_strength && pathStrength < options.min_strength) {
          continue;
        }

        paths.push({
          path_id: `path-${paths.length}`,
          nodes: processedNodes,
          edges: edges.map((e) => ({
            edge_id: e.id,
            tenant_id: e.tenantId,
            from_node_id: e.fromNodeId,
            to_node_id: e.toNodeId,
            type: e.type.toLowerCase() as any,
            weight: e.weight,
            actor_weights: e.actorWeights as any,
            created_at: e.createdAt.toISOString(),
            updated_at: e.updatedAt?.toISOString(),
          })),
          trust_impact: pathTrustImpact,
          strength: pathStrength,
        });
        continue;
      }

      if (current.depth >= max_depth) {
        continue;
      }

      // Skip if we've found a better path to this node
      const existingStrength = visited.get(currentNodeId);
      if (existingStrength && existingStrength >= current.strength) {
        continue;
      }
      visited.set(currentNodeId, current.strength);

      // Get outgoing edges
      const whereClause: any = { fromNodeId: currentNodeId };
      if (options?.edge_types && options.edge_types.length > 0) {
        whereClause.type = { in: options.edge_types.map(t => t.toUpperCase()) };
      }

      const edges = await db.beliefEdge.findMany({
        where: whereClause,
        take: 20,
        orderBy: { weight: "desc" }, // Prefer stronger edges
      });

      for (const edge of edges) {
        if (current.path.includes(edge.toNodeId)) {
          continue; // Avoid cycles
        }

        // Calculate edge contribution with actor weighting
        let edgeWeight = edge.weight;
        if (options?.actor_id) {
          const actorWeights = edge.actorWeights as Record<string, number> || {};
          const actorWeight = actorWeights[options.actor_id] || 1.0;
          edgeWeight *= actorWeight;
        }

        const newTrustImpact = current.trust_impact + edgeWeight;
        const newStrength = current.strength * Math.abs(edgeWeight) || 0.1;

        queue.push({
          path: [...current.path, edge.toNodeId],
          depth: current.depth + 1,
          trust_impact: newTrustImpact,
          strength: newStrength,
          edges: [...current.edges, edge.id],
        });
      }
    }

    // Sort paths by strength (best first)
    return paths.sort((a, b) => b.strength - a.strength);
  }

  async applyTimeDecay(node_id: string, current_time: string): Promise<void> {
    const node = await db.beliefNode.findUnique({
      where: { id: node_id },
    });

    if (!node) {
      return;
    }

    const age_ms =
      new Date(current_time).getTime() - node.createdAt.getTime();
    const age_days = age_ms / (1000 * 60 * 60 * 24);

    const decayed_trust = node.trustScore * Math.pow(node.decayFactor, age_days);
    const decayed_decisiveness = node.decisiveness * Math.pow(node.decayFactor, age_days);

    await db.beliefNode.update({
      where: { id: node_id },
      data: {
        trustScore: decayed_trust,
        decisiveness: decayed_decisiveness,
        updatedAt: new Date(current_time),
      },
    });
  }

  /**
   * Get nodes for a tenant with optional filters
   */
  async getNodes(tenant_id: string, options?: { limit?: number; type?: string }): Promise<BeliefNode[]> {
    const nodes = await db.beliefNode.findMany({
      where: {
        tenantId: tenant_id,
        ...(options?.type ? { type: options.type.toUpperCase() as any } : {}),
      },
      take: options?.limit || 100,
      orderBy: { createdAt: "desc" },
    });

    return nodes.map((n) => ({
      node_id: n.id,
      tenant_id: n.tenantId,
      type: n.type.toLowerCase() as any,
      content: n.content,
      trust_score: n.trustScore,
      decisiveness: n.decisiveness,
      actor_weights: (n.actorWeights as Record<string, number>) || {},
      created_at: n.createdAt.toISOString(),
      updated_at: n.updatedAt?.toISOString(),
      decay_factor: n.decayFactor,
    }));
  }
}
