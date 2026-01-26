/**
 * Admin API: Normalize User Emails
 * 
 * Normalizes all user emails in the database to lowercase.
 * This fixes login issues caused by email case sensitivity.
 * 
 * Security: Should be protected in production (add authentication check)
 * 
 * Usage:
 *   POST /api/admin/normalize-emails
 *   Authorization: Bearer <admin-token> (add this in production)
 */

import { NextRequest, NextResponse } from "next/server";
import { normalizeUserEmails } from "@/scripts/normalize-emails-production";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const normalizeEmailsOptionsSchema = z.object({
  dryRun: z.boolean().optional(),
  batchSize: z.number().int().positive().max(1000).optional(),
}).optional();

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const user = await requireAuth();
    await requireRole("ADMIN");

    logger.info("Email normalization API called", {
      userId: (user as any).id,
      tenantId: (user as any).tenantId,
    });

    // Parse optional body for configuration
    let body: z.infer<typeof normalizeEmailsOptionsSchema> = undefined;
    try {
      const rawBody = await request.json();
      body = normalizeEmailsOptionsSchema.parse(rawBody);
    } catch {
      // Body is optional, continue without it
    }

    const result = await normalizeUserEmails();

    return NextResponse.json({
      success: true,
      message: "Email normalization complete",
      result: {
        total: result.total,
        updated: result.updated,
        skipped: result.skipped,
        conflicts: result.conflicts.length,
        errors: result.errors.length,
        details: {
          conflicts: result.conflicts,
          errors: result.errors,
        },
      },
    });
  } catch (error) {
    logger.error("Error in email normalization API", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if ((error as Error).message === "Unauthorized" || (error as Error).message === "Forbidden") {
      return NextResponse.json(
        { error: "Unauthorized", message: "Admin access required" },
        { status: 403 }
      );
    }

    logger.error("Error in email normalization API", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Failed to normalize emails",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Allow GET for status check
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Email normalization endpoint",
    usage: "POST /api/admin/normalize-emails to normalize all user emails",
    note: "This endpoint normalizes all user emails to lowercase to fix login issues.",
  });
}
