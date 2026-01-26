/**
 * A2A Agent Discovery API
 */

import { NextRequest, NextResponse } from "next/server";
import { getA2AProtocol, type AgentCapability } from "@/lib/a2a/protocol";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const discoverAgentsSchema = z.object({
  requesterAgentId: z.string().min(1),
  requiredCapabilities: z.array(z.string()).optional().transform((val) => val as AgentCapability[] | undefined),
  filters: z.record(z.string(), z.unknown()).optional(),
  maxResults: z.number().int().positive().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = discoverAgentsSchema.parse(body);

    const a2aProtocol = getA2AProtocol();
    const result = await a2aProtocol.discoverAgents({
      requesterAgentId: validated.requesterAgentId,
      requiredCapabilities: validated.requiredCapabilities,
      filters: validated.filters,
      maxResults: validated.maxResults,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Agent discovery failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Discovery failed" },
      { status: 500 }
    );
  }
}
