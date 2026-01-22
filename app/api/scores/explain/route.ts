/**
 * Score Explanation API
 * Generate detailed explanations for scores (decisiveness, trust, forecast confidence, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";
import type { ScoreExplanation } from "@/components/explain-score-drawer";

const explainSchema = z.object({
  entityType: z.enum(["claim", "forecast", "belief_node", "cluster", "artifact"]).optional(),
  entityId: z.string().optional(),
  score_id: z.string().optional(),
  score_type: z.string().optional(),
  scoreType: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const searchParams = request.nextUrl.searchParams;
    
    // Support both formats: score_id/score_type or entityType/entityId/scoreType
    const scoreId = searchParams.get("score_id") || searchParams.get("entityId") || "";
    const scoreType = searchParams.get("score_type") || searchParams.get("scoreType") || "decisiveness";
    
    // Parse scoreId if it contains entity type (format: "entityType:entityId")
    let entityType = searchParams.get("entityType") || "claim";
    let entityId = scoreId;
    
    if (scoreId.includes(":")) {
      const parts = scoreId.split(":");
      entityType = parts[0];
      entityId = parts[1];
    }
    
    const validated = explainSchema.parse({
      entityType: entityType as any,
      entityId,
      scoreType,
    });

    let explanation: ScoreExplanation | null = null;

    if (validated.entityType === "claim") {
      const claim = await db.claim.findFirst({
        where: {
          id: validated.entityId,
          tenantId: tenant_id,
        },
        include: {
          evidenceRefs: {
            include: {
              evidence: true,
            },
            take: 10,
          },
          cluster: {
            include: {
              primaryClaim: true,
            },
          },
        },
      });

      if (!claim) {
        return NextResponse.json({ error: "Claim not found" }, { status: 404 });
      }

      // Calculate contributing signals from evidence
      const contributingSignals = claim.evidenceRefs.map((ref, idx) => {
        const ev = ref.evidence;
        const metadata = (ev.contentMetadata || {}) as any;
        const sentiment = typeof metadata.sentiment === "number" ? metadata.sentiment : 0.5;
        const amplification = typeof metadata.amplification === "number" ? metadata.amplification : 0.3;

        const impact: "positive" | "negative" | "neutral" = sentiment > 0.6 ? "positive" : sentiment < 0.4 ? "negative" : "neutral";

        return {
          name: `${ev.type} from ${ev.sourceType}`,
          weight: 1 / claim.evidenceRefs.length,
          impact,
          description: `Evidence from ${ev.sourceType} with ${(sentiment * 100).toFixed(0)}% sentiment and ${(amplification * 100).toFixed(0)}% amplification`,
          evidenceRefs: [ev.id],
        };
      });

      // Weighting logic based on evidence count and cluster size
      const evidenceWeight = Math.min(0.6, claim.evidenceRefs.length / 10);
      const clusterWeight = claim.clusterId ? Math.min(0.3, (claim.cluster?.size || 0) / 20) : 0;
      const recencyWeight = 0.1;

      explanation = {
        score: claim.decisiveness,
        confidence: Math.min(0.9, 0.5 + (claim.evidenceRefs.length * 0.05)),
        contributingSignals: contributingSignals.length > 0 ? contributingSignals : [
          {
            name: "Base decisiveness",
            weight: 1.0,
            impact: "neutral",
            description: "Initial decisiveness score",
          },
        ],
        weightingLogic: {
          method: "evidence-weighted",
          factors: [
            {
              factor: "Evidence count",
              weight: evidenceWeight,
              rationale: `${claim.evidenceRefs.length} evidence item(s) support this claim`,
            },
            {
              factor: "Cluster size",
              weight: clusterWeight,
              rationale: claim.clusterId ? `Part of cluster with ${claim.cluster?.size || 0} claims` : "Not clustered",
            },
            {
              factor: "Recency",
              weight: recencyWeight,
              rationale: "Recent claims have higher weight",
            },
          ],
        },
        evidenceLinks: claim.evidenceRefs.slice(0, 5).map((ref) => ({
          id: ref.evidence.id,
          type: "evidence" as const,
          title: `${ref.evidence.type} evidence`,
          url: `/evidence/${ref.evidence.id}`,
          relevance: 0.8,
        })),
      };
    } else if (validated.entityType === "forecast") {
      const forecast = await db.forecast.findFirst({
        where: {
          id: validated.entityId,
          tenantId: tenant_id,
        },
      });

      if (!forecast) {
        return NextResponse.json({ error: "Forecast not found" }, { status: 404 });
      }

      explanation = {
        score: forecast.value,
        confidence: forecast.confidenceLevel,
        contributingSignals: [
          {
            name: "Model confidence",
            weight: 0.4,
            impact: forecast.confidenceLevel > 0.7 ? "positive" : "neutral",
            description: `Forecast model: ${forecast.model}`,
          },
          {
            name: "Confidence interval",
            weight: 0.3,
            impact: "neutral",
            description: `Range: ${forecast.confidenceLower.toFixed(2)} - ${forecast.confidenceUpper.toFixed(2)}`,
          },
          {
            name: "Horizon",
            weight: 0.2,
            impact: "neutral",
            description: `${forecast.horizonDays} day forecast`,
          },
          {
            name: "Evaluation score",
            weight: 0.1,
            impact: forecast.evalScore && forecast.evalScore > 0.7 ? "positive" : "neutral",
            description: forecast.evalScore ? `Eval: ${forecast.evalScore.toFixed(2)}` : "No evaluation yet",
          },
        ],
        weightingLogic: {
          method: "forecast-weighted",
          factors: [
            {
              factor: "Model performance",
              weight: 0.4,
              rationale: `Using ${forecast.model} model`,
            },
            {
              factor: "Confidence interval width",
              weight: 0.3,
              rationale: "Narrower intervals indicate higher confidence",
            },
            {
              factor: "Time horizon",
              weight: 0.2,
              rationale: "Shorter horizons are more reliable",
            },
            {
              factor: "Historical accuracy",
              weight: 0.1,
              rationale: forecast.evalScore ? `Previous accuracy: ${(forecast.evalScore * 100).toFixed(0)}%` : "No historical data",
            },
          ],
        },
        evidenceLinks: [
          {
            id: forecast.id,
            type: "forecast",
            title: `${forecast.type} forecast`,
            url: `/forecasts?id=${forecast.id}`,
            relevance: 1.0,
          },
        ],
      };
    } else if (validated.entityType === "belief_node") {
      const node = await db.beliefNode.findFirst({
        where: {
          id: validated.entityId,
          tenantId: tenant_id,
        },
        include: {
          fromEdges: {
            take: 5,
          },
          toEdges: {
            take: 5,
          },
        },
      });

      if (!node) {
        return NextResponse.json({ error: "Belief node not found" }, { status: 404 });
      }

      const trustScore = validated.scoreType === "trust" ? node.trustScore : node.decisiveness;

      explanation = {
        score: trustScore,
        confidence: Math.min(0.9, 0.5 + ((node.fromEdges.length + node.toEdges.length) * 0.05)),
        contributingSignals: [
          {
            name: "Incoming edges",
            weight: 0.4,
            impact: "positive",
            description: `${node.toEdges.length} incoming reinforcement/neutralization edge(s)`,
          },
          {
            name: "Outgoing edges",
            weight: 0.3,
            impact: "positive",
            description: `${node.fromEdges.length} outgoing edge(s)`,
          },
          {
            name: "Decay factor",
            weight: 0.2,
            impact: node.decayFactor < 0.95 ? "negative" : "neutral",
            description: `Decay: ${(node.decayFactor * 100).toFixed(0)}% per period`,
          },
          {
            name: "Actor weights",
            weight: 0.1,
            impact: "neutral",
            description: "Weighted by actor influence",
          },
        ],
        weightingLogic: {
          method: "graph-weighted",
          factors: [
            {
              factor: "Graph connectivity",
              weight: 0.4,
              rationale: `${node.fromEdges.length + node.toEdges.length} total edges`,
            },
            {
              factor: "Decay rate",
              weight: 0.3,
              rationale: `Decay factor: ${node.decayFactor}`,
            },
            {
              factor: "Node type",
              weight: 0.2,
              rationale: `Type: ${node.type}`,
            },
            {
              factor: "Actor influence",
              weight: 0.1,
              rationale: "Weighted by actor participation",
            },
          ],
        },
        evidenceLinks: [],
      };
    } else if (validated.entityType === "cluster") {
      const cluster = await db.claimCluster.findFirst({
        where: {
          id: validated.entityId,
          tenantId: tenant_id,
        },
        include: {
          primaryClaim: true,
          claims: {
            take: 10,
          },
        },
      });

      if (!cluster) {
        return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
      }

      explanation = {
        score: cluster.decisiveness,
        confidence: Math.min(0.9, 0.5 + (cluster.size * 0.02)),
        contributingSignals: [
          {
            name: "Cluster size",
            weight: 0.5,
            impact: "positive",
            description: `${cluster.size} claims in cluster`,
          },
          {
            name: "Primary claim decisiveness",
            weight: 0.3,
            impact: cluster.primaryClaim.decisiveness > 0.5 ? "positive" : "neutral",
            description: `Primary: ${cluster.primaryClaim.decisiveness.toFixed(2)}`,
          },
          {
            name: "Claim diversity",
            weight: 0.2,
            impact: "neutral",
            description: "Variety of claim expressions",
          },
        ],
        weightingLogic: {
          method: "cluster-weighted",
          factors: [
            {
              factor: "Size",
              weight: 0.5,
              rationale: `Cluster contains ${cluster.size} claims`,
            },
            {
              factor: "Primary claim strength",
              weight: 0.3,
              rationale: `Primary claim decisiveness: ${cluster.primaryClaim.decisiveness.toFixed(2)}`,
            },
            {
              factor: "Coherence",
              weight: 0.2,
              rationale: "Similarity of clustered claims",
            },
          ],
        },
        evidenceLinks: cluster.claims.slice(0, 5).map((claim) => ({
          id: claim.id,
          type: "claim" as const,
          title: claim.canonicalText.substring(0, 50),
          url: `/claims/${claim.id}`,
          relevance: 0.8,
        })),
      };
    } else if (validated.entityType === "artifact") {
      const artifact = await db.aAALArtifact.findFirst({
        where: {
          id: validated.entityId,
          tenantId: tenant_id,
        },
        include: {
          evidenceRefs: {
            include: { evidence: true },
            take: 10,
          },
          approvals: {
            take: 10,
          },
        },
      });

      if (!artifact) {
        return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
      }

      const evidenceCount = artifact.evidenceRefs.length;
      const published = artifact.status === "PUBLISHED";
      const base = published ? 0.7 : 0.4;
      const evidenceBoost = Math.min(0.25, evidenceCount * 0.03);
      const score = Math.min(1, base + evidenceBoost);

      explanation = {
        score,
        confidence: Math.min(0.95, 0.5 + evidenceCount * 0.05),
        contributingSignals:
          evidenceCount > 0
            ? artifact.evidenceRefs.map((ref) => ({
                name: `Evidence: ${ref.evidence.sourceType}`,
                weight: 1 / evidenceCount,
                impact: "positive",
                description: `Linked evidence from ${ref.evidence.sourceType}`,
                evidenceRefs: [ref.evidence.id],
              }))
            : [
                {
                  name: "No linked evidence",
                  weight: 1.0,
                  impact: "negative",
                  description: "This artifact has no linked evidence references",
                },
              ],
        weightingLogic: {
          method: "artifact-trust",
          factors: [
            {
              factor: "Publication status",
              weight: 0.6,
              rationale: published
                ? "Published artifacts are treated as higher trust"
                : "Draft artifacts are lower trust",
            },
            {
              factor: "Evidence density",
              weight: 0.4,
              rationale: `${evidenceCount} linked evidence item(s)`,
            },
          ],
        },
        evidenceLinks: artifact.evidenceRefs.slice(0, 10).map((ref) => ({
          id: ref.evidence.id,
          type: "evidence" as const,
          title: `${ref.evidence.type} evidence`,
          url: `/evidence/${ref.evidence.id}`,
          relevance: 0.8,
        })),
      };
    }

    if (!explanation) {
      return NextResponse.json({ error: "Unsupported entity type" }, { status: 400 });
    }

    return NextResponse.json(explanation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }

    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Score explanation error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
