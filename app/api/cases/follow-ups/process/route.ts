/**
 * Follow-Ups Processing API
 * 
 * POST /api/cases/follow-ups/process - Process follow-ups for all cases
 * 
 * This endpoint should be called by a cron job to process follow-ups.
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { caseFollowUpsService } from "@/lib/cases/follow-ups";
import { logger } from "@/lib/logging/logger";

/**
 * POST /api/cases/follow-ups/process - Process follow-ups
 */
export async function POST(request: NextRequest) {
  try {
    // Get tenant ID from query param (optional - if not provided, process all tenants)
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId") || undefined;

    const sentCount = await caseFollowUpsService.processFollowUps(tenantId);

    logger.info("Follow-ups processed", {
      tenant_id: tenantId || "all",
      follow_ups_sent: sentCount,
    });

    return NextResponse.json({
      success: true,
      followUpsSent: sentCount,
    });
  } catch (error) {
    logger.error("Failed to process follow-ups", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to process follow-ups", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
