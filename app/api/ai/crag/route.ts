/**
 * CRAG (Corrective RAG) API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CRAGPipeline } from "@/lib/ai/crag";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const cragQuerySchema = z.object({
  query: z.string().min(1),
  options: z.object({
    max_passes: z.number().int().positive().max(10).optional(),
    min_relevance: z.number().min(0).max(1).optional(),
    use_query_rewrite: z.boolean().optional(),
    initial_limit: z.number().int().positive().max(100).optional(),
    final_limit: z.number().int().positive().max(50).optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const validated = cragQuerySchema.parse(body);

    const evidenceVault = new DatabaseEvidenceVault();
    const cragPipeline = new CRAGPipeline(evidenceVault);

    const result = await cragPipeline.retrieve(
      validated.query, 
      tenant_id, 
      validated.options || {}
    );

    return NextResponse.json({
      query: result.query,
      evidence: result.evidence,
      context: result.context,
      corrections: result.corrections,
      metadata: result.metadata,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("CRAG API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
