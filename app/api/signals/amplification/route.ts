/**
 * Signal Amplification API
 * Returns amplification metrics for signals over time
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const amplificationRequestSchema = z.object({
  evidence_ids: z.array(z.string()),
});

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const validated = amplificationRequestSchema.parse(body);

    // In production, this would query actual amplification metrics
    // For now, generate sample data
    const amplification: Record<string, number[]> = {};

    for (const evidenceId of validated.evidence_ids) {
      // Generate sample amplification data (7 data points representing last 7 hours)
      const baseValue = Math.random() * 10;
      amplification[evidenceId] = Array.from({ length: 7 }, (_, i) => {
        const trend = Math.sin((i / 7) * Math.PI * 2) * 2;
        return Math.max(0, baseValue + trend + (Math.random() - 0.5) * 2);
      });
    }

    return NextResponse.json({ amplification });
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
    logger.error("Error fetching signal amplification data", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
