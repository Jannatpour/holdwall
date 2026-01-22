/**
 * A2A Agent Hiring API
 * Hire agents based on OASF profiles (capability, cost, reliability)
 */

import { NextRequest, NextResponse } from "next/server";
import { getA2AProtocol, type AgentCapability } from "@/lib/a2a/protocol";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const hireAgentSchema = z.object({
  taskType: z.string(),
  requiredCapabilities: z.array(z.string()),
  budget: z.number().positive().optional(),
  maxLatency: z.number().positive().optional(),
  requiredSkills: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = hireAgentSchema.parse(body);

    const a2aProtocol = getA2AProtocol();
    const hiredAgent = await a2aProtocol.hireAgent({
      ...validated,
      requiredCapabilities: validated.requiredCapabilities as AgentCapability[],
    });

    if (!hiredAgent) {
      return NextResponse.json(
        { error: "No suitable agent found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      agent: hiredAgent,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Agent hiring failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hiring failed" },
      { status: 500 }
    );
  }
}
