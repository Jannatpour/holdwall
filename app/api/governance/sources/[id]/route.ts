/**
 * Source Policy API (Individual)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const policySchema = z.object({
  sourceType: z.string().optional(),
  allowedSources: z.array(z.string()).optional(),
  collectionMethod: z.enum(["API", "RSS", "EXPORT", "MANUAL"]).optional(),
  retentionDays: z.number().int().min(1).optional(),
  autoDelete: z.boolean().optional(),
  complianceFlags: z.array(z.string()).optional(),
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
    const validated = policySchema.parse(body);

    const policy = await db.sourcePolicy.findUnique({
      where: { id },
    });

    if (!policy || policy.tenantId !== tenant_id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await db.sourcePolicy.update({
      where: { id },
      data: validated,
    });

    return NextResponse.json({
      policy: {
        id: updated.id,
        sourceType: updated.sourceType,
        allowedSources: updated.allowedSources,
        collectionMethod: updated.collectionMethod,
        retentionDays: updated.retentionDays,
        autoDelete: updated.autoDelete,
        complianceFlags: updated.complianceFlags,
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
    const paramsResolved = await params;
    const policyId = paramsResolved.id;
    logger.error("Error updating source policy", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      policyId,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id: string | undefined;
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const resolvedParams = await params;
    id = resolvedParams.id;

    const policy = await db.sourcePolicy.findUnique({
      where: { id },
    });

    if (!policy || policy.tenantId !== tenant_id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.sourcePolicy.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const paramsResolved = await params;
    const policyId = paramsResolved.id;
    logger.error("Error deleting source policy", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      policyId,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
