/**
 * Metrics Summary API
 * 
 * KPI metrics aggregation for overview dashboard
 * Returns Perception Health Score, Outbreak Probability, AI Citation Coverage, Trust Coverage Ratio
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { ForecastService } from "@/lib/forecasts/service";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { BeliefGraphService } from "@/lib/graph/belief";
import { AdvancedAIIntegration } from "@/lib/ai/integration";
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
      logger.error("Auth error in metrics/summary route", {
        error: authError instanceof Error ? authError.message : String(authError),
        stack: authError instanceof Error ? authError.stack : undefined,
      });
      return NextResponse.json(
        { error: "Authentication error", details: errorMessage },
        { status: 401 }
      );
    }

    const tenant_id = (user as any)?.tenantId || "";
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get("range") || "7d"; // 7d, 30d, 90d

    // Calculate date range
    const now = new Date();
    const rangeDays = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const startDate = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);

    // 1. Perception Health Score (0-1)
    // Based on: positive sentiment ratio, low decisiveness of negative claims, high trust coverage
    const [totalClaims, highDecisivenessClaims, trustAssetArtifactsCount] = await Promise.all([
      db.claim.count({
        where: {
          tenantId: tenant_id,
          createdAt: { gte: startDate },
        },
      }).catch(() => 0),
      db.claim.count({
        where: {
          tenantId: tenant_id,
          createdAt: { gte: startDate },
          decisiveness: { gte: 0.7 },
        },
      }).catch(() => 0),
      db.aAALArtifact.count({
        where: {
          tenantId: tenant_id,
          policyChecks: ({ path: ["trust_asset"], equals: true } as any),
        },
      }).catch(() => 0),
    ]);

    // Calculate sentiment ratio using AI-powered analysis (January 2026 enhancement)
    // Analyze recent claims for sentiment using Adaptive RAG for cost-effective analysis
    let positiveRatio = 0.5; // Default fallback
    try {
      const recentClaims = await db.claim.findMany({
        where: {
          tenantId: tenant_id,
          createdAt: { gte: startDate },
        },
        take: 50, // Sample for efficiency
        select: { canonicalText: true },
      }).catch(() => []);

      if (recentClaims.length > 0) {
        const aiIntegration = new AdvancedAIIntegration({
          tenantId: tenant_id,
          enableAdvancedRAG: true,
        });

        // Use Adaptive RAG for efficient sentiment analysis
        const sentimentQuery = `Analyze the sentiment of these claims and return a JSON object with:
{
  "positive_count": number,
  "negative_count": number,
  "neutral_count": number,
  "total": number
}

Claims:
${recentClaims.slice(0, 20).map(c => c.canonicalText).join("\n")}

Classify each claim as positive, negative, or neutral based on its sentiment toward the subject.`;

        const sentimentResult = await aiIntegration.queryAdaptiveRAG(
          sentimentQuery,
          {
            model: "gpt-4o-mini", // Fast, cost-effective for sentiment analysis
            temperature: 0.1, // Low temperature for consistent classification
            maxTokens: 500,
          }
        );

        if (sentimentResult) {
          try {
            const sentimentData = JSON.parse(sentimentResult.response);
            if (sentimentData.total > 0) {
              positiveRatio = sentimentData.positive_count / sentimentData.total;
            }
          } catch (parseError) {
            logger.warn("Failed to parse sentiment analysis, using fallback", {
              error: parseError instanceof Error ? parseError.message : String(parseError),
            });
          }
        }
      }
    } catch (sentimentError) {
      logger.warn("AI sentiment analysis failed, using fallback", {
        error: sentimentError instanceof Error ? sentimentError.message : String(sentimentError),
      });
      // Continue with fallback value
    }

    const highDecisivenessRatio = totalClaims > 0 ? highDecisivenessClaims / totalClaims : 0.5;
    const perceptionHealthScore =
      positiveRatio * 0.4 + highDecisivenessRatio * 0.3 + (trustAssetArtifactsCount > 0 ? 0.3 : 0);

    // 2. Outbreak Probability (7 days)
    const eventStore = new DatabaseEventStore();
    const beliefGraph = new BeliefGraphService(eventStore);
    const forecastService = new ForecastService(eventStore, beliefGraph);

    // Get recent signals for outbreak forecast
    const recentSignals = await db.evidence.findMany({
      where: {
        tenantId: tenant_id,
        createdAt: { gte: startDate },
        type: "SIGNAL",
      },
      take: 100,
      select: { contentMetadata: true },
    }).catch(() => []);

    const signalsForForecast = recentSignals.map((s) => ({
      amplification: ((s.contentMetadata as any) || {})?.amplification ?? 0.5,
      sentiment: ((s.contentMetadata as any) || {})?.sentiment ?? 0.5,
    }));

    let outbreakProbability = 0;
    try {
      const outbreakForecast = await forecastService.forecastOutbreak(
        tenant_id,
        7,
        signalsForForecast
      );
      outbreakProbability = outbreakForecast.probability;
    } catch (error) {
      logger.warn("Outbreak forecast failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 3. AI Citation Coverage (percentage of AI answers with citations)
    const [snapshotsWithCitations, totalSnapshots] = await Promise.all([
      db.aIAnswerSnapshot.count({
        where: {
          tenantId: tenant_id,
          createdAt: { gte: startDate },
          citations: { isEmpty: false } as any,
        },
      }).catch(() => 0),
      db.aIAnswerSnapshot.count({
        where: {
          tenantId: tenant_id,
          createdAt: { gte: startDate },
        },
      }).catch(() => 0),
    ]);

    const citationCoverage = totalSnapshots > 0 ? snapshotsWithCitations / totalSnapshots : 0;

    // 4. Trust Coverage Ratio (clusters with trust assets / total clusters)
    const [totalClusters, mappedArtifacts] = await Promise.all([
      db.claimCluster.count({ where: { tenantId: tenant_id } }).catch(() => 0),
      db.aAALArtifact.findMany({
        where: { tenantId: tenant_id, status: "PUBLISHED", policyChecks: ({ not: null } as any) },
        select: { policyChecks: true },
      }).catch(() => []),
    ]);

    const clusterIdsWithTrust = new Set<string>();
    for (const a of mappedArtifacts) {
      const pc = (a.policyChecks || {}) as any;
      const mappings = Array.isArray(pc.trust_mappings) ? pc.trust_mappings : [];
      for (const m of mappings) {
        const cid = typeof m?.cluster_id === "string" ? m.cluster_id : null;
        if (cid) clusterIdsWithTrust.add(cid);
      }
    }
    const clustersWithTrust = clusterIdsWithTrust.size;

    const trustCoverageRatio = totalClusters > 0 ? clustersWithTrust / totalClusters : 0;

    return NextResponse.json({
      perception_health_score: Math.round(perceptionHealthScore * 100) / 100,
      outbreak_probability_7d: Math.round(outbreakProbability * 100) / 100,
      ai_citation_coverage: Math.round(citationCoverage * 100) / 100,
      trust_coverage_ratio: Math.round(trustCoverageRatio * 100) / 100,
      range,
      calculated_at: new Date().toISOString(),
      breakdown: {
        positive_claims_ratio: positiveRatio,
        high_decisiveness_ratio: highDecisivenessRatio,
        trust_assets_count: trustAssetArtifactsCount,
        snapshots_with_citations: snapshotsWithCitations,
        total_snapshots: totalSnapshots,
        clusters_with_trust: clustersWithTrust,
        total_clusters: totalClusters,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error fetching metrics summary", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        perception_health_score: 0,
        outbreak_probability_7d: 0,
        ai_citation_coverage: 0,
        trust_coverage_ratio: 0,
      },
      { status: 500 }
    );
  }
}
