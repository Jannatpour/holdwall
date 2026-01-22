/**
 * KAG (Knowledge-Augmented Generation) Pipeline
 * Production KAG implementation for knowledge graph augmentation
 */

import { db } from "@/lib/db/client";
import type { BeliefNode, BeliefEdge } from "@/lib/graph/belief";

export interface KAGContext {
  query: string;
  nodes: BeliefNode[];
  edges: BeliefEdge[];
  knowledge_graph: {
    nodes: Array<{
      id: string;
      content: string;
      trust_score: number;
      type: string;
    }>;
    edges: Array<{
      from: string;
      to: string;
      type: string;
      weight: number;
    }>;
  };
  context: string;
}

export class KAGPipeline {
  /**
   * Retrieve knowledge graph context for a query
   */
  async retrieve(
    query: string,
    tenant_id: string,
    options?: {
      max_nodes?: number;
      max_depth?: number;
    }
  ): Promise<KAGContext> {
    const maxNodes = options?.max_nodes || 20;
    const maxDepth = options?.max_depth || 3;

    // Search for relevant nodes
    const nodes = await db.beliefNode.findMany({
      where: {
        tenantId: tenant_id,
        OR: [
          { content: { contains: query, mode: "insensitive" } },
        ],
      },
      take: maxNodes,
    });

    const nodeIds = nodes.map((n) => n.id);

    // Get edges connecting these nodes
    const edges = await db.beliefEdge.findMany({
      where: {
        tenantId: tenant_id,
        OR: [
          { fromNodeId: { in: nodeIds } },
          { toNodeId: { in: nodeIds } },
        ],
      },
    });

    // Build knowledge graph structure
    const knowledge_graph = {
      nodes: nodes.map((n) => ({
        id: n.id,
        content: n.content,
        trust_score: n.trustScore,
        type: n.type,
      })),
      edges: edges.map((e) => ({
        from: e.fromNodeId,
        to: e.toNodeId,
        type: e.type,
        weight: e.weight,
      })),
    };

    // Build context string
    const contextParts = nodes.map((node) => {
      return `[Node: ${node.type}] ${node.content} (Trust: ${node.trustScore.toFixed(2)})`;
    });

    const context = contextParts.join("\n");

    return {
      query,
      nodes: nodes.map((n) => ({
        node_id: n.id,
        tenant_id: n.tenantId,
        type: n.type.toLowerCase() as any,
        content: n.content,
        trust_score: n.trustScore,
        decisiveness: n.decisiveness,
        actor_weights: n.actorWeights as any,
        created_at: n.createdAt.toISOString(),
        updated_at: n.updatedAt?.toISOString(),
        decay_factor: n.decayFactor,
      })),
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
      knowledge_graph,
      context,
    };
  }
}
