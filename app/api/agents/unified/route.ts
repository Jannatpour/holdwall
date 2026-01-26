/**
 * Unified Agent Protocol API
 * 
 * Single endpoint for all agent protocols (MCP, ACP, A2A, ANP, AG-UI)
 */

import { NextRequest, NextResponse } from "next/server";
import { getProtocolBridge } from "@/lib/agents/protocol-bridge";
import type { ProtocolType } from "@/lib/agents/protocol-bridge";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const unifiedRequestSchema = z.object({
  protocol: z.enum(["mcp", "acp", "a2a", "anp", "ag-ui", "ap2"]),
  action: z.string().min(1),
  payload: z.unknown().optional(),
  sessionId: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = unifiedRequestSchema.parse(body);

    const protocolBridge = getProtocolBridge();
    const response = await protocolBridge.route({
      protocol: validated.protocol as ProtocolType,
      action: validated.action,
      payload: validated.payload,
      userId: (user as any).id,
      tenantId: (user as any).tenantId || "default",
      sessionId: validated.sessionId,
      agentId: validated.agentId,
    });

    const latency = Date.now() - startTime;
    metrics.observe("unified_agent_protocol_latency_ms", latency, {
      protocol: validated.protocol,
      action: validated.action,
    });

    logger.info("Unified agent protocol request processed", {
      protocol: validated.protocol,
      action: validated.action,
      userId: (user as any).id,
      success: response.success,
      latency,
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    logger.error("Unified agent protocol request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const protocolBridge = getProtocolBridge();
    const capabilities = protocolBridge.getProtocolCapabilities();

    return NextResponse.json({
      protocols: Object.keys(capabilities),
      capabilities,
    });
  } catch (error) {
    logger.error("Failed to get protocol capabilities", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 500 }
    );
  }
}
