/**
 * Backup List API
 * List all backups for a tenant
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { backupService } from "@/lib/backup/disaster-recovery";
import { logger } from "@/lib/logging/logger";

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
    await requireRole("ADMIN"); // Only admins can list backups
    return;
  } catch (e) {
    if (isOpsBackupAuthorized(request)) return;
    throw e;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Ops mode (token-based) has no DB-auth context. In this mode, list backups directly from storage.
    if (isOpsBackupAuthorized(request)) {
      const s3Bucket = (process.env.S3_BACKUP_BUCKET || process.env.S3_BUCKET || "").trim();
      const region = (process.env.AWS_REGION || "us-east-1").trim();
      if (!s3Bucket) {
        return NextResponse.json({ error: "S3_BACKUP_BUCKET not configured" }, { status: 500 });
      }

      const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
      const s3 = new S3Client({ region });
      const resp = await s3.send(
        new ListObjectsV2Command({
          Bucket: s3Bucket,
          Prefix: "backups/",
          MaxKeys: 250,
        }),
      );

      const backups =
        (resp.Contents || [])
          .filter((o) => o.Key)
          .sort((a, b) => {
            const at = a.LastModified ? new Date(a.LastModified).getTime() : 0;
            const bt = b.LastModified ? new Date(b.LastModified).getTime() : 0;
            return bt - at;
          })
          .map((o) => ({
            key: o.Key!,
            size: o.Size ?? null,
            lastModified: o.LastModified ? new Date(o.LastModified).toISOString() : null,
            location: `s3://${s3Bucket}/${o.Key!}`,
          })) || [];

      return NextResponse.json({ source: "s3", backups });
    }

    await assertBackupAuthorized(request);

    const tenantId = request.nextUrl.searchParams.get("tenantId") || undefined;
    const backups = await backupService.listBackups(tenantId);
    return NextResponse.json({ source: "db", backups });
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
