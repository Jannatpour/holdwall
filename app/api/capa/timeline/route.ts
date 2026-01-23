/**
 * CAPA Timeline API
 * 
 * Endpoint for generating timelines for claim clusters
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { TimelineBuilder } from "@/lib/capa/timeline-builder";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const timelineBuilder = new TimelineBuilder();

const getTimelineSchema = z.object({
  cluster_id: z.string(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const { searchParams } = new URL(request.url);
    const cluster_id = searchParams.get("cluster_id");

    if (!cluster_id) {
      return NextResponse.json({ error: "cluster_id is required" }, { status: 400 });
    }

    const validated = getTimelineSchema.parse({ cluster_id });

    const timeline = await timelineBuilder.buildTimeline(validated.cluster_id, tenant_id);

    return NextResponse.json({
      timeline,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Timeline API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
