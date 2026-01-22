/**
 * Financial Services Perception Brief API
 * 
 * Generates financial-grade perception brief with:
 * - Narrative clusters specific to financial services
 * - Regulatory risk indicators
 * - Legal approval status
 * - Evidence-backed explanations
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { financialServicesMode, FinancialNarrativeCategory } from "@/lib/financial-services/operating-mode";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const config = await financialServicesMode.getConfig(tenantId);

    // Get top claim clusters
    const clusters = await db.claimCluster.findMany({
      where: { tenantId },
      orderBy: [{ decisiveness: "desc" }, { size: "desc" }],
      take: 10,
      include: {
        primaryClaim: true,
      },
    });

    // Categorize clusters by financial narrative type
    const categorizedClusters = await Promise.all(
      clusters.map(async (cluster) => {
        const category = await categorizeNarrative(
          cluster.primaryClaim.canonicalText,
          config.narrativeCategories
        );
        const escalation = await financialServicesMode.checkEscalation(
          tenantId,
          category,
          cluster.primaryClaim.canonicalText
        );

        return {
          id: cluster.id,
          primaryClaim: cluster.primaryClaim.canonicalText,
          size: cluster.size,
          decisiveness: cluster.decisiveness || 0,
          category,
          requiresEscalation: escalation.requiresEscalation,
          severity: escalation.severity,
          routeTo: escalation.routeTo,
        };
      })
    );

    // Get outbreak probability
    const outbreakForecasts = await db.forecast.findMany({
      where: {
        tenantId,
        type: "OUTBREAK",
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    let outbreakProbability = outbreakForecasts[0]
      ? clamp(Number(outbreakForecasts[0].value) * 100, 0, 100)
      : 0;

    // Get pending approvals requiring legal review
    const pendingLegalApprovals = await db.approval.count({
      where: {
        tenantId,
        decision: null,
        approvers: {
          has: "Legal",
        },
      },
    });

    // Get evidence-backed artifacts
    const artifacts = await db.aAALArtifact.findMany({
      where: {
        tenantId,
        status: { in: ["DRAFT", "APPROVED", "PUBLISHED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        approvals: {
          where: { decision: "APPROVED" },
          take: 1,
        },
      },
    });

    // Generate recommended actions
    const recommendedActions: Array<{
      priority: "high" | "medium" | "low";
      action: string;
      rationale: string;
      category?: FinancialNarrativeCategory;
    }> = [];

    // High-priority: Escalation required clusters
    const highSeverityClusters = categorizedClusters.filter(
      (c) => c.requiresEscalation && c.severity === "high"
    );
    for (const cluster of highSeverityClusters.slice(0, 3)) {
      recommendedActions.push({
        priority: "high",
        action: `Escalate "${cluster.primaryClaim.substring(0, 60)}..."`,
        rationale: `High-severity ${cluster.category} narrative requires immediate attention. Route to: ${cluster.routeTo.join(", ")}`,
        category: cluster.category,
      });
    }

    // High-priority: Pending legal approvals
    if (pendingLegalApprovals > 0) {
      recommendedActions.push({
        priority: "high",
        action: "Review pending legal approvals",
        rationale: `${pendingLegalApprovals} artifact(s) awaiting legal review. Financial Services mode requires legal approval before publishing.`,
      });
    }

    // Medium-priority: Outbreak probability
    if (outbreakProbability >= 60) {
      recommendedActions.push({
        priority: "medium",
        action: "Draft pre-emptive response artifact",
        rationale: `Outbreak probability is ${outbreakProbability}%. Prepare evidence-backed explanation and route through legal approval.`,
      });
    }

    // Medium-priority: Large clusters without evidence
    const clustersWithoutEvidence = categorizedClusters.filter(
      (c) => c.size >= 10 && !c.requiresEscalation
    );
    for (const cluster of clustersWithoutEvidence.slice(0, 2)) {
      recommendedActions.push({
        priority: "medium",
        action: `Generate evidence-backed explanation for "${cluster.primaryClaim.substring(0, 50)}..."`,
        rationale: `Cluster has ${cluster.size} claims but no authoritative explanation. Create AAAL artifact.`,
        category: cluster.category,
      });
    }

    return NextResponse.json({
      date: new Date().toISOString().split("T")[0],
      outbreakProbability,
      topClusters: categorizedClusters,
      pendingLegalApprovals,
      artifacts: artifacts.map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        hasLegalApproval: a.approvals.length > 0,
        createdAt: a.createdAt,
      })),
      recommendedActions,
      governanceLevel: config.governanceLevel,
      legalApprovalRequired: config.legalApprovalRequired,
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error generating Financial Services perception brief", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Categorize narrative by financial services category
 */
async function categorizeNarrative(
  claimText: string,
  categories: FinancialNarrativeCategory[]
): Promise<FinancialNarrativeCategory> {
  const text = claimText.toLowerCase();

  // Simple keyword matching (in production, use NLP)
  if (text.includes("scam") || text.includes("fraud")) {
    return "scam_fraud";
  }

  if (text.includes("freeze") || text.includes("frozen") || text.includes("hold")) {
    return "account_freezes";
  }

  if (text.includes("fee") || text.includes("charge") || text.includes("cost")) {
    return "hidden_fees";
  }

  if (text.includes("transaction") && (text.includes("fail") || text.includes("error"))) {
    return "transaction_failures";
  }

  if (text.includes("insurance") && (text.includes("deny") || text.includes("refuse"))) {
    return "insurance_denials";
  }

  if (text.includes("privacy") || text.includes("data") || text.includes("breach")) {
    return "data_privacy";
  }

  if (text.includes("regulator") || text.includes("compliance") || text.includes("violation")) {
    return "regulatory_allegations";
  }

  if (text.includes("outage") || text.includes("down") || text.includes("unavailable")) {
    return "platform_outages";
  }

  // Default to scam_fraud if uncertain
  return "scam_fraud";
}
