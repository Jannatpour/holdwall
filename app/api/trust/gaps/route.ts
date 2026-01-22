/**
 * Trust Gaps API
 * 
 * Identifies claim clusters missing trust assets
 * Trust Gap Map for overview
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    // Get all clusters
    const clusters = await db.claimCluster.findMany({
      where: {
        tenantId: tenant_id,
      },
      include: {
        primaryClaim: true,
      },
    });

    // Get published artifacts (these can serve as trust assets)
    const publishedArtifacts = await db.aAALArtifact.findMany({
      where: {
        tenantId: tenant_id,
        status: "PUBLISHED",
      },
      select: {
        id: true,
        title: true,
        content: true,
      },
    });

    // Identify gaps: clusters without associated artifacts
    // Simple heuristic: check if artifact title/content mentions cluster claim
    const gaps: Array<{
      cluster_id: string;
      cluster_text: string;
      severity: "high" | "medium" | "low";
      recommended_asset_types: string[];
      rationale: string;
    }> = [];

    for (const cluster of clusters) {
      const clusterText = cluster.primaryClaim.canonicalText.toLowerCase();
      let hasCoverage = false;

      // Check if any artifact covers this cluster
      for (const artifact of publishedArtifacts) {
        const artifactText = `${artifact.title} ${(artifact.content as string || "").substring(0, 500)}`.toLowerCase();
        // Simple keyword matching (in production, would use embeddings)
        const keywords = clusterText.split(/\s+/).filter(w => w.length > 4);
        const matches = keywords.filter(kw => artifactText.includes(kw));
        if (matches.length >= 2) {
          hasCoverage = true;
          break;
        }
      }

      if (!hasCoverage) {
        // Determine severity based on decisiveness and size
        const severity = cluster.decisiveness >= 0.7 && cluster.size >= 10
          ? "high"
          : cluster.decisiveness >= 0.5 || cluster.size >= 5
            ? "medium"
            : "low";

        // Recommend asset types based on cluster characteristics
        const recommendedTypes: string[] = [];
        if (clusterText.includes("scam") || clusterText.includes("fraud")) {
          recommendedTypes.push("SOC2", "Security Audit", "Incident Response");
        } else if (clusterText.includes("downtime") || clusterText.includes("outage")) {
          recommendedTypes.push("SLA", "Uptime Report", "Status Page");
        } else if (clusterText.includes("privacy") || clusterText.includes("data")) {
          recommendedTypes.push("Privacy Policy", "GDPR Compliance", "Data Protection");
        } else {
          recommendedTypes.push("Trust Badge", "Certification", "Third-party Audit");
        }

        gaps.push({
          cluster_id: cluster.id,
          cluster_text: cluster.primaryClaim.canonicalText,
          severity,
          recommended_asset_types: recommendedTypes,
          rationale: `Cluster with decisiveness ${(cluster.decisiveness * 100).toFixed(0)}% and ${cluster.size} claims lacks trust asset coverage.`,
        });
      }
    }

    // Sort by severity
    gaps.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    return NextResponse.json({
      gaps,
      total_gaps: gaps.length,
      high_severity: gaps.filter(g => g.severity === "high").length,
      medium_severity: gaps.filter(g => g.severity === "medium").length,
      low_severity: gaps.filter(g => g.severity === "low").length,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching trust gaps", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
