/**
 * Analytics Tracking API
 * Server-side analytics event tracking
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { analytics } from "@/lib/analytics/tracking";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const eventSchema = z.object({
  name: z.string(),
  properties: z.record(z.string(), z.unknown()).optional(),
  userId: z.string().optional(),
  tenantId: z.string().optional(),
  timestamp: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const event = eventSchema.parse(body);

    // Add user context
    const enrichedEvent = {
      ...event,
      userId: event.userId || (user as any).id,
      tenantId: event.tenantId || (user as any).tenantId,
    };

    await analytics.track(enrichedEvent);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid event data", issues: error.issues },
        { status: 400 }
      );
    }

    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Analytics tracking error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
