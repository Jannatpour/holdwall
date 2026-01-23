/**
 * Narrative Risk Brief API
 * Auto-generated daily executive brief showing top claim clusters, outbreak probability, and recommended actions
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { AdvancedAIIntegration } from "@/lib/ai/integration";
import { logger } from "@/lib/logging/logger";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function computeOutbreakProbabilityFromSignals(
  signals: Array<{ amplification: number; sentiment: number }>
): { probability: number; confidence: number; sample_size: number } {
  if (signals.length === 0) {
    return { probability: 0, confidence: 0.5, sample_size: 0 };
  }

  // Normalize and compute per-signal risk \(r = amplification * (1 - sentiment)\).
  const risks = signals.map((s) => {
    const amplification = clamp(s.amplification, 0, 1);
    const sentiment = clamp(s.sentiment, 0, 1);
    return amplification * (1 - sentiment);
  });

  const mean =
    risks.reduce((sum, v) => sum + v, 0) / (risks.length || 1);
  const variance =
    risks.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (risks.length || 1);
  const std = Math.sqrt(variance);

  // Convert mean risk + volume into probability using a saturating curve.
  // This yields stable behavior under spikes while still responding to sustained risk.
  const volumeFactor = Math.log1p(risks.length) / Math.log(1 + 100); // ~0..1 for 0..100+
  const intensity = mean * (0.6 + 0.4 * volumeFactor);
  const probability = clamp(1 - Math.exp(-3.0 * intensity), 0, 1);

  // Confidence increases with sample size and lower variance.
  const sizeConfidence = clamp(risks.length / 50, 0, 1);
  const stabilityConfidence = clamp(1 - std, 0, 1);
  const confidence = clamp(0.5 + 0.4 * (0.7 * sizeConfidence + 0.3 * stabilityConfidence), 0.5, 0.9);

  return { probability, confidence, sample_size: risks.length };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    // Get top claim clusters
    const clusters = await db.claimCluster.findMany({
      where: { tenantId: tenant_id },
      orderBy: [{ decisiveness: "desc" }, { size: "desc" }],
      take: 10,
      include: {
        primaryClaim: true,
      },
    });

    // Get recent forecasts for outbreak probability
    const outbreakForecasts = await db.forecast.findMany({
      where: {
        tenantId: tenant_id,
        type: "OUTBREAK",
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    let outbreakProbability = outbreakForecasts[0]
      ? clamp(Number(outbreakForecasts[0].value) * 100, 0, 100)
      : 0;
    let outbreakConfidence = outbreakForecasts[0]
      ? clamp(Number(outbreakForecasts[0].confidenceLevel), 0.5, 0.95)
      : 0.5;

    // If no recent outbreak forecast exists, compute from the last 7 days of ingested signals.
    // Signals persist their metadata (amplification/sentiment) in Evidence.contentMetadata.
    if (!outbreakForecasts[0]) {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const signalEvidence = await db.evidence.findMany({
        where: {
          tenantId: tenant_id,
          type: "SIGNAL",
          createdAt: { gte: since },
        },
        take: 200,
        orderBy: { createdAt: "desc" },
        select: {
          contentMetadata: true,
        },
      });

      const signals = signalEvidence
        .map((e) => {
          const meta = (e.contentMetadata || {}) as any;
          return {
            amplification: typeof meta.amplification === "number" ? meta.amplification : 0.3,
            sentiment: typeof meta.sentiment === "number" ? meta.sentiment : 0.5,
          };
        })
        .filter((s) => Number.isFinite(s.amplification) && Number.isFinite(s.sentiment));

      const computed = computeOutbreakProbabilityFromSignals(signals);
      outbreakProbability = Math.round(computed.probability * 100);
      outbreakConfidence = computed.confidence;
    }

    // Recent signal volume for context
    const sinceSignals = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSignalCount = await db.event.count({
      where: {
        tenantId: tenant_id,
        type: { contains: "signal", mode: "insensitive" },
        occurredAt: { gte: sinceSignals },
      },
    });

    // AI citation coverage proxy: share of claims that are evidence-backed.
    const [claimsTotal, claimsWithEvidence] = await Promise.all([
      db.claim.count({ where: { tenantId: tenant_id } }),
      db.claim.count({
        where: {
          tenantId: tenant_id,
          evidenceRefs: { some: {} },
        },
      }),
    ]);

    const citationCoverage =
      claimsTotal > 0 ? Math.round((claimsWithEvidence / claimsTotal) * 100) : 0;

    // Pending approvals are treated as active incidents requiring human attention.
    const pendingApprovals = await db.approval.count({
      where: {
        tenantId: tenant_id,
        decision: null,
      },
    });

    // Generate recommended actions
    const recommendedActions: Array<{
      priority: "high" | "medium" | "low";
      action: string;
      rationale: string;
    }> = [];

    if (outbreakProbability >= 60) {
      recommendedActions.push({
        priority: "high",
        action: "Draft pre-emptive response artifact",
        rationale: `Outbreak probability is ${outbreakProbability}% with ${(outbreakConfidence * 100).toFixed(0)}% confidence. Prepare an evidence-backed AAAL artifact and route it for approval.`,
      });
    }

    if (clusters.length > 0 && clusters[0].size >= 10) {
      recommendedActions.push({
        priority: "medium",
        action: "Review top claim cluster",
        rationale: `Largest cluster is ${clusters[0].size} claims: “${clusters[0].primaryClaim.canonicalText.substring(0, 140)}”. Review evidence and decide on a governed response.`,
      });
    }

    if (recentSignalCount >= 50) {
      recommendedActions.push({
        priority: "medium",
        action: "Review signal volume",
        rationale: `Signal ingestion volume is elevated (${recentSignalCount} in the last 24h). Verify whether clustering and forecasting are keeping up.`,
      });
    }

    if (pendingApprovals > 0) {
      recommendedActions.push({
        priority: pendingApprovals >= 5 ? "high" : "low",
        action: "Clear pending approvals",
        rationale: `${pendingApprovals} approval(s) are awaiting a decision. Clearing approvals reduces time-to-publish for governed responses.`,
      });
    }

    // AI-Enhanced Recommendations using Adaptive RAG (January 2026)
    try {
      const aiIntegration = new AdvancedAIIntegration({
        tenantId: tenant_id,
        enableAdvancedRAG: true,
      });

      const contextQuery = `Generate strategic narrative risk management recommendations based on:

Current State:
- Outbreak Probability: ${outbreakProbability}% (confidence: ${(outbreakConfidence * 100).toFixed(0)}%)
- Top Clusters: ${clusters.length} clusters, largest has ${clusters[0]?.size || 0} claims
- Recent Signals: ${recentSignalCount} in last 24h
- AI Citation Coverage: ${citationCoverage}%
- Pending Approvals: ${pendingApprovals}

Generate 3-5 additional strategic recommendations focusing on:
1. Proactive narrative defense strategies
2. Evidence-backed response planning
3. Trust asset optimization
4. Citation coverage improvement
5. Risk mitigation tactics

Return JSON array:
[
  {
    "priority": "high" | "medium" | "low",
    "action": "action description",
    "rationale": "detailed rationale"
  }
]`;

      const aiResult = await aiIntegration.queryAdaptiveRAG(
        contextQuery,
        {
          model: "gpt-4o-mini", // Fast model for recommendations
          temperature: 0.3, // Balanced for strategic recommendations
          maxTokens: 1500,
        }
      );

      if (aiResult) {
        try {
          const aiRecommendations = JSON.parse(aiResult.response);
          if (Array.isArray(aiRecommendations)) {
            // Add AI recommendations (limit to 5 to avoid overwhelming)
            for (const rec of aiRecommendations.slice(0, 5)) {
              if (rec.action && rec.rationale && rec.priority) {
                recommendedActions.push({
                  priority: rec.priority.toLowerCase() as "high" | "medium" | "low",
                  action: rec.action,
                  rationale: rec.rationale,
                });
              }
            }
          } else if (aiRecommendations.recommendations && Array.isArray(aiRecommendations.recommendations)) {
            // Handle nested structure
            for (const rec of aiRecommendations.recommendations.slice(0, 5)) {
              if (rec.action && rec.rationale && rec.priority) {
                recommendedActions.push({
                  priority: rec.priority.toLowerCase() as "high" | "medium" | "low",
                  action: rec.action,
                  rationale: rec.rationale,
                });
              }
            }
          }
        } catch (parseError) {
          logger.warn("Failed to parse AI recommendations for narrative risk brief", {
            error: parseError instanceof Error ? parseError.message : String(parseError),
          });
        }
      }
    } catch (aiError) {
      logger.warn("AI-enhanced recommendations generation failed for narrative risk brief", {
        error: aiError instanceof Error ? aiError.message : String(aiError),
      });
      // Continue with rule-based recommendations only
    }

    return NextResponse.json({
      date: new Date().toISOString().split("T")[0],
      outbreakProbability,
      topClusters: clusters.map((cluster) => ({
        id: cluster.id,
        primaryClaim: cluster.primaryClaim.canonicalText,
        size: cluster.size,
        decisiveness: cluster.decisiveness || 0,
      })),
      aiCitationCoverage: citationCoverage,
      activeIncidents: pendingApprovals,
      recommendedActions,
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error generating narrative risk brief", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
