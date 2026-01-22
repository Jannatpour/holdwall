/**
 * Source Compliance API
 * Manage source policies and retention rules
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const policySchema = z.object({
  sourceType: z.string(),
  allowedSources: z.array(z.string()),
  collectionMethod: z.enum(["API", "RSS", "EXPORT", "MANUAL"]),
  retentionDays: z.number().int().min(1),
  autoDelete: z.boolean(),
  complianceFlags: z.array(z.string()),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const policies = await db.sourcePolicy.findMany({
      where: { tenantId: tenant_id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      policies: policies.map((p) => ({
        id: p.id,
        sourceType: p.sourceType,
        allowedSources: p.allowedSources,
        collectionMethod: p.collectionMethod,
        retentionDays: p.retentionDays,
        autoDelete: p.autoDelete,
        complianceFlags: p.complianceFlags,
      })),
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching source policies", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();
    const validated = policySchema.parse(body);

    const policy = await db.sourcePolicy.create({
      data: {
        tenantId: tenant_id,
        sourceType: validated.sourceType,
        allowedSources: validated.allowedSources,
        collectionMethod: validated.collectionMethod,
        retentionDays: validated.retentionDays,
        autoDelete: validated.autoDelete,
        complianceFlags: validated.complianceFlags,
      },
    });

    return NextResponse.json({
      policy: {
        id: policy.id,
        sourceType: policy.sourceType,
        allowedSources: policy.allowedSources,
        collectionMethod: policy.collectionMethod,
        retentionDays: policy.retentionDays,
        autoDelete: policy.autoDelete,
        complianceFlags: policy.complianceFlags,
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
    logger.error("Error creating source policy", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
