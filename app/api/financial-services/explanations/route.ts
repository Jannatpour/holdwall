/**
 * Financial Services Evidence-Backed Explanations API
 * Generate public explanations, internal briefs, and support playbooks
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { evidenceExplanations } from "@/lib/financial-services/evidence-explanations";
import { z } from "zod";

const generateExplanationSchema = z.object({
  clusterId: z.string(),
  createArtifact: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const body = await request.json();
    const validated = generateExplanationSchema.parse(body);

    const explanation = await evidenceExplanations.generateExplanation(
      tenantId,
      validated.clusterId
    );

    let artifactId: string | undefined;

    if (validated.createArtifact) {
      artifactId = await evidenceExplanations.createAAALArtifact(
        tenantId,
        explanation
      );
    }

    return NextResponse.json({
      explanation,
      artifactId,
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error generating Financial Services explanation", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
