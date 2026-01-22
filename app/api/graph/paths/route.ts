/**
 * Graph Paths API
 * 
 * Enhanced path finding between nodes
 * Supports reinforcement/neutralization path analysis
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { DatabaseBeliefGraphService } from "@/lib/graph/belief-implementation";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const searchParams = request.nextUrl.searchParams;
    const from_node = searchParams.get("from_node");
    const to_node = searchParams.get("to_node");
    const node_id = searchParams.get("node_id"); // For paths from/to a single node
    const depth = parseInt(searchParams.get("depth") || "5", 10);
    const path_type = searchParams.get("type") || "all"; // reinforcement, neutralize, all

    const beliefGraph = new DatabaseBeliefGraphService();

    if (from_node && to_node) {
      // Find paths between two nodes
      const edgeTypes = path_type === "all"
        ? undefined
        : path_type === "reinforcement"
          ? ["reinforcement" as const]
          : ["neutralization" as const];

      const paths = await beliefGraph.findPaths(
        from_node,
        to_node,
        depth,
        {
          edge_types: edgeTypes,
        }
      );

      return NextResponse.json({
        from_node,
        to_node,
        paths,
        path_type,
        total_paths: paths.length,
      });
    }

    if (node_id) {
      // Find all paths from/to a node
      const [pathsFrom, pathsTo] = await Promise.all([
        beliefGraph.findPaths(node_id, "", depth, {}), // Find paths starting from node
        beliefGraph.findPaths("", node_id, depth, {}), // Find paths ending at node
      ]);

      return NextResponse.json({
        node_id,
        paths_from: pathsFrom,
        paths_to: pathsTo,
        total_paths: pathsFrom.length + pathsTo.length,
      });
    }

    return NextResponse.json(
      { error: "Either from_node+to_node or node_id must be provided" },
      { status: 400 }
    );
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error finding graph paths", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      from_node: request.nextUrl.searchParams.get("from_node"),
      to_node: request.nextUrl.searchParams.get("to_node"),
      node_id: request.nextUrl.searchParams.get("node_id"),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
