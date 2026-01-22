/**
 * Claim Clusters API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const searchParams = request.nextUrl.searchParams;
    const cluster_id = searchParams.get("id");

    if (cluster_id) {
      const cluster = await db.claimCluster.findUnique({
        where: { id: cluster_id },
        include: {
          primaryClaim: {
            include: {
              evidenceRefs: {
                include: {
                  evidence: true,
                },
              },
            },
          },
          claims: {
            include: {
              evidenceRefs: {
                include: {
                  evidence: true,
                },
              },
            },
          },
        },
      });

      if (!cluster || cluster.tenantId !== tenant_id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json(cluster);
    }

    const clusters = await db.claimCluster.findMany({
      where: { tenantId: tenant_id },
      include: {
        primaryClaim: true,
        _count: {
          select: { claims: true },
        },
      },
      orderBy: { decisiveness: "desc" },
    });

    return NextResponse.json(clusters);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error fetching clusters", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
