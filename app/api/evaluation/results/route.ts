/**
 * Evaluation Results API
 * Store and retrieve evaluation results for continuous evaluation tracking
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

const createEvaluationResultSchema = z.object({
  promptId: z.string().optional(),
  model: z.string(),
  domain: z.enum(["claims", "evidence_linking", "graph_updates", "aaal_outputs"]),
  goldenSetId: z.string().optional(),
  scores: z.object({
    citation_capture: z.number().optional(),
    narrative_drift: z.number().optional(),
    harmful_resurfacing: z.number().optional(),
    overall: z.number(),
    citation_faithfulness: z.number().optional(),
  }),
  details: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /api/evaluation/results
 * Get evaluation results with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";
    const searchParams = request.nextUrl.searchParams;

    const domain = searchParams.get("domain");
    const model = searchParams.get("model");
    const promptId = searchParams.get("promptId");
    const limitParam = searchParams.get("limit") || "100";
    const limit = Math.min(Math.max(parseInt(limitParam, 10), 1), 1000); // Clamp between 1 and 1000

    // Get evaluation results from PromptEvaluation table
    const where: any = {
      prompt: {
        tenantId,
      },
    };

    if (promptId) {
      where.promptId = promptId;
    }

    const evaluations = await db.promptEvaluation.findMany({
      where,
      include: {
        prompt: {
          select: {
            id: true,
            name: true,
            version: true,
            model: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Filter by domain/model if provided (from metadata)
    let filtered = evaluations;
    if (domain || model) {
      filtered = evaluations.filter((evaluation) => {
        const metrics = evaluation.metrics as any;
        if (domain && metrics?.domain !== domain) return false;
        if (model && evaluation.prompt.model !== model) return false;
        return true;
      });
    }

    return NextResponse.json({
      results: filtered.map((evaluation) => ({
        id: evaluation.id,
        promptId: evaluation.promptId,
        prompt: evaluation.prompt,
        score: evaluation.score,
        metrics: evaluation.metrics,
        evaluator: evaluation.evaluator,
        createdAt: evaluation.createdAt.toISOString(),
      })),
      total: filtered.length,
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Error fetching evaluation results", { error: (error as Error).message });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/evaluation/results
 * Store evaluation result
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const body = await request.json();
    const validated = createEvaluationResultSchema.parse(body);

    // Find or create prompt for this evaluation
    let promptId = validated.promptId;
    if (!promptId && validated.model) {
      // Find default prompt for this model/domain
      const prompt = await db.prompt.findFirst({
        where: {
          tenantId,
          model: validated.model,
          category: validated.domain === "claims" ? "extraction" : "evaluation",
          approved: true,
        },
        orderBy: { updatedAt: "desc" },
      });

      if (prompt) {
        promptId = prompt.id;
      }
    }

    if (!promptId) {
      return NextResponse.json(
        { error: "Prompt ID required or model must have associated prompt" },
        { status: 400 }
      );
    }

    // Store evaluation result
    const evaluation = await db.promptEvaluation.create({
      data: {
        promptId,
        score: validated.scores.overall,
        metrics: {
          domain: validated.domain,
          goldenSetId: validated.goldenSetId,
          scores: validated.scores,
          details: validated.details,
          ...validated.metadata,
        } as any,
        evaluator: validated.model,
        notes: validated.metadata?.notes as string | undefined,
      },
    });

    logger.info("Evaluation result stored", {
      evaluationId: evaluation.id,
      promptId,
      score: validated.scores.overall,
      domain: validated.domain,
    });

    return NextResponse.json(
      {
        id: evaluation.id,
        promptId: evaluation.promptId,
        score: evaluation.score,
        createdAt: evaluation.createdAt.toISOString(),
      },
      { status: 201 }
    );
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

    logger.error("Error storing evaluation result", { error: (error as Error).message });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
