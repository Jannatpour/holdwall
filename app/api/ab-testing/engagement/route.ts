/**
 * A/B Test Engagement API
 * Record engagements for A/B test variants
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { abTesting } from "@/lib/publishing/ab-testing";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const engagementSchema = z.object({
  testId: z.string(),
  variantId: z.string(),
  engagement: z.number().optional().default(1),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { testId, variantId, engagement } = engagementSchema.parse(body);

    abTesting.recordEngagement(testId, variantId, engagement);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }

    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("A/B test engagement error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
