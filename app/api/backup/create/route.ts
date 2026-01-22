/**
 * Backup Creation API
 * Create database backups
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { backupService } from "@/lib/backup/disaster-recovery";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const backupSchema = z.object({
  tenantId: z.string().optional(),
  compression: z.boolean().optional().default(true),
  encryption: z.boolean().optional().default(true),
  storageProvider: z.enum(["s3", "gcs", "azure", "local"]).optional().default("s3"),
});

export async function POST(request: NextRequest) {
  let config: z.infer<typeof backupSchema> | null = null;
  try {
    await requireAuth();
    await requireRole("ADMIN"); // Only admins can create backups

    const body = await request.json();
    config = backupSchema.parse(body);

    const result = await backupService.createBackup(config.tenantId, {
      compression: config.compression,
      encryption: config.encryption,
      storageProvider: config.storageProvider,
    });

    if (result.status === "failed") {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      backupId: result.backupId,
      timestamp: result.timestamp,
      size: result.size,
      location: result.location,
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

    logger.error("Error creating backup", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      storageProvider: config?.storageProvider,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
