/**
 * Trust Mappings API
 * 
 * Map trust assets to claim clusters
 * Stores explicit relationships on the trust asset (AAAL artifact) policyChecks.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { z } from "zod";

const createMappingSchema = z.object({
  cluster_id: z.string(),
  asset_id: z.string(), // AAAL artifact ID
  mapping_type: z.enum(["primary", "supporting", "related"]).default("supporting"),
  rationale: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const searchParams = request.nextUrl.searchParams;
    const cluster_id = searchParams.get("cluster_id");

    if (cluster_id) {
      // Get mappings for specific cluster
      const cluster = await db.claimCluster.findUnique({
        where: { id: cluster_id },
        include: {
          primaryClaim: true,
        },
      });

      if (!cluster || cluster.tenantId !== tenant_id) {
        return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
      }

      // Load published artifacts with explicit mappings
      const artifacts = await db.aAALArtifact.findMany({
        where: {
          tenantId: tenant_id,
          status: "PUBLISHED",
          policyChecks: ({ not: null } as any),
        },
        select: {
          id: true,
          title: true,
          policyChecks: true,
          createdAt: true,
        },
      });

      const mappings = artifacts.flatMap((artifact) => {
        const pc = (artifact.policyChecks || {}) as any;
        const current = Array.isArray(pc.trust_mappings) ? pc.trust_mappings : [];
        return current
          .filter((m: any) => m?.cluster_id === cluster.id)
          .map((m: any) => ({
            mapping_id: `mapping-${cluster.id}-${artifact.id}`,
            cluster_id: cluster.id,
            asset_id: artifact.id,
            asset_name: artifact.title,
            mapping_type: (m?.mapping_type || "supporting") as string,
            rationale: typeof m?.rationale === "string" ? m.rationale : undefined,
            created_at: typeof m?.created_at === "string" ? m.created_at : artifact.createdAt.toISOString(),
          }));
      });

      return NextResponse.json({
        cluster_id,
        mappings,
        total: mappings.length,
      });
    }

    // Get all mappings (explicit, stored on artifacts)
    const allClusters = await db.claimCluster.findMany({
      where: { tenantId: tenant_id },
      include: { primaryClaim: true },
    });

    const allArtifacts = await db.aAALArtifact.findMany({
      where: {
        tenantId: tenant_id,
        status: "PUBLISHED",
        policyChecks: ({ not: null } as any),
      },
      select: { id: true, policyChecks: true },
    });

    const mappings: Array<{
      mapping_id: string;
      cluster_id: string;
      asset_id: string;
      mapping_type: string;
    }> = [];

    const clusterIdSet = new Set(allClusters.map((c) => c.id));
    for (const artifact of allArtifacts) {
      const pc = (artifact.policyChecks || {}) as any;
      const current = Array.isArray(pc.trust_mappings) ? pc.trust_mappings : [];
      for (const m of current) {
        const cid = typeof m?.cluster_id === "string" ? m.cluster_id : null;
        if (!cid || !clusterIdSet.has(cid)) continue;
        mappings.push({
          mapping_id: `mapping-${cid}-${artifact.id}`,
          cluster_id: cid,
          asset_id: artifact.id,
          mapping_type: typeof m?.mapping_type === "string" ? m.mapping_type : "supporting",
        });
      }
    }

    return NextResponse.json({
      mappings,
      total: mappings.length,
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error fetching trust mappings", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();
    const validated = createMappingSchema.parse(body);

    // Verify cluster exists
    const cluster = await db.claimCluster.findUnique({
      where: { id: validated.cluster_id },
    });

    if (!cluster || cluster.tenantId !== tenant_id) {
      return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
    }

    // Verify asset exists
    const artifact = await db.aAALArtifact.findUnique({
      where: { id: validated.asset_id },
    });

    if (!artifact || artifact.tenantId !== tenant_id) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Store mapping in artifact metadata
    const currentPolicyChecks = ((artifact.policyChecks as any) || {}) as Record<string, unknown>;
    const currentMappings = Array.isArray((currentPolicyChecks as any).trust_mappings)
      ? ((currentPolicyChecks as any).trust_mappings as any[])
      : [];
    
    // Check if mapping already exists
    const existingMapping = currentMappings.find((m: any) => m.cluster_id === validated.cluster_id);
    if (existingMapping) {
      return NextResponse.json({
        mapping_id: `mapping-${validated.cluster_id}-${validated.asset_id}`,
        cluster_id: validated.cluster_id,
        asset_id: validated.asset_id,
        mapping_type: validated.mapping_type,
        message: "Mapping already exists",
      });
    }

    // Add mapping
    await db.aAALArtifact.update({
      where: { id: validated.asset_id },
      data: {
        policyChecks: ({
          ...currentPolicyChecks,
          trust_mappings: [
            ...currentMappings,
            {
              cluster_id: validated.cluster_id,
              mapping_type: validated.mapping_type,
              rationale: validated.rationale,
              created_at: new Date().toISOString(),
            },
          ],
        } as any),
      },
    });

    return NextResponse.json({
      mapping_id: `mapping-${validated.cluster_id}-${validated.asset_id}`,
      cluster_id: validated.cluster_id,
      asset_id: validated.asset_id,
      mapping_type: validated.mapping_type,
      created_at: new Date().toISOString(),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error creating trust mapping", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
