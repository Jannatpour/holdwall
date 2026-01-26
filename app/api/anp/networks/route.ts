/**
 * ANP Network Management API
 */

import { NextRequest, NextResponse } from "next/server";
import { getANPProtocol } from "@/lib/anp/protocol";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const createNetworkSchema = z.object({
  networkId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  agents: z.array(z.string().min(1)).optional(),
  topology: z.enum(["mesh", "star", "hierarchical", "ring"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
  creatorAgentId: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createNetworkSchema.parse(body);

    const anpProtocol = getANPProtocol();
    const creatorAgentId = validated.creatorAgentId || (user as any).id;
    
    await anpProtocol.createNetwork({
      networkId: validated.networkId,
      name: validated.name,
      description: validated.description,
      agents: validated.agents || [],
      topology: validated.topology,
      metadata: validated.metadata,
    }, creatorAgentId);

    logger.info("Network created via API", {
      networkId: validated.networkId,
      name: validated.name,
      userId: (user as any).id,
    });

    return NextResponse.json({
      success: true,
      networkId: validated.networkId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    logger.error("Network creation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Network creation failed" },
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

    const { searchParams } = new URL(request.url);
    const networkId = searchParams.get("networkId");
    const topology = searchParams.get("topology");
    const tags = searchParams.get("tags")?.split(",");
    const action = searchParams.get("action");

    const anpProtocol = getANPProtocol();

    // Handle health check actions
    if (action === "health" && networkId) {
      const healthReport = await anpProtocol.getNetworkHealthReport(networkId);
      return NextResponse.json(healthReport);
    }

    if (action === "agent_health") {
      const agentId = searchParams.get("agentId");
      if (!agentId) {
        return NextResponse.json({ error: "Missing agentId parameter" }, { status: 400 });
      }
      const healthStatus = await anpProtocol.checkAgentHealth(agentId);
      return NextResponse.json(healthStatus);
    }

    // Handle routing action
    if (action === "route") {
      const fromAgentId = searchParams.get("fromAgentId");
      const toAgentId = searchParams.get("toAgentId");
      if (!networkId || !fromAgentId || !toAgentId) {
        return NextResponse.json(
          { error: "Missing required parameters: networkId, fromAgentId, toAgentId" },
          { status: 400 }
        );
      }
      const preferLowLatency = searchParams.get("preferLowLatency") === "true";
      const preferHighReliability = searchParams.get("preferHighReliability") === "true";
      const maxHops = searchParams.get("maxHops") ? parseInt(searchParams.get("maxHops")!, 10) : undefined;

      const routingResult = await anpProtocol.routeMessage(networkId, fromAgentId, toAgentId, {
        preferLowLatency,
        preferHighReliability,
        maxHops,
      });
      return NextResponse.json(routingResult);
    }

    // Handle agent selection
    if (action === "select_agent" && networkId) {
      const requiredCapabilities = searchParams.get("requiredCapabilities")?.split(",");
      const preferLowLatency = searchParams.get("preferLowLatency") === "true";
      const preferHighReliability = searchParams.get("preferHighReliability") === "true";
      const excludeAgentIds = searchParams.get("excludeAgentIds")?.split(",");

      const selectedAgent = await anpProtocol.selectAgent(networkId, {
        requiredCapabilities,
        preferLowLatency,
        preferHighReliability,
        excludeAgentIds,
      });
      return NextResponse.json({ agentId: selectedAgent });
    }

    // Default: network discovery
    if (networkId) {
      const network = anpProtocol.getNetwork(networkId);
      return NextResponse.json({ network });
    }

    const result = await anpProtocol.discoverNetworks({
      topology: topology as any,
      tags,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Network operation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Network operation failed" },
      { status: 500 }
    );
  }
}
