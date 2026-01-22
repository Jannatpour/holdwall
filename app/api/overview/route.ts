/**
 * Overview Dashboard API
 * Aggregated data for overview page
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch (authError) {
      const errorMessage = authError instanceof Error ? authError.message : "Authentication failed";
      if (errorMessage === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      logger.error("Auth error in overview route", {
        error: authError instanceof Error ? authError.message : String(authError),
        stack: authError instanceof Error ? authError.stack : undefined,
      });
      return NextResponse.json(
        { error: "Authentication error", details: errorMessage },
        { status: 401 }
      );
    }

    const tenant_id = (user as any)?.tenantId || "";

    // Get aggregated metrics
    const [
      evidenceCount,
      claimsCount,
      clustersCount,
      nodesCount,
      artifactsCount,
      pendingApprovals,
    ] = await Promise.all([
      db.evidence.count({ where: { tenantId: tenant_id } }).catch(() => 0),
      db.claim.count({ where: { tenantId: tenant_id } }).catch(() => 0),
      db.claimCluster.count({ where: { tenantId: tenant_id } }).catch(() => 0),
      db.beliefNode.count({ where: { tenantId: tenant_id } }).catch(() => 0),
      db.aAALArtifact.count({ where: { tenantId: tenant_id } }).catch(() => 0),
      db.approval.count({
        where: {
          tenantId: tenant_id,
          decision: null,
        },
      }).catch(() => 0),
    ]);

    // Get recent events for ops feed
    const recentEvents = await db.event.findMany({
      where: { tenantId: tenant_id },
      orderBy: { occurredAt: "desc" },
      take: 10,
      include: {
        evidenceRefs: {
          include: {
            evidence: true,
          },
        },
      },
    }).catch(() => []);

    // Get top claim clusters
    const topClusters = await db.claimCluster.findMany({
      where: { tenantId: tenant_id },
      orderBy: { decisiveness: "desc" },
      take: 3,
      include: {
        primaryClaim: true,
        claims: {
          take: 5,
        },
      },
    }).catch(() => []);

    return NextResponse.json({
      metrics: {
        evidence_count: evidenceCount,
        claims_count: claimsCount,
        clusters_count: clustersCount,
        nodes_count: nodesCount,
        artifacts_count: artifactsCount,
        pending_approvals: pendingApprovals,
      },
      recent_events: recentEvents.map((e) => ({
        id: e.id,
        type: e.type,
        occurred_at: e.occurredAt.toISOString(),
        actor_id: e.actorId,
      })),
      top_clusters: topClusters.map((c) => ({
        id: c.id,
        primary_claim: c.primaryClaim?.canonicalText || "",
        size: c.size,
        decisiveness: c.decisiveness,
      })),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error fetching overview", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Always return JSON, never plain text
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: process.env.NODE_ENV === "development" ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
