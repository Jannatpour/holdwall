/**
 * Break-Glass API
 * 
 * Endpoint for break-glass emergency procedures
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { BreakGlassService } from "@/lib/engagement/break-glass";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const breakGlassService = new BreakGlassService();

const executeBreakGlassSchema = z.object({
  approval_id: z.string(),
  reason: z.string(),
  justification: z.string().optional(),
  urgency: z.enum(["HIGH", "CRITICAL"]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const actor_id = (user as any).id || "";

    const body = await request.json();
    const validated = executeBreakGlassSchema.parse(body);

    const breakGlass = await breakGlassService.executeBreakGlass({
      approval_id: validated.approval_id,
      requester_id: actor_id,
      tenant_id,
      reason: validated.reason,
      justification: validated.justification,
      urgency: validated.urgency,
    });

    return NextResponse.json({
      break_glass: breakGlass,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Break-glass API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const { searchParams } = new URL(request.url);
    const approval_id = searchParams.get("approval_id");

    const history = await breakGlassService.getBreakGlassHistory(tenant_id, {
      approval_id: approval_id || undefined,
      limit: 100,
    });

    return NextResponse.json({
      history,
      count: history.length,
    });
  } catch (error) {
    logger.error("Break-glass history API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
