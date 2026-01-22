/**
 * Cluster Impact Metrics API
 * 
 * Impact metrics for a specific claim cluster
 * Shows how cluster affects perception over time
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get("range") || "30d";
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const cluster_id = searchParams.get("cluster_id");

    if (!cluster_id) {
      return NextResponse.json(
        { error: "cluster_id is required" },
        { status: 400 }
      );
    }

    // Verify cluster exists
    const cluster = await db.claimCluster.findUnique({
      where: { id: cluster_id },
      include: {
        primaryClaim: true,
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
      return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
    }

    // Calculate date range
    const now = new Date();
    const rangeDays = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const startDate = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);

    // Get events related to this cluster
    const clusterEvents = await db.event.findMany({
      where: {
        tenantId: tenant_id,
        occurredAt: { gte: startDate },
        type: { contains: "claim", mode: "insensitive" },
        payload: {
          path: ["cluster_id"],
          equals: cluster_id,
        },
      },
      orderBy: { occurredAt: "asc" },
    });

    // Calculate impact metrics
    const totalClaims = cluster.size;
    const totalEvidence = cluster.claims.reduce(
      (sum, claim) => sum + (claim.evidenceRefs?.length || 0),
      0
    );
    const avgDecisiveness = cluster.decisiveness;

    // Calculate trend (claims added over time)
    const claimsByDay = new Map<string, number>();
    for (const claim of cluster.claims) {
      const day = new Date(claim.createdAt).toISOString().split("T")[0];
      claimsByDay.set(day, (claimsByDay.get(day) || 0) + 1);
    }

    const trend = Array.from(claimsByDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    // Calculate evidence growth
    const evidenceByDay = new Map<string, number>();
    for (const claim of cluster.claims) {
      for (const evidenceRef of claim.evidenceRefs || []) {
        const evidence = evidenceRef.evidence;
        const day = new Date(evidence.createdAt).toISOString().split("T")[0];
        evidenceByDay.set(day, (evidenceByDay.get(day) || 0) + 1);
      }
    }

    const evidenceTrend = Array.from(evidenceByDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    // Calculate impact score (combination of size, decisiveness, evidence)
    const impactScore = Math.min(1, (
      (totalClaims / 50) * 0.3 + // Normalize by max expected cluster size
      avgDecisiveness * 0.4 +
      (totalEvidence / 20) * 0.3 // Normalize by max expected evidence
    ));

    return NextResponse.json({
      cluster_id,
      range,
      metrics: {
        total_claims: totalClaims,
        total_evidence: totalEvidence,
        average_decisiveness: avgDecisiveness,
        impact_score: Math.round(impactScore * 100) / 100,
        events_count: clusterEvents.length,
      },
      trends: {
        claims_growth: trend,
        evidence_growth: evidenceTrend,
      },
      calculated_at: new Date().toISOString(),
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error calculating cluster impact", {
      clusterId: searchParams.get("cluster_id"),
      range,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
