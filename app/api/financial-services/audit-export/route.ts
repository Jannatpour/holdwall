/**
 * Financial Services Regulatory Audit Export API
 * 
 * Exports evidence bundles, approval trails, and publication history
 * for regulatory exams and internal audits
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { z } from "zod";
import { format } from "date-fns";

const exportSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  includeEvidence: z.boolean().optional().default(true),
  includeApprovals: z.boolean().optional().default(true),
  includeArtifacts: z.boolean().optional().default(true),
  includeForecasts: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const body = await request.json();
    const validated = exportSchema.parse(body);

    const startDate = validated.startDate
      ? new Date(validated.startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const endDate = validated.endDate ? new Date(validated.endDate) : new Date();

    const exportData: any = {
      exportMetadata: {
        tenantId,
        exportedAt: new Date().toISOString(),
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        exportedBy: (user as any).id || "system",
      },
    };

    // Export evidence bundles
    if (validated.includeEvidence) {
      const evidence = await db.evidence.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          claimRefs: {
            include: {
              claim: {
                include: {
                  cluster: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      exportData.evidence = evidence.map((e) => ({
        id: e.id,
        type: e.type,
        sourceType: e.sourceType,
        summary: e.contentNormalized || e.contentRaw || "",
        createdAt: e.createdAt.toISOString(),
        claims: e.claimRefs.map((ce) => ({
          id: ce.claim.id,
          canonicalText: ce.claim.canonicalText,
          clusterId: ce.claim.clusterId,
          clusterName: ce.claim.clusterId ? `Cluster ${ce.claim.clusterId}` : null,
        })),
      }));
    }

    // Export approval trails
    if (validated.includeApprovals) {
      const approvals = await db.approval.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          artifact: true,
        },
        orderBy: { createdAt: "desc" },
      });

      exportData.approvals = approvals.map((a) => ({
        id: a.id,
        resourceType: a.resourceType,
        resourceId: a.resourceId,
        action: a.action,
        requesterId: a.requesterId,
        approvers: a.approvers,
        decision: a.decision,
        approverId: a.approverId,
        reason: a.reason,
        createdAt: a.createdAt.toISOString(),
        decidedAt: a.decidedAt?.toISOString(),
        artifact: a.artifact
          ? {
              id: a.artifact.id,
              title: a.artifact.title,
              status: a.artifact.status,
            }
          : null,
      }));
    }

    // Export published artifacts
    if (validated.includeArtifacts) {
      const artifacts = await db.aAALArtifact.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          approvals: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      exportData.artifacts = artifacts.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        status: a.status,
        structuredData: (a as any).structuredData || null,
        createdAt: a.createdAt.toISOString(),
        publishedAt: a.publishedAt?.toISOString(),
        approvalTrail: a.approvals.map((ap) => ({
          approver: ap.approverId || "Unknown",
          decision: ap.decision,
          timestamp: ap.decidedAt?.toISOString() || ap.createdAt.toISOString(),
        })),
      }));
    }

    // Export forecasts (optional)
    if (validated.includeForecasts) {
      const forecasts = await db.forecast.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { createdAt: "desc" },
      });

      exportData.forecasts = forecasts.map((f) => ({
        id: f.id,
        type: f.type,
        value: f.value,
        confidenceLevel: f.confidenceLevel,
        horizonDays: f.horizonDays,
        createdAt: f.createdAt.toISOString(),
      }));
    }

    // Generate audit summary
    exportData.summary = {
      evidenceCount: exportData.evidence?.length || 0,
      approvalCount: exportData.approvals?.length || 0,
      artifactCount: exportData.artifacts?.length || 0,
      forecastCount: exportData.forecasts?.length || 0,
      approvedArtifacts: exportData.artifacts?.filter(
        (a: any) => a.status === "PUBLISHED"
      ).length || 0,
      pendingApprovals: exportData.approvals?.filter(
        (a: any) => a.decision === null
      ).length || 0,
    };

    return NextResponse.json(exportData, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="financial-services-audit-export-${format(
          new Date(),
          "yyyy-MM-dd"
        )}.json"`,
      },
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error exporting Financial Services audit data", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
