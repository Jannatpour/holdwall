/**
 * A2A Agent Registration API
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
    const { agentId, name, version, capabilities, endpoint, publicKey, metadata } = body;

    if (!agentId || !name || !version || !capabilities || !endpoint) {
      return NextResponse.json(
        { error: "Missing required fields: agentId, name, version, capabilities, endpoint" },
        { status: 400 }
      );
    }

    const a2aProtocol = getA2AProtocol();
    await a2aProtocol.registerAgent({
      agentId,
      name,
      version,
      capabilities,
      endpoint,
      publicKey,
      metadata,
    });

    logger.info("Agent registered via API", {
      agentId,
      name,
      userId: (user as any).id,
    });

    return NextResponse.json({
      success: true,
      agentId,
    });
  } catch (error) {
    logger.error("Agent registration failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed" },
      { status: 500 }
    );
  }
}
