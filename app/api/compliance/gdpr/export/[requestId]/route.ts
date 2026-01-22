/**
 * GDPR Export Download API
 * Serve exported user data for data portability requests
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  let requestId: string | undefined;
  try {
    const user = await requireAuth();
    const userId = (user as any).id;
    const tenantId = (user as any).tenantId || "";
    const resolvedParams = await params;
    requestId = resolvedParams.requestId;

    // Find export event
    const exportEvent = await db.event.findFirst({
      where: {
        type: "gdpr.export_created",
        correlationId: requestId,
        actorId: userId,
        tenantId,
      },
      orderBy: { occurredAt: "desc" },
    });

    if (!exportEvent) {
      return NextResponse.json(
        { error: "Export not found or access denied" },
        { status: 404 }
      );
    }

    // Check if export is in S3 (presigned URL) or stored in payload
    const payload = exportEvent.payload as any;
    const exportData = payload?.exportData;

    if (exportData) {
      // Return data from payload
      return new NextResponse(exportData, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="gdpr-export-${requestId}.json"`,
        },
      });
    }

    // If export URL is a presigned S3 URL, redirect to it
    const exportUrl = payload?.exportUrl;
    if (exportUrl && exportUrl.startsWith("https://")) {
      return NextResponse.redirect(exportUrl);
    }

    // Fallback: regenerate export
    const { gdprCompliance } = await import("@/lib/compliance/gdpr");
    const result = await gdprCompliance.requestDataPortability(userId, tenantId);

    if (result.exportUrl.startsWith("https://")) {
      return NextResponse.redirect(result.exportUrl);
    }

    return NextResponse.json(
      { error: "Export data not available" },
      { status: 404 }
    );
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Error serving GDPR export", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
