/**
 * Autonomous Publishing API
 * 
 * Endpoint for autonomous multi-channel publishing with automatic
 * channel selection, timing optimization, and content adaptation.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { PADLDistributor } from "@/lib/publishing/padl-distributor";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const distributor = new PADLDistributor();

const autonomousPublishSchema = z.object({
  artifactId: z.string().min(1),
  content: z.string().min(1),
  title: z.string().min(1),
  contentType: z.enum(["article", "faq", "howto", "explainer", "rebuttal", "incident-response"]).optional(),
  urgency: z.enum(["low", "medium", "high", "critical"]).optional(),
  targetAudience: z.array(z.string()).optional(),
  autoSelectChannels: z.boolean().optional(),
  autoOptimizeTiming: z.boolean().optional(),
  autoAdaptContent: z.boolean().optional(),
  policyConstraints: z.object({
    requireApproval: z.boolean().optional(),
    maxChannels: z.number().positive().optional(),
    allowedChannels: z.array(z.string()).optional(),
    minEngagementPrediction: z.number().min(0).max(1000).optional(),
  }).optional(),
});

/**
 * POST /api/publishing/autonomous
 * Autonomous publishing with automatic optimization
 */
export async function POST(request: NextRequest) {
  let validated: any;
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();
    validated = autonomousPublishSchema.parse(body);

    // Execute autonomous publishing
    const result = await distributor.publishAutonomously({
      ...validated,
      policyConstraints: {
        ...validated.policyConstraints,
        requireApproval: validated.policyConstraints?.requireApproval ?? true,
      },
    });

    return NextResponse.json({
      success: true,
      tenant_id,
      result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error in autonomous publishing", {
      artifactId: validated?.artifactId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
