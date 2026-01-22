/**
 * API Key API (Individual)
 * Manage individual API keys
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

/**
 * DELETE /api/integrations/api-keys/[id]
 * Revoke (soft delete) an API key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const { id } = await params;

    const key = await db.apiKey.findUnique({
      where: { id },
    });

    if (!key) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (key.tenantId !== tenant_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Revoke (soft delete) instead of hard delete for audit trail
    await db.apiKey.update({
      where: { id },
      data: { revoked: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error revoking API key", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
