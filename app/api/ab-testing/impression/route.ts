/**
 * A/B Test Impression API
 * Record impressions for A/B test variants
 */

// Skip data collection during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { abTesting } from "@/lib/ab-testing/framework";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const impressionSchema = z.object({
  testId: z.string(),
  variantId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { testId, variantId } = impressionSchema.parse(body);

    abTesting.recordImpression(testId, variantId, (user as any).id);

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

    logger.error("A/B test impression error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
