/**
 * Audit Bundle Export API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { AuditBundleService } from "@/lib/governance/audit-bundle";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { z } from "zod";

const eventStore = new DatabaseEventStore();
const evidenceVault = new DatabaseEvidenceVault();
const auditLog = new DatabaseAuditLog();
const auditBundleService = new AuditBundleService(
  auditLog,
  eventStore,
  evidenceVault
);

const createBundleSchema = z.object({
  resource_id: z.string(),
  resource_type: z.string(),
  time_range: z.object({
    start: z.string(),
    end: z.string(),
  }),
  correlation_id: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    // Get resources that can have audit bundles (clusters, artifacts, etc.)
    const [clusters, artifacts, approvals] = await Promise.all([
      db.claimCluster.findMany({
        where: { tenantId: tenant_id },
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          primaryClaim: {
            select: {
              canonicalText: true,
            },
          },
          createdAt: true,
        },
      }),
      db.aAALArtifact.findMany({
        where: { tenantId: tenant_id },
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      }),
      db.approval.findMany({
        where: { tenantId: tenant_id },
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          resourceType: true,
          resourceId: true,
          createdAt: true,
        },
      }),
    ]);

    const bundles = [
      ...clusters.map((c) => ({
        id: c.id,
        resource_type: "CLAIM_CLUSTER",
        resource_id: c.id,
        title: c.primaryClaim?.canonicalText?.substring(0, 50) || "Cluster",
        created_at: c.createdAt.toISOString(),
      })),
      ...artifacts.map((a) => ({
        id: a.id,
        resource_type: "AAAL_ARTIFACT",
        resource_id: a.id,
        title: a.title,
        created_at: a.createdAt.toISOString(),
      })),
      ...approvals.map((ap) => ({
        id: ap.id,
        resource_type: ap.resourceType,
        resource_id: ap.resourceId,
        title: `${ap.resourceType}: ${ap.resourceId.substring(0, 20)}`,
        created_at: ap.createdAt.toISOString(),
      })),
    ];

    return NextResponse.json({ bundles });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error fetching audit bundle resources", {
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
    const user = await requireRole("ADMIN"); // Only admins can export audit bundles
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();
    const validated = createBundleSchema.parse(body);

    const bundle = await auditBundleService.createBundle(
      tenant_id,
      validated.resource_id,
      validated.resource_type,
      validated.time_range,
      validated.correlation_id
    );

    const format = new URL(request.url).searchParams.get("format") || "json";

    if (format === "pdf") {
      const pdfBlob = await auditBundleService.exportPDF(bundle);
      // Check if it's actually a PDF (from jsPDF) or text fallback
      const contentType = pdfBlob.type === "application/pdf" 
        ? "application/pdf" 
        : "text/plain";
      const extension = contentType === "application/pdf" ? "pdf" : "txt";
      
      return new NextResponse(pdfBlob, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="audit-bundle-${bundle.bundle_id}.${extension}"`,
        },
      });
    }

    const json = await auditBundleService.exportJSON(bundle);
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="audit-bundle-${bundle.bundle_id}.json"`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    if ((error as Error).message === "Unauthorized" || (error as Error).message === "Forbidden") {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: (error as Error).message === "Unauthorized" ? 401 : 403 }
      );
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error creating audit bundle", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
