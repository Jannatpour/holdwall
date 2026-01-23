/**
 * Audit Bundle Export API
 * Simplified endpoint for the AuditBundleExport component
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { AuditBundleService } from "@/lib/governance/audit-bundle";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";
import JSZip from "jszip";

const eventStore = new DatabaseEventStore();
const evidenceVault = new DatabaseEvidenceVault();
const auditLog = new DatabaseAuditLog();
const auditBundleService = new AuditBundleService(
  auditLog,
  eventStore,
  evidenceVault
);

const exportSchema = z.object({
  resource_type: z.string(),
  resource_id: z.string(),
  include_pdf: z.boolean().optional().default(true),
  include_json: z.boolean().optional().default(true),
  include_version_ids: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("VIEWER"); // Any authenticated user can export
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();
    const validated = exportSchema.parse(body);

    // Determine time range - default to last 90 days or all time if resource is recent
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Create the audit bundle
    const bundle = await auditBundleService.createBundle(
      tenant_id,
      validated.resource_id,
      validated.resource_type,
      {
        start: defaultStart.toISOString(),
        end: now.toISOString(),
      },
      undefined // correlation_id
    );

    // If both PDF and JSON are requested, create a ZIP file
    if (validated.include_pdf && validated.include_json) {
      const zip = new JSZip();

      // Add PDF
      const pdfBlob = await auditBundleService.exportPDF(bundle);
      zip.file(
        `audit-bundle-${bundle.bundle_id}.pdf`,
        await pdfBlob.arrayBuffer()
      );

      // Add JSON
      const jsonBlob = await auditBundleService.exportJSON(bundle);
      zip.file(
        `audit-bundle-${bundle.bundle_id}.json`,
        jsonBlob
      );

      // Add version IDs if requested
      if (validated.include_version_ids) {
        const versionIds = {
          bundle_version: bundle.version_ids.bundle_version,
          evidence_versions: bundle.version_ids.evidence_versions,
          event_versions: bundle.version_ids.event_versions,
          generated_at: new Date().toISOString(),
        };
        zip.file(
          `version-ids-${bundle.bundle_id}.json`,
          JSON.stringify(versionIds, null, 2)
        );
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      return new NextResponse(zipBlob, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="audit-bundle-${bundle.bundle_id}.zip"`,
        },
      });
    }

    // If only PDF is requested
    if (validated.include_pdf) {
      const pdfBlob = await auditBundleService.exportPDF(bundle);
      const contentType =
        pdfBlob.type === "application/pdf" ? "application/pdf" : "text/plain";
      const extension = contentType === "application/pdf" ? "pdf" : "txt";

      return new NextResponse(pdfBlob, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="audit-bundle-${bundle.bundle_id}.${extension}"`,
        },
      });
    }

    // If only JSON is requested (or default)
    const jsonBlob = await auditBundleService.exportJSON(bundle);
    return new NextResponse(jsonBlob, {
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
    if (
      (error as Error).message === "Unauthorized" ||
      (error as Error).message === "Forbidden"
    ) {
      return NextResponse.json(
        { error: (error as Error).message },
        {
          status:
            (error as Error).message === "Unauthorized" ? 401 : 403,
        }
      );
    }
    logger.error("Error exporting audit bundle", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
