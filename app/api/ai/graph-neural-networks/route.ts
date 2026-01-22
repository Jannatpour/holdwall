/**
 * Graph Neural Networks API
 * 
 * Endpoints for CODEN, TIP-GNN, RGP, Explainable Forecasts, TGNF, NGM, ReaL-TG
 */

import { NextRequest, NextResponse } from "next/server";
import { CODEN } from "@/lib/graph/coden";
import { TIPGNN } from "@/lib/graph/tip-gnn";
import { RelationalGraphPerceiver } from "@/lib/graph/rgp";
import { ExplainableForecastEngine } from "@/lib/graph/explainable-forecast";
import { TGNF } from "@/lib/graph/tgnf";
import { NeuralGraphicalModel } from "@/lib/graph/ngm";
import { ReaLTG } from "@/lib/graph/realtg";
import { DatabaseBeliefGraphService } from "@/lib/graph/belief-implementation";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

const beliefGraphService = new DatabaseBeliefGraphService();

/**
 * POST /api/ai/graph-neural-networks/coden
 * Continuous dynamic network predictions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { method, nodeId, timeWindow = 7 } = body;

    if (method === "coden") {
      const coden = new CODEN();
      
      // Get node and edges
      const node = await db.beliefNode.findUnique({
        where: { id: nodeId },
      });

      if (!node) {
        return NextResponse.json({ error: "Node not found" }, { status: 404 });
      }

      const edges = await db.beliefEdge.findMany({
        where: {
          OR: [
            { fromNodeId: nodeId },
            { toNodeId: nodeId },
          ],
        },
      });

      // Record current state
      const beliefNode = {
        node_id: node.id,
        tenant_id: node.tenantId,
        type: node.type.toLowerCase() as any,
        content: node.content,
        trust_score: node.trustScore,
        decisiveness: node.decisiveness,
        actor_weights: node.actorWeights as any,
        created_at: node.createdAt.toISOString(),
        updated_at: node.updatedAt?.toISOString(),
        decay_factor: node.decayFactor,
      };

      coden.recordState(beliefNode);

      const forecast = coden.predict(
        beliefNode,
        edges.map((e: { id: string; tenantId: string; fromNodeId: string; toNodeId: string; type: { toString(): string }; weight: number; actorWeights: unknown; createdAt: Date; updatedAt: Date }) => ({
          edge_id: e.id,
          tenant_id: e.tenantId,
          from_node_id: e.fromNodeId,
          to_node_id: e.toNodeId,
          type: e.type.toString().toLowerCase() as "reinforcement" | "neutralization" | "decay",
          weight: e.weight,
          actor_weights: (e.actorWeights as Record<string, number>) || {},
          created_at: e.createdAt.toISOString(),
          updated_at: e.updatedAt.toISOString(),
        })),
        timeWindow
      );

      return NextResponse.json(forecast);
    }

    return NextResponse.json({ error: "Invalid method" }, { status: 400 });
  } catch (error) {
    logger.error("Error in CODEN GNN prediction", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/graph-neural-networks/tip-gnn
 * Transition-informed propagation
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodeId, neighborIds } = body;

    const tipGnn = new TIPGNN();

    // Get node
    const node = await db.beliefNode.findUnique({
      where: { id: nodeId },
    });

    if (!node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    // Get neighbors
    const neighbors = await Promise.all(
      neighborIds.map(async (neighborId: string) => {
        const neighborNode = await db.beliefNode.findUnique({
          where: { id: neighborId },
        });

        if (!neighborNode) return null;

        const edge = await db.beliefEdge.findFirst({
          where: {
            OR: [
              { fromNodeId: nodeId, toNodeId: neighborId },
              { fromNodeId: neighborId, toNodeId: nodeId },
            ],
          },
        });

        if (!edge) return null;

        return {
          node: {
            node_id: neighborNode.id,
            tenant_id: neighborNode.tenantId,
            type: neighborNode.type.toLowerCase() as any,
            content: neighborNode.content,
            trust_score: neighborNode.trustScore,
            decisiveness: neighborNode.decisiveness,
            actor_weights: neighborNode.actorWeights as any,
            created_at: neighborNode.createdAt.toISOString(),
            updated_at: neighborNode.updatedAt?.toISOString(),
            decay_factor: neighborNode.decayFactor,
          },
          edge: {
            edge_id: edge.id,
            tenant_id: edge.tenantId,
            from_node_id: edge.fromNodeId,
            to_node_id: edge.toNodeId,
            type: edge.type.toLowerCase() as any,
            weight: edge.weight,
            actor_weights: edge.actorWeights as any,
            created_at: edge.createdAt.toISOString(),
            updated_at: edge.updatedAt?.toISOString(),
          },
        };
      })
    );

    const validNeighbors = neighbors.filter((n): n is NonNullable<typeof n> => n !== null);

    const beliefNode = {
      node_id: node.id,
      tenant_id: node.tenantId,
      type: node.type.toLowerCase() as any,
      content: node.content,
      trust_score: node.trustScore,
      decisiveness: node.decisiveness,
      actor_weights: node.actorWeights as any,
      created_at: node.createdAt.toISOString(),
      updated_at: node.updatedAt?.toISOString(),
      decay_factor: node.decayFactor,
    };

    const prediction = tipGnn.predict(beliefNode, validNeighbors);

    return NextResponse.json(prediction);
  } catch (error) {
    logger.error("Error in TIP-GNN prediction", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/graph-neural-networks/rgp
 * Relational Graph Perceiver
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, nodeIds, maxNodes = 20, temporalWindow = 30 } = body;

    const rgp = new RelationalGraphPerceiver();

    // Get nodes
    const nodes = await db.beliefNode.findMany({
      where: nodeIds ? { id: { in: nodeIds } } : undefined,
      take: maxNodes,
      orderBy: { createdAt: "desc" },
    });

    // Get edges
    const nodeIdSet = new Set(nodes.map(n => n.id));
    const edges = await db.beliefEdge.findMany({
      where: {
        OR: [
          { fromNodeId: { in: Array.from(nodeIdSet) } },
          { toNodeId: { in: Array.from(nodeIdSet) } },
        ],
      },
    });

    const beliefNodes = nodes.map(n => ({
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
    }));

    const beliefEdges = edges.map(e => ({
      edge_id: e.id,
      tenant_id: e.tenantId,
      from_node_id: e.fromNodeId,
      to_node_id: e.toNodeId,
      type: e.type.toLowerCase() as any,
      weight: e.weight,
      actor_weights: e.actorWeights as any,
      created_at: e.createdAt.toISOString(),
      updated_at: e.updatedAt?.toISOString(),
    }));

    const result = await rgp.process(query, beliefNodes, beliefEdges, {
      maxNodes,
      temporalWindow,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Error in RGP prediction", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
