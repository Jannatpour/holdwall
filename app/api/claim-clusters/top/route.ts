/**
 * Top Claim Clusters API
 * 
 * Returns top claim clusters ranked by decisiveness
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
      logger.error("Auth error in claim-clusters/top route", {
        error: authError instanceof Error ? authError.message : String(authError),
      });
      return NextResponse.json(
        { error: "Authentication error", details: errorMessage },
        { status: 401 }
      );
    }

    const tenant_id = (user as any)?.tenantId || "";
    const searchParams = request.nextUrl.searchParams;
    const sort = searchParams.get("sort") || "decisiveness"; // decisiveness, size, created_at
    const range = searchParams.get("range") || "7d";
    const limitParam = searchParams.get("limit") || "10";
    const limit = Math.min(Math.max(parseInt(limitParam, 10), 1), 1000); // Clamp between 1 and 1000

    // Calculate date range
    const now = new Date();
    const rangeDays = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const startDate = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);

    // Build orderBy clause
    let orderBy: any = { decisiveness: "desc" };
    if (sort === "size") {
      orderBy = { size: "desc" };
    } else if (sort === "created_at") {
      orderBy = { createdAt: "desc" };
    }

    const clusters = await db.claimCluster.findMany({
      where: {
        tenantId: tenant_id,
        createdAt: { gte: startDate },
      },
      orderBy,
      take: limit,
      include: {
        primaryClaim: true,
        claims: {
          take: 5,
          orderBy: { decisiveness: "desc" },
        },
      },
    }).catch(() => []);

    // Resolve trust mappings from artifact policyChecks (explicit mappings stored on artifacts)
    const clusterIds = clusters.map((c) => c.id);
    const artifacts = await db.aAALArtifact.findMany({
      where: {
        tenantId: tenant_id,
        status: "PUBLISHED",
        policyChecks: ({ not: null } as any),
      },
      select: {
        id: true,
        policyChecks: true,
        padlPublished: true,
      },
    }).catch(() => []);

    const trustAssetsByCluster = new Map<
      string,
      Array<{ asset_id: string; type: string; verified: boolean }>
    >();

    for (const art of artifacts) {
      const pc = (art.policyChecks || {}) as any;
      const mappings = Array.isArray(pc.trust_mappings) ? pc.trust_mappings : [];
      if (mappings.length === 0) continue;

      const trustType = typeof pc.trust_type === "string" ? pc.trust_type : "OTHER";
      const verified = Boolean(pc.verified) || art.padlPublished;

      for (const m of mappings) {
        const cid = typeof m?.cluster_id === "string" ? m.cluster_id : null;
        if (!cid || !clusterIds.includes(cid)) continue;
        const arr = trustAssetsByCluster.get(cid) || [];
        if (!arr.some((x) => x.asset_id === art.id)) {
          arr.push({ asset_id: art.id, type: trustType, verified });
        }
        trustAssetsByCluster.set(cid, arr);
      }
    }

    return NextResponse.json({
      clusters: clusters.map((c) => ({
        cluster_id: c.id,
        tenant_id: c.tenantId,
        primary_claim: {
          claim_id: c.primaryClaim.id,
          canonical_text: c.primaryClaim.canonicalText,
          decisiveness: c.primaryClaim.decisiveness,
        },
        related_claims: c.claims.map((claim) => ({
          claim_id: claim.id,
          canonical_text: claim.canonicalText,
          decisiveness: claim.decisiveness,
        })),
        size: c.size,
        decisiveness: c.decisiveness,
        trust_assets: trustAssetsByCluster.get(c.id) || [],
        created_at: c.createdAt.toISOString(),
      })),
      total: clusters.length,
      sort,
      range,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error fetching top clusters", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        clusters: []
      },
      { status: 500 }
    );
  }
}
