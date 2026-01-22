/**
 * Belief Graph API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { DatabaseBeliefGraphService } from "@/lib/graph/belief-implementation";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const searchParams = request.nextUrl.searchParams;
    const node_id = searchParams.get("node_id");
    const from_node = searchParams.get("from_node");
    const to_node = searchParams.get("to_node");
    const max_depth = parseInt(searchParams.get("max_depth") || "5");

    if (node_id) {
      // Get single node with edges
      const node = await db.beliefNode.findUnique({
        where: { id: node_id },
        include: {
          fromEdges: {
            include: {
              toNode: true,
            },
          },
          toEdges: {
            include: {
              fromNode: true,
            },
          },
        },
      });

      if (!node || node.tenantId !== tenant_id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json(node);
    }

    if (from_node && to_node) {
      // Find paths between nodes using Belief Graph Service
      const beliefGraph = new DatabaseBeliefGraphService();
      const actorId = searchParams.get("actor_id") || undefined;
      const edgeTypes = searchParams.get("edge_types")?.split(",") as Array<"reinforcement" | "neutralization" | "decay"> | undefined;
      const minStrength = searchParams.get("min_strength") ? parseFloat(searchParams.get("min_strength")!) : undefined;

      const paths = await beliefGraph.findPaths(
        from_node,
        to_node,
        max_depth,
        {
          actor_id: actorId,
          edge_types: edgeTypes,
          min_strength: minStrength,
        }
      );

      return NextResponse.json({ paths });
    }

    // Get all nodes and edges
    const [nodes, edges] = await Promise.all([
      db.beliefNode.findMany({
        where: { tenantId: tenant_id },
        take: 1000, // Limit for performance
      }),
      db.beliefEdge.findMany({
        where: { tenantId: tenant_id },
        take: 1000,
      }),
    ]);

    return NextResponse.json({
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        content: n.content,
        trust_score: n.trustScore,
        decisiveness: n.decisiveness,
        created_at: n.createdAt.toISOString(),
      })),
      edges: edges.map((e) => ({
        id: e.id,
        from: e.fromNodeId,
        to: e.toNodeId,
        type: e.type,
        weight: e.weight,
      })),
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching graph", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

