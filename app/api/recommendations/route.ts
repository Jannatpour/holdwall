/**
 * Recommendations API
 * 
 * Action recommendations for POS Autopilot queue
 * Generates prioritized actions based on current state
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { ForecastService } from "@/lib/forecasts/service";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { BeliefGraphService } from "@/lib/graph/belief";
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
      logger.error("Auth error in recommendations route", {
        error: authError instanceof Error ? authError.message : String(authError),
      });
      return NextResponse.json(
        { error: "Authentication error", details: errorMessage },
        { status: 401 }
      );
    }

    const tenant_id = (user as any)?.tenantId || "";
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get("limit") || "10";
    const limit = Math.min(Math.max(parseInt(limitParam, 10), 1), 1000); // Clamp between 1 and 1000

    const recommendations: Array<{
      id: string;
      priority: "high" | "medium" | "low";
      action: string;
      rationale: string;
      cluster_id?: string;
      forecast_id?: string;
      artifact_id?: string;
      playbook_id?: string;
      estimated_impact?: string;
    }> = [];

    // 1. Check for high outbreak probability
    const eventStore = new DatabaseEventStore();
    const beliefGraph = new BeliefGraphService(eventStore);
    const forecastService = new ForecastService(eventStore, beliefGraph);

    const recentSignals = await db.evidence.findMany({
      where: {
        tenantId: tenant_id,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        type: "SIGNAL",
      },
      take: 100,
      select: { contentMetadata: true },
    }).catch(() => []);

    if (recentSignals.length > 0) {
      const signalsForForecast = recentSignals.map((s) => ({
        amplification: ((s.contentMetadata as any) || {})?.amplification ?? 0.5,
        sentiment: ((s.contentMetadata as any) || {})?.sentiment ?? 0.5,
      }));

      try {
        const outbreakForecast = await forecastService.forecastOutbreak(
          tenant_id,
          7,
          signalsForForecast
        );

        if (outbreakForecast.probability >= 0.6) {
          recommendations.push({
            id: `rec-${Date.now()}-outbreak`,
            priority: "high",
            action: "Draft pre-emptive response artifact",
            rationale: `Outbreak probability is ${(outbreakForecast.probability * 100).toFixed(0)}% with ${outbreakForecast.triggers.length} trigger conditions. Prepare an evidence-backed AAAL artifact and route it for approval.`,
            forecast_id: outbreakForecast.forecast_id,
            estimated_impact: "high",
          });
        }
      } catch (error) {
        logger.warn("Outbreak forecast failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 2. Check for large claim clusters needing attention
    const largeClusters = await db.claimCluster.findMany({
      where: {
        tenantId: tenant_id,
        size: { gte: 10 },
      },
      orderBy: { size: "desc" },
      take: 3,
      include: {
        primaryClaim: true,
      },
    }).catch(() => []);

    for (const cluster of largeClusters) {
      // Trust mapping is stored on artifacts via policyChecks.trust_mappings.
      const mappedArtifacts = await db.aAALArtifact.findMany({
        where: { tenantId: tenant_id, status: "PUBLISHED", policyChecks: ({ not: null } as any) },
        select: { id: true, policyChecks: true },
      }).catch(() => []);

      const hasTrustAssets = mappedArtifacts.some((a) => {
        const pc = (a.policyChecks || {}) as any;
        const mappings = Array.isArray(pc.trust_mappings) ? pc.trust_mappings : [];
        return mappings.some((m: any) => m?.cluster_id === cluster.id);
      });
      if (!hasTrustAssets) {
        recommendations.push({
          id: `rec-${Date.now()}-cluster-${cluster.id}`,
          priority: "medium",
          action: "Map trust assets to cluster",
          rationale: `Cluster "${cluster.primaryClaim.canonicalText.substring(0, 100)}" has ${cluster.size} claims but no trust assets mapped. Add trust assets to improve credibility.`,
          cluster_id: cluster.id,
          estimated_impact: "medium",
        });
      } else if (cluster.decisiveness >= 0.7) {
        recommendations.push({
          id: `rec-${Date.now()}-cluster-action-${cluster.id}`,
          priority: "high",
          action: "Create AAAL artifact for high-decisiveness cluster",
          rationale: `Cluster has decisiveness ${(cluster.decisiveness * 100).toFixed(0)}% and ${cluster.size} claims. Create authoritative artifact to address this narrative.`,
          cluster_id: cluster.id,
          estimated_impact: "high",
        });
      }
    }

    // 3. Check for pending approvals
    const pendingApprovals = await db.approval.count({
      where: {
        tenantId: tenant_id,
        decision: null,
      },
    }).catch(() => 0);

    if (pendingApprovals > 0) {
      recommendations.push({
        id: `rec-${Date.now()}-approvals`,
        priority: pendingApprovals >= 5 ? "high" : "medium",
        action: "Review pending approvals",
        rationale: `${pendingApprovals} approval${pendingApprovals > 1 ? "s" : ""} pending. Review and process to unblock workflows.`,
        estimated_impact: "medium",
      });
    }

    // 4. Check for clusters with low citation coverage
    const clustersWithLowCitations = await db.claimCluster.findMany({
      where: {
        tenantId: tenant_id,
      },
      include: {
        primaryClaim: {
          include: {
            evidenceRefs: true,
          },
        },
      },
      take: 10,
    }).catch(() => []);

    for (const cluster of clustersWithLowCitations) {
      const evidenceCount = cluster.primaryClaim.evidenceRefs?.length || 0;
      if (evidenceCount < 3 && cluster.decisiveness >= 0.5) {
        recommendations.push({
          id: `rec-${Date.now()}-citations-${cluster.id}`,
          priority: "medium",
          action: "Add evidence citations to cluster",
          rationale: `Cluster has only ${evidenceCount} evidence reference${evidenceCount !== 1 ? "s" : ""}. Add more evidence to strengthen claims.`,
          cluster_id: cluster.id,
          estimated_impact: "medium",
        });
      }
    }

    // 5. Check for high-risk signals without clusters
    const recentSignalEvidence = await db.evidence.findMany({
      where: {
        tenantId: tenant_id,
        type: "SIGNAL",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { metadata: true },
      take: 500,
    }).catch(() => []);

    const unclusteredSignals = recentSignalEvidence.filter((s) => {
      const meta = (s.metadata || {}) as any;
      const sev = typeof meta.severity === "string" ? meta.severity.toLowerCase() : "";
      const clusterId = typeof meta.cluster_id === "string" ? meta.cluster_id : null;
      return (sev === "high" || sev === "critical") && !clusterId;
    }).length;

    if (unclusteredSignals > 0) {
      recommendations.push({
        id: `rec-${Date.now()}-unclustered`,
        priority: "medium",
        action: "Review and cluster high-severity signals",
        rationale: `${unclusteredSignals} high-severity signal${unclusteredSignals > 1 ? "s" : ""} without clusters. Review and create clusters to track narrative patterns.`,
        estimated_impact: "medium",
      });
    }

    // Sort by priority (high > medium > low) and limit
    const sorted = recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    return NextResponse.json({
      recommendations: sorted.slice(0, limit),
      total: sorted.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error generating recommendations", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        recommendations: []
      },
      { status: 500 }
    );
  }
}
