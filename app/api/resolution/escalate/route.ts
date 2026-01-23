/**
 * Resolution Escalation API
 * 
 * Endpoint for escalating customer resolutions
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CustomerResolutionService } from "@/lib/resolution/service";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const resolutionService = new CustomerResolutionService();

const escalateSchema = z.object({
  resolution_id: z.string(),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const actor_id = (user as any).id || "";

    const body = await request.json();
    const validated = escalateSchema.parse(body);

    // Route resolution (escalation routes to management/escalation team)
    const routing = await resolutionService.routeResolution(
      validated.resolution_id,
      tenant_id
    );

    // Update status to ESCALATED
    const { db } = await import("@/lib/db/client");
    await db.customerResolution.update({
      where: { id: validated.resolution_id },
      data: {
        status: "ESCALATED",
        metadata: {
          escalated_by: actor_id,
          escalated_at: new Date().toISOString(),
          reason: validated.reason,
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      routing,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Escalation API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
