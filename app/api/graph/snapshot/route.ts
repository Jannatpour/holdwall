/**
 * Graph Snapshot API
 * 
 * Returns graph snapshot at a specific time point
 * Used for time-based graph exploration
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { DatabaseBeliefGraphService } from "@/lib/graph/belief-implementation";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get("range") || "30d"; // 7d, 30d, 90d, all
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const timestamp = searchParams.get("timestamp"); // Optional: specific timestamp

    // Calculate date range
    let startDate: Date | undefined;
    if (range !== "all") {
      const now = new Date();
      const rangeDays = range === "7d" ? 7 : range === "30d" ? 30 : 90;
      startDate = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    }

    // If timestamp provided, use that instead
    if (timestamp) {
      startDate = new Date(timestamp);
    }

    const whereClause: any = { tenantId: tenant_id };
    if (startDate) {
      whereClause.createdAt = { gte: startDate };
    }

    // Get nodes and edges for snapshot
    const [nodes, edges] = await Promise.all([
      db.beliefNode.findMany({
        where: whereClause,
        orderBy: { decisiveness: "desc" },
        take: 1000,
      }),
      db.beliefEdge.findMany({
        where: whereClause,
        take: 2000,
      }),
    ]);

    // Calculate graph statistics
    const nodeTypes = new Map<string, number>();
    const edgeTypes = new Map<string, number>();
    let totalWeight = 0;

    for (const node of nodes) {
      nodeTypes.set(node.type, (nodeTypes.get(node.type) || 0) + 1);
    }

    for (const edge of edges) {
      edgeTypes.set(edge.type, (edgeTypes.get(edge.type) || 0) + 1);
      totalWeight += edge.weight;
    }

    return NextResponse.json({
      snapshot: {
        timestamp: timestamp || new Date().toISOString(),
        range,
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type,
          content: n.content,
          trust_score: n.trustScore,
          decisiveness: n.decisiveness,
          actor_weights: n.actorWeights,
          decay_factor: n.decayFactor,
          created_at: n.createdAt.toISOString(),
          updated_at: n.updatedAt.toISOString(),
        })),
        edges: edges.map((e) => ({
          id: e.id,
          from: e.fromNodeId,
          to: e.toNodeId,
          type: e.type,
          weight: e.weight,
          actor_weights: e.actorWeights,
          created_at: e.createdAt.toISOString(),
        })),
      },
      statistics: {
        total_nodes: nodes.length,
        total_edges: edges.length,
        node_types: Object.fromEntries(nodeTypes),
        edge_types: Object.fromEntries(edgeTypes),
        average_weight: edges.length > 0 ? totalWeight / edges.length : 0,
        average_decisiveness: nodes.length > 0
          ? nodes.reduce((sum, n) => sum + n.decisiveness, 0) / nodes.length
          : 0,
        average_trust_score: nodes.length > 0
          ? nodes.reduce((sum, n) => sum + n.trustScore, 0) / nodes.length
          : 0,
      },
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching graph snapshot", {
      range,
      timestamp: searchParams.get("timestamp"),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
