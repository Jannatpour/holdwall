/**
 * RAGAS Evaluation API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { RAGASEvaluator } from "@/lib/evaluation/ragas";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const ragasInputSchema = z.object({
  query: z.string(),
  contexts: z.array(z.string()),
  answer: z.string(),
  ground_truth: z.string().optional(),
  context_ids: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const validated = ragasInputSchema.parse(body);

    const evaluator = new RAGASEvaluator();
    const result = await evaluator.evaluate({
      query: validated.query,
      contexts: validated.contexts,
      answer: validated.answer,
      ground_truth: validated.ground_truth,
      context_ids: validated.context_ids,
    });

    return NextResponse.json({
      metrics: result.metrics,
      context_scores: result.context_scores,
      metadata: result.metadata,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("RAGAS evaluation error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
