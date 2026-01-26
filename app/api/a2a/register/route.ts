/**
 * A2A Agent Registration API
 */

import { NextRequest, NextResponse } from "next/server";
import { getA2AProtocol } from "@/lib/a2a/protocol";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";
import type { AgentCapability } from "@/lib/a2a/protocol";

const agentCapabilitySchema = z.enum([
  "text_generation",
  "code_execution",
  "data_analysis",
  "web_search",
  "file_operations",
  "database_query",
  "api_integration",
  "image_processing",
  "audio_processing",
  "custom",
]);

const registerAgentSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  capabilities: z.array(agentCapabilitySchema).min(1),
  endpoint: z.string().url(),
  publicKey: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = registerAgentSchema.parse(body);

    const a2aProtocol = getA2AProtocol();
    await a2aProtocol.registerAgent({
      agentId: validated.agentId,
      name: validated.name,
      version: validated.version,
      capabilities: validated.capabilities as AgentCapability[],
      endpoint: validated.endpoint,
      publicKey: validated.publicKey,
      metadata: validated.metadata,
    });

    logger.info("Agent registered via API", {
      agentId: validated.agentId,
      name: validated.name,
      userId: (user as any).id,
    });

    return NextResponse.json({
      success: true,
      agentId: validated.agentId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    logger.error("Agent registration failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed" },
      { status: 500 }
    );
  }
}
