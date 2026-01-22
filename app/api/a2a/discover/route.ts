/**
 * A2A Agent Discovery API
 */

import { NextRequest, NextResponse } from "next/server";
import { getA2AProtocol } from "@/lib/a2a/protocol";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { requesterAgentId, requiredCapabilities, filters, maxResults } = body;

    if (!requesterAgentId) {
      return NextResponse.json(
        { error: "Missing required field: requesterAgentId" },
        { status: 400 }
      );
    }

    const a2aProtocol = getA2AProtocol();
    const result = await a2aProtocol.discoverAgents({
      requesterAgentId,
      requiredCapabilities,
      filters,
      maxResults,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Agent discovery failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Discovery failed" },
      { status: 500 }
    );
  }
}
