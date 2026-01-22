/**
 * SynthID Watermark Detection API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { SynthIDDetector } from "@/lib/provenance/synthid";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const detectSchema = z.object({
  content: z.string(),
  content_type: z.enum(["text", "image", "audio"]).optional(),
  use_llm_analysis: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const validated = detectSchema.parse(body);

    const detector = new SynthIDDetector();
    const detection = await detector.detectWatermark(validated.content, {
      content_type: validated.content_type,
      use_llm_analysis: validated.use_llm_analysis,
    });

    const riskScore = detector.scoreSyntheticRisk(detection);

    return NextResponse.json({
      detection,
      risk_score: riskScore,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("SynthID API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
