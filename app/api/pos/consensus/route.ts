/**
 * POS: Consensus Hijacking API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ConsensusHijackingService } from "@/lib/pos/consensus-hijacking";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const consensusService = new ConsensusHijackingService();

const consensusSignalSchema = z.object({
  type: z.enum([
    "THIRD_PARTY_ANALYSIS",
    "EXPERT_COMMENTARY",
    "COMPARATIVE_RESEARCH",
    "BALANCED_PERSPECTIVE",
    "INDEPENDENT_REVIEW",
  ]),
  title: z.string().min(1),
  content: z.string().min(1),
  source: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  author: z.string().optional(),
  authorCredential: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  relevanceScore: z.number().optional(),
  trustScore: z.number().optional(),
  amplification: z.number().optional(),
  evidenceRefs: z.array(z.string().min(1)).optional(),
  relatedNodeIds: z.array(z.string().min(1)).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const narrativeNodeId = searchParams.get("narrativeNodeId");

    if (action === "metrics") {
      const metrics = await consensusService.getConsensusMetrics(tenantId);
      return NextResponse.json({ metrics });
    }

    if (action === "for-narrative" && narrativeNodeId) {
      const signals = await consensusService.findConsensusForNarrative(
        tenantId,
        narrativeNodeId
      );
      return NextResponse.json({ signals });
    }

    if (action === "summary" && narrativeNodeId) {
      const summary = await consensusService.generateConsensusSummary(
        tenantId,
        narrativeNodeId
      );
      return NextResponse.json({ summary });
    }

    return NextResponse.json(
      { error: "Invalid action or missing parameters" },
      { status: 400 }
    );
  } catch (error) {
    logger.error("Consensus API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const body = await request.json();
    const validated = consensusSignalSchema.parse(body);
    const signalId = await consensusService.createConsensusSignal({
      tenantId,
      ...validated,
      publishedAt: validated.publishedAt ? new Date(validated.publishedAt) : new Date(),
    });

    return NextResponse.json({ success: true, signalId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    logger.error("Consensus API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
