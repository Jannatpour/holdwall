/**
 * Evaluation API
 * AI Answer Evaluation Harness endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { AIAnswerEvaluationHarness } from "@/lib/evaluation/harness";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const harness = new AIAnswerEvaluationHarness();

const evaluateSchema = z.object({
  prompt: z.string(),
  response: z.string(),
  expected_evidence: z.array(z.string()),
  model: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const validated = evaluateSchema.parse(body);

    const result = await harness.evaluate(
      validated.prompt,
      validated.response,
      validated.expected_evidence,
      {
        model: validated.model,
      }
    );

    return NextResponse.json(result);
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
    logger.error("Error evaluating response", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
