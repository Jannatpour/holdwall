/**
 * Adversarial Detection API
 * 
 * Endpoint for detecting adversarial patterns in evidence
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { AdversarialOrchestrator } from "@/lib/adversarial/orchestrator";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const orchestrator = new AdversarialOrchestrator();

const detectSchema = z.object({
  evidence_id: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const validated = detectSchema.parse(body);

    const result = await orchestrator.detectAdversarialPatterns(
      validated.evidence_id,
      tenant_id
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

    logger.error("Adversarial detection API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
