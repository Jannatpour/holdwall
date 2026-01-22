/**
 * Signal Insights API
 * Provides AI-powered insights and recommendations for signals
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { logger } from "@/lib/logging/logger";

const evidenceVault = new DatabaseEvidenceVault();

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const searchParams = request.nextUrl.searchParams;
    const evidenceId = searchParams.get("evidence_id");

    if (evidenceId) {
      // Get insights for specific signal
      const signals = await evidenceVault.query({
        tenant_id,
        type: "signal",
      });

      const signal = signals.find((s: any) => s.evidence_id === evidenceId || s.id === evidenceId);
      
      if (!signal) {
        return NextResponse.json({ error: "Signal not found" }, { status: 404 });
      }

      // Generate insights
      const insights = {
        riskLevel: (signal.metadata as any)?.high_risk ? "high" : 
                   (signal.metadata?.severity === "critical" || signal.metadata?.severity === "high") ? "medium" : "low",
        recommendedActions: [] as string[],
        similarSignals: 0,
        amplificationTrend: "stable" as "increasing" | "decreasing" | "stable",
        clusterRecommendation: signal.metadata?.suggested_cluster_id ? {
          clusterId: signal.metadata.suggested_cluster_id,
          confidence: signal.metadata.suggested_cluster_confidence || 0.5,
        } : null,
      };

      // Add recommended actions based on signal characteristics
      if ((signal.metadata as any)?.high_risk) {
        insights.recommendedActions.push("Review immediately - high risk signal");
      }
      if (signal.metadata?.suggested_cluster_id) {
        insights.recommendedActions.push("Link to suggested cluster for better organization");
      }
      if (!signal.metadata?.cluster_id && !signal.metadata?.suggested_cluster_id) {
        insights.recommendedActions.push("Consider creating a new cluster for this signal");
      }
      if (signal.metadata?.severity === "critical") {
        insights.recommendedActions.push("Escalate to team lead for review");
      }

      return NextResponse.json({ insights });
    }

    // Get general insights for all signals
    const allSignals = await evidenceVault.query({
      tenant_id,
      type: "signal",
    });

    const recentSignals = allSignals.filter((s: any) => {
      const signalDate = new Date(s.created_at || s.collected_at || 0);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return signalDate >= dayAgo;
    });

    const highRiskCount = recentSignals.filter((s: any) => (s.metadata as any)?.high_risk).length;
    const unclusteredCount = recentSignals.filter((s: any) => {
      const metadata = s.metadata as any;
      return !metadata?.cluster_id && !metadata?.suggested_cluster_id;
    }).length;

    const insights = {
      summary: {
        totalRecent: recentSignals.length,
        highRisk: highRiskCount,
        unclustered: unclusteredCount,
        attentionNeeded: highRiskCount + unclusteredCount,
      },
      recommendations: [
        ...(highRiskCount > 0 ? [`Review ${highRiskCount} high-risk signal${highRiskCount > 1 ? "s" : ""}`] : []),
        ...(unclusteredCount > 0 ? [`Organize ${unclusteredCount} unclustered signal${unclusteredCount > 1 ? "s" : ""}`] : []),
      ],
    };

    return NextResponse.json({ insights });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching signal insights", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
