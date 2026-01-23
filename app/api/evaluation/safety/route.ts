/**
 * Safety Evaluation API
 * 
 * Endpoint for evaluating safety of claims and artifacts
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { SafetyOrchestrator } from "@/lib/evaluation/safety-orchestrator";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const safetyOrchestrator = new SafetyOrchestrator();

const evaluateSchema = z.object({
  content: z.string(),
  claim_id: z.string().optional(),
  artifact_id: z.string().optional(),
  evidence_refs: z.array(z.string()).optional(),
  previous_content: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const validated = evaluateSchema.parse(body);

    const result = await safetyOrchestrator.evaluateSafety(
      validated.content,
      tenant_id,
      {
        claim_id: validated.claim_id,
        artifact_id: validated.artifact_id,
        evidence_refs: validated.evidence_refs,
        previous_content: validated.previous_content,
      }
    );

    return NextResponse.json({
      result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Safety evaluation API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
