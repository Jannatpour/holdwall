/**
 * Temporal Timeline API
 * 
 * Endpoint for extracting timelines from evidence
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { TimelineExtractor } from "@/lib/temporal/timeline-extractor";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const timelineExtractor = new TimelineExtractor();

const extractTimelineSchema = z.object({
  evidence_ids: z.array(z.string()),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const validated = extractTimelineSchema.parse(body);

    const timeline = await timelineExtractor.extractTimeline(
      validated.evidence_ids,
      tenant_id
    );

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

    logger.error("Timeline extraction API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
