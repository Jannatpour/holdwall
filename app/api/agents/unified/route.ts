/**
 * Unified Agent Protocol API
 * 
 * Single endpoint for all agent protocols (MCP, ACP, A2A, ANP, AG-UI)
 */

import { NextRequest, NextResponse } from "next/server";
import { getProtocolBridge } from "@/lib/agents/protocol-bridge";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { protocol, action, payload, sessionId, agentId } = body;

    if (!protocol || !action) {
      return NextResponse.json(
        { error: "Missing required fields: protocol, action" },
        { status: 400 }
      );
    }

    const protocolBridge = getProtocolBridge();
    const response = await protocolBridge.route({
      protocol,
      action,
      payload,
      userId: (user as any).id,
      tenantId: (user as any).tenantId || "default",
      sessionId,
      agentId,
    });

    const latency = Date.now() - startTime;
    metrics.observe("unified_agent_protocol_latency_ms", latency, {
      protocol,
      action,
    });

    logger.info("Unified agent protocol request processed", {
      protocol,
      action,
      userId: (user as any).id,
      success: response.success,
      latency,
    });

    return NextResponse.json(response);
  } catch (error) {
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
