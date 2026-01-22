/**
 * POS: Consensus Hijacking API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ConsensusHijackingService } from "@/lib/pos/consensus-hijacking";
import { logger } from "@/lib/logging/logger";

const consensusService = new ConsensusHijackingService();

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
    const signalId = await consensusService.createConsensusSignal({
      tenantId,
      ...body,
      publishedAt: body.publishedAt
        ? new Date(body.publishedAt)
        : new Date(),
    });

    return NextResponse.json({ success: true, signalId });
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
