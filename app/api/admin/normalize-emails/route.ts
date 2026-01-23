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
import { logger } from "@/lib/logging/logger";

export async function POST(request: NextRequest) {
  try {
    // Security: Add authentication check in production
    // For now, allow in development but require secret header in production
    if (process.env.NODE_ENV === "production") {
      const authHeader = request.headers.get("authorization");
      const expectedSecret = process.env.ADMIN_SECRET || process.env.NEXTAUTH_SECRET;
      
      if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    logger.info("Email normalization API called");

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
