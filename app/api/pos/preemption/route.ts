/**
 * POS: Narrative Preemption Engine API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { NarrativePreemptionEngine } from "@/lib/pos/narrative-preemption";
import { logger } from "@/lib/logging/logger";

const npeService = new NarrativePreemptionEngine();

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const horizonDays = searchParams.get("horizonDays")
      ? parseInt(searchParams.get("horizonDays")!)
      : 7;

    if (action === "predict") {
      const predictionIds = await npeService.predictComplaints(
        tenantId,
        horizonDays
      );
      return NextResponse.json({ predictionIds });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    logger.error("Preemption API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
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
    const { action, predictionId } = body;

    if (action === "generate-action" && predictionId) {
      const preemptiveAction = await npeService.generatePreemptiveAction(
        predictionId
      );
      return NextResponse.json({ success: true, action: preemptiveAction });
    }

    return NextResponse.json(
      { error: "Invalid action or missing parameters" },
      { status: 400 }
    );
  } catch (error) {
    logger.error("Preemption API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
