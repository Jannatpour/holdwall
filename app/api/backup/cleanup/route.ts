/**
 * Backup Cleanup API
 * Delete old backups based on retention policy
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { backupService } from "@/lib/backup/disaster-recovery";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const cleanupSchema = z.object({
  retentionDays: z.number().min(1).max(365).default(30),
});

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    await requireRole("ADMIN"); // Only admins can cleanup backups

    const body = await request.json();
    const { retentionDays } = cleanupSchema.parse(body);

    const deletedCount = await backupService.cleanupOldBackups(retentionDays);

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} backup(s) older than ${retentionDays} days`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }

    if ((error as Error).message === "Unauthorized" || (error as Error).message === "Forbidden") {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: (error as Error).message === "Unauthorized" ? 401 : 403 }
      );
    }

    logger.error("Backup cleanup error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
