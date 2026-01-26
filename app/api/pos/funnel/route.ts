/**
 * POS: Decision Funnel Domination API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { DecisionFunnelDomination } from "@/lib/pos/decision-funnel-domination";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const dfdService = new DecisionFunnelDomination();

const funnelPostSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create-checkpoint"),
    stage: z.enum(["AWARENESS", "RESEARCH", "COMPARISON", "DECISION", "POST_PURCHASE"]),
    checkpointId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    controlType: z.enum([
      "NARRATIVE_FRAMING",
      "AI_SUMMARY",
      "THIRD_PARTY_VALIDATOR",
      "PROOF_DASHBOARD",
      "REINFORCEMENT_LOOP",
    ]),
    content: z.record(z.string(), z.unknown()),
    metrics: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    action: z.literal("setup-complete-funnel"),
  }),
]);

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
    const validated = funnelPostSchema.parse(body);

    if (validated.action === "create-checkpoint") {
      const checkpointId = await dfdService.createCheckpoint({
        tenantId,
        stage: validated.stage,
        checkpointId: validated.checkpointId,
        name: validated.name,
        description: validated.description,
        controlType: validated.controlType,
        content: validated.content,
        metrics: validated.metrics,
      });
      return NextResponse.json({ success: true, checkpointId });
    }

    if (validated.action === "setup-complete-funnel") {
      const checkpointIds = await dfdService.setupCompleteFunnel(tenantId);
      return NextResponse.json({ success: true, checkpointIds });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
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
