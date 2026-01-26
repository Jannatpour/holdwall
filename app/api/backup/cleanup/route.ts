/**
 * Backup Cleanup API
 * Delete old backups based on retention policy
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { backupService } from "@/lib/backup/disaster-recovery";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

function isOpsBackupAuthorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (process.env.OPS_BACKUPS_ENABLED !== "true") return false;
  const token = (process.env.OPS_BACKUP_TOKEN || "").trim();
  if (!token) return false;
  const header = (request.headers.get("x-ops-backup-token") || "").trim();
  return header.length > 0 && header === token;
}

async function assertBackupAuthorized(request: NextRequest) {
  try {
    await requireAuth();
    await requireRole("ADMIN"); // Only admins can cleanup backups
    return;
  } catch (e) {
    if (isOpsBackupAuthorized(request)) return;
    throw e;
  }
}

const cleanupSchema = z.object({
  retentionDays: z.number().min(1).max(365).default(30),
});

export async function POST(request: NextRequest) {
  try {
    await assertBackupAuthorized(request);

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
