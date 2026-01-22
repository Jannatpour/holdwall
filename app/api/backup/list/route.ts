/**
 * Backup List API
 * List all backups for a tenant
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { backupService } from "@/lib/backup/disaster-recovery";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    await requireRole("ADMIN"); // Only admins can list backups

    const tenantId = request.nextUrl.searchParams.get("tenantId") || undefined;

    const backups = await backupService.listBackups(tenantId);

    return NextResponse.json({ backups });
  } catch (error) {
    if ((error as Error).message === "Unauthorized" || (error as Error).message === "Forbidden") {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: (error as Error).message === "Unauthorized" ? 401 : 403 }
      );
    }

    logger.error("Error listing backups", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
