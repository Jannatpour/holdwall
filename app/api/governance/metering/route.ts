/**
 * Metering & Entitlements API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const entitlementSchema = z.object({
  metric: z.string(),
  softLimit: z.number().int().min(1),
  hardLimit: z.number().int().min(1),
  enforcement: z.enum(["SOFT", "HARD", "NONE"]),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const entitlements = await db.entitlement.findMany({
      where: { tenantId: tenant_id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      entitlements: entitlements.map((e) => ({
        id: e.id,
        metric: e.metric,
        softLimit: e.softLimit,
        hardLimit: e.hardLimit,
        currentUsage: e.currentUsage,
        enforcement: e.enforcement,
      })),
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching entitlements", {
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
  let validated: any;
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();
    validated = entitlementSchema.parse(body);

    const entitlement = await db.entitlement.create({
      data: {
        tenantId: tenant_id,
        metric: validated.metric,
        softLimit: validated.softLimit,
        hardLimit: validated.hardLimit,
        enforcement: validated.enforcement,
        currentUsage: 0,
      },
    });

    return NextResponse.json({
      entitlement: {
        id: entitlement.id,
        metric: entitlement.metric,
        softLimit: entitlement.softLimit,
        hardLimit: entitlement.hardLimit,
        currentUsage: entitlement.currentUsage,
        enforcement: entitlement.enforcement,
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
    logger.error("Error creating entitlement", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      metric: validated.metric,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
