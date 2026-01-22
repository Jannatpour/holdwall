/**
 * Funnel Recommendations API
 * 
 * Funnel-specific recommendations for decision funnel domination
 * Provides placement recommendations per persona and funnel stage
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const searchParams = request.nextUrl.searchParams;
    const persona = searchParams.get("persona") || "buyer"; // buyer, pr, compliance, customer

    // Get available artifacts
    const publishedArtifacts = await db.aAALArtifact.findMany({
      where: {
        tenantId: tenant_id,
        status: "PUBLISHED",
        policyChecks: ({ not: null } as any),
      },
      select: {
        id: true,
        title: true,
        policyChecks: true,
      },
      take: 50,
    });

    // Get claim clusters for mapping
    const clusters = await db.claimCluster.findMany({
      where: {
        tenantId: tenant_id,
      },
      include: {
        primaryClaim: true,
      },
      take: 20,
    });

    // Generate funnel stage recommendations
    const stages = [
      { name: "Awareness", description: "Initial brand/product discovery" },
      { name: "Research", description: "Active information gathering" },
      { name: "Comparison", description: "Evaluating options" },
      { name: "Decision", description: "Final purchase decision" },
      { name: "Post-purchase", description: "Post-purchase validation" },
    ];

    const recommendations: Array<{
      stage: string;
      persona: string;
      artifact_id?: string;
      cluster_id?: string;
      placement_type: "primary" | "secondary" | "supporting";
      rationale: string;
      estimated_impact: "high" | "medium" | "low";
    }> = [];

    for (const stage of stages) {
      // Recommend artifacts only when explicitly tagged via policyChecks
      for (const artifact of publishedArtifacts) {
        const pc = (artifact.policyChecks || {}) as any;
        const personas = Array.isArray(pc.personas) ? pc.personas : [];
        const stagesTagged = Array.isArray(pc.funnel_stages) ? pc.funnel_stages : [];
        if (!personas.includes(persona)) continue;
        if (!stagesTagged.includes(stage.name)) continue;

        const placementType =
          pc.placement_type === "primary" || pc.placement_type === "secondary"
            ? pc.placement_type
            : "supporting";
        const rationale =
          typeof pc.rationale === "string"
            ? pc.rationale
            : `Artifact is explicitly tagged for ${persona} persona and ${stage.name} stage.`;

          recommendations.push({
            stage: stage.name,
            persona,
            artifact_id: artifact.id,
            placement_type: placementType,
            rationale,
            estimated_impact: placementType === "primary" ? "high" : placementType === "secondary" ? "medium" : "low",
          });
      }

      // Map clusters to stages
      for (const cluster of clusters) {
        if (cluster.decisiveness >= 0.6) {
          recommendations.push({
            stage: stage.name,
            persona,
            cluster_id: cluster.id,
            placement_type: "supporting",
            rationale: `Cluster "${cluster.primaryClaim.canonicalText.substring(0, 100)}" provides supporting context for ${stage.name} stage.`,
            estimated_impact: "medium",
          });
        }
      }
    }

    // Group by stage
    const byStage = stages.map(stage => ({
      stage: stage.name,
      recommendations: recommendations.filter(r => r.stage === stage.name),
    }));

    return NextResponse.json({
      persona,
      funnel_recommendations: byStage,
      total_recommendations: recommendations.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error generating funnel recommendations", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
