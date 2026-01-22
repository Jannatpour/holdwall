/**
 * Entitlement API (Individual)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const entitlementSchema = z.object({
  softLimit: z.number().int().min(1).optional(),
  hardLimit: z.number().int().min(1).optional(),
  enforcement: z.enum(["SOFT", "HARD", "NONE"]).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id: string | undefined;
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const resolvedParams = await params;
    id = resolvedParams.id;
    const body = await request.json();
    const validated = entitlementSchema.parse(body);

    const entitlement = await db.entitlement.findUnique({
      where: { id },
    });

    if (!entitlement || entitlement.tenantId !== tenant_id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await db.entitlement.update({
      where: { id },
      data: validated,
    });

    return NextResponse.json({
      entitlement: {
        id: updated.id,
        metric: updated.metric,
        softLimit: updated.softLimit,
        hardLimit: updated.hardLimit,
        currentUsage: updated.currentUsage,
        enforcement: updated.enforcement,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error updating entitlement", {
      entitlementId: id || "unknown",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
