/**
 * A2A Agent Card API
 * Get agent card/profile information for hosting and display
 */

import { NextRequest, NextResponse } from "next/server";
import { getA2AProtocol } from "@/lib/a2a/protocol";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId } = await params;
    const a2aProtocol = getA2AProtocol();
    const agent = a2aProtocol.getAgent(agentId);

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Get connections for this agent
    const connections = a2aProtocol.getConnections(agentId);

    // Build agent card with OASF profile
    const profile = agent.metadata?.profile as any;
    const card = {
      agentId: agent.agentId,
      name: agent.name,
      version: agent.version,
      capabilities: agent.capabilities,
      endpoint: agent.endpoint,
      publicKey: agent.publicKey,
      profile: profile || null,
      connections: {
        total: connections.length,
        connected: connections.filter((c) => c.status === "connected").length,
        status: connections.map((c) => ({
          peerAgentId: c.peerAgentId,
          status: c.status,
          establishedAt: c.establishedAt,
        })),
      },
      metadata: agent.metadata,
    };

    return NextResponse.json({ card });
  } catch (error) {
    logger.error("Agent card retrieval failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Retrieval failed" },
      { status: 500 }
    );
  }
}
