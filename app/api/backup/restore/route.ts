/**
 * Backup Restore API
 * Restore from backup
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { backupService } from "@/lib/backup/disaster-recovery";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const restoreSchema = z.object({
  backupId: z.string(),
  tenantId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let body: any = null;
  try {
    await requireAuth();
    await requireRole("ADMIN"); // Only admins can restore backups

    body = await request.json();
    const { backupId, tenantId } = restoreSchema.parse(body);

    const result = await backupService.restoreBackup(backupId, tenantId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Backup restored successfully" });
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

    logger.error("Error restoring backup", {
      backupId: body?.backupId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
