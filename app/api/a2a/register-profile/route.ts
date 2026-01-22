/**
 * A2A Agent Registration with OASF Profile API
 * Register agent with full OASF (Open Agentic Schema) profile for intelligent hiring
 */

import { NextRequest, NextResponse } from "next/server";
import { getA2AProtocol, type AgentProfile } from "@/lib/a2a/protocol";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const agentProfileSchema = z.object({
  agentId: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  capabilities: z.array(z.string()),
  skills: z.array(
    z.object({
      skill: z.string(),
      proficiency: z.number().min(0).max(1),
      verified: z.boolean(),
    })
  ),
  cost: z.object({
    baseCost: z.number().nonnegative(),
    currency: z.string(),
    pricingModel: z.enum(["per_request", "per_token", "per_minute", "subscription", "free"]),
    tokenCost: z.number().nonnegative().optional(),
  }),
  reliability: z.object({
    uptime: z.number().min(0).max(1),
    successRate: z.number().min(0).max(1),
    averageLatency: z.number().nonnegative(),
    lastVerified: z.string().or(z.date()),
  }),
  availability: z.object({
    status: z.enum(["available", "busy", "offline", "maintenance"]),
    maxConcurrentTasks: z.number().positive(),
    currentLoad: z.number().nonnegative(),
  }),
  metadata: z
    .object({
      author: z.string().optional(),
      tags: z.array(z.string()).optional(),
      documentation: z.string().url().optional(),
      license: z.string().optional(),
      supportContact: z.string().optional(),
    })
    .optional(),
  endpoint: z.string().url(),
  publicKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = agentProfileSchema.parse(body);

    // Convert date string to Date if needed
    const reliability = {
      ...validated.reliability,
      lastVerified:
        typeof validated.reliability.lastVerified === "string"
          ? new Date(validated.reliability.lastVerified)
          : validated.reliability.lastVerified,
    };

    const profile: AgentProfile = {
      agentId: validated.agentId,
      name: validated.name,
      version: validated.version,
      description: validated.description,
      capabilities: validated.capabilities as any,
      skills: validated.skills,
      cost: validated.cost,
      reliability,
      availability: validated.availability,
      metadata: validated.metadata,
    };

    const a2aProtocol = getA2AProtocol();
    await a2aProtocol.registerAgentWithProfile(profile, validated.endpoint, validated.publicKey);

    logger.info("Agent registered with OASF profile via API", {
      agentId: profile.agentId,
      name: profile.name,
      userId: (user as any).id,
    });

    return NextResponse.json({
      success: true,
      agentId: profile.agentId,
      profile,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Agent registration with profile failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed" },
      { status: 500 }
    );
  }
}
