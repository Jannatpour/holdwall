/**
 * Financial Services Configuration API
 * Manage Financial Services operating mode settings
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { financialServicesMode } from "@/lib/financial-services/operating-mode";
import { z } from "zod";

const updateConfigSchema = z.object({
  governanceLevel: z.enum(["standard", "financial", "regulated"]).optional(),
  legalApprovalRequired: z.boolean().optional(),
  evidenceThreshold: z.number().min(0).max(1).optional(),
  conservativePublishing: z.boolean().optional(),
  regulatoryTracking: z.boolean().optional(),
  escalationRules: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        condition: z.string(),
        severity: z.enum(["high", "medium", "low"]),
        routeTo: z.array(z.string()),
        enabled: z.boolean(),
      })
    )
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const config = await financialServicesMode.getConfig(tenantId);

    return NextResponse.json(config);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error fetching Financial Services config", {
      error: error instanceof Error ? error.message : String(error),
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
    const tenantId = (user as any).tenantId || "";

    const body = await request.json();
    const validated = updateConfigSchema.parse(body);

    const config = await financialServicesMode.updateConfig(tenantId, validated);

    return NextResponse.json(config);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error updating Financial Services config", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const body = await request.json();
    const config = body.config || {};

    await financialServicesMode.enable(tenantId, config);

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error enabling Financial Services mode", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
