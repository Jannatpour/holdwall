/**
 * Narrative Orchestration API
 * 
 * Endpoint for executing autonomous narrative risk cycles
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { NarrativeOrchestrator } from "@/lib/autonomous/narrative-orchestrator";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const executeCycleSchema = z.object({
  brand_name: z.string(),
  workspace_id: z.string().optional(),
  autonomy_level: z
    .object({
      ingestion: z.boolean().default(true),
      analysis: z.boolean().default(true),
      drafting: z.boolean().default(true),
      measurement: z.boolean().default(true),
      publishing: z.boolean().default(false), // Always false for human-gated
    })
    .optional(),
  safety_checks: z
    .object({
      citation_grounded: z.boolean().default(true),
      defamation: z.boolean().default(true),
      privacy: z.boolean().default(true),
      consistency: z.boolean().default(true),
      escalation: z.boolean().default(true),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const validated = executeCycleSchema.parse(body);

    const orchestrator = new NarrativeOrchestrator({
      tenant_id,
      brand_name: validated.brand_name,
      workspace_id: validated.workspace_id,
      autonomy_level: {
        ingestion: validated.autonomy_level?.ingestion ?? true,
        analysis: validated.autonomy_level?.analysis ?? true,
        drafting: validated.autonomy_level?.drafting ?? true,
        measurement: validated.autonomy_level?.measurement ?? true,
        publishing: false, // Always human-gated
      },
      safety_checks: {
        citation_grounded: validated.safety_checks?.citation_grounded ?? true,
        defamation: validated.safety_checks?.defamation ?? true,
        privacy: validated.safety_checks?.privacy ?? true,
        consistency: validated.safety_checks?.consistency ?? true,
        escalation: validated.safety_checks?.escalation ?? true,
      },
    });

    const result = await orchestrator.executeCycle();

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

    logger.error("Narrative orchestration API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
