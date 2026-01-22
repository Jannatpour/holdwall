/**
 * CRAG (Corrective RAG) API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CRAGPipeline } from "@/lib/ai/crag";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { logger } from "@/lib/logging/logger";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const { query, options } = body;

    if (!query) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    const evidenceVault = new DatabaseEvidenceVault();
    const cragPipeline = new CRAGPipeline(evidenceVault);

    const result = await cragPipeline.retrieve(query, tenant_id, options || {});

    return NextResponse.json({
      query: result.query,
      evidence: result.evidence,
      context: result.context,
      corrections: result.corrections,
      metadata: result.metadata,
    });
  } catch (error) {
    logger.error("CRAG API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
