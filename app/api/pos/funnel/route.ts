/**
 * POS: Decision Funnel Domination API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { DecisionFunnelDomination } from "@/lib/pos/decision-funnel-domination";
import { logger } from "@/lib/logging/logger";

const dfdService = new DecisionFunnelDomination();

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const stage = searchParams.get("stage");

    if (action === "metrics") {
      const metrics = await dfdService.getFunnelMetrics(tenantId);
      return NextResponse.json({ metrics });
    }

    if (action === "control-content" && stage) {
      const content = await dfdService.getControlContent(
        tenantId,
        stage as any
      );
      return NextResponse.json({ content });
    }

    return NextResponse.json(
      { error: "Invalid action or missing parameters" },
      { status: 400 }
    );
  } catch (error) {
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Funnel API error", {
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
    const { action, ...data } = body;

    if (action === "create-checkpoint") {
      const checkpointId = await dfdService.createCheckpoint({
        tenantId,
        ...data,
      });
      return NextResponse.json({ success: true, checkpointId });
    }

    if (action === "setup-complete-funnel") {
      const checkpointIds = await dfdService.setupCompleteFunnel(tenantId);
      return NextResponse.json({ success: true, checkpointIds });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Funnel API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
