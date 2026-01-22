/**
 * Claim Clustering API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { DatabaseClaimClusteringService } from "@/lib/claims/clustering";
import { broadcastClusterUpdate } from "@/lib/events/broadcast-helper";
import { logger } from "@/lib/logging/logger";
import { db } from "@/lib/db/client";
import { z } from "zod";

const clusteringService = new DatabaseClaimClusteringService();

const clusterClaimsSchema = z.object({
  claim_ids: z.array(z.string()),
  similarity_threshold: z.number().min(0).max(1).optional(),
  method: z.enum(["hierarchical", "online"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();
    const validated = clusterClaimsSchema.parse(body);

    // Fetch claims
    const claims = await db.claim.findMany({
      where: {
        id: { in: validated.claim_ids },
        tenantId: tenant_id,
      },
      include: {
        evidenceRefs: {
          include: {
            evidence: true,
          },
        },
      },
    });

    const claimObjects = claims.map((c) => ({
      claim_id: c.id,
      tenant_id: c.tenantId,
      canonical_text: c.canonicalText,
      variants: c.variants,
      evidence_refs: c.evidenceRefs.map((ref) => ref.evidenceId),
      decisiveness: c.decisiveness,
      cluster_id: c.clusterId || undefined,
      created_at: c.createdAt.toISOString(),
    }));

    const clusters = await clusteringService.clusterClaims(
      tenant_id,
      claimObjects,
      {
        similarity_threshold: validated.similarity_threshold,
        method: validated.method,
      }
    );

    // Broadcast real-time updates for created clusters
    for (const cluster of clusters) {
      await broadcastClusterUpdate(cluster.cluster_id, "created", {
        size: cluster.size,
        decisiveness: cluster.decisiveness,
      }, tenant_id);
    }

    return NextResponse.json(clusters, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error clustering claims", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
