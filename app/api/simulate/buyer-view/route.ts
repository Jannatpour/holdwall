/**
 * Buyer View Simulator API
 * 
 * Returns what a buyer persona would see at each funnel stage,
 * based on explicitly tagged artifacts (policyChecks.personas + policyChecks.funnel_stages).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const searchParams = request.nextUrl.searchParams;
    const persona = searchParams.get("persona") || "buyer"; // buyer, pr, compliance, customer

    // Get published artifacts that would be visible
    const publishedArtifacts = await db.aAALArtifact.findMany({
      where: {
        tenantId: tenant_id,
        status: "PUBLISHED",
        policyChecks: ({ not: null } as any),
      },
      select: {
        id: true,
        title: true,
        policyChecks: true,
        createdAt: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: "desc" },
      take: 20,
    });

    const stages = [
      {
        name: "Awareness",
        description: "Initial discovery",
      },
      {
        name: "Research",
        description: "Active information gathering",
      },
      {
        name: "Comparison",
        description: "Evaluating options",
      },
      {
        name: "Decision",
        description: "Final purchase decision",
      },
      {
        name: "Post-purchase",
        description: "Post-purchase validation",
      },
    ];

    const stagesWithArtifacts = stages.map((stage) => {
      const artifacts = publishedArtifacts
        .filter((a) => {
          const pc = (a.policyChecks || {}) as any;
          const personas = Array.isArray(pc.personas) ? pc.personas : [];
          const funnelStages = Array.isArray(pc.funnel_stages) ? pc.funnel_stages : [];
          return personas.includes(persona) && funnelStages.includes(stage.name);
        })
        .slice(0, stage.name === "Research" ? 5 : 3);

      return { ...stage, artifacts };
    });

    const answerPreview = [
      `Persona: ${persona}`,
      "",
      ...stagesWithArtifacts.flatMap((stage) => [
        `${stage.name} — ${stage.description}`,
        ...(stage.artifacts.length
          ? stage.artifacts.map((a) => `- ${a.title}`)
          : ["- (no explicitly tagged artifacts)"]),
        "",
      ]),
    ].join("\n");

    return NextResponse.json({
      persona,
      buyer_view: {
        stages: stagesWithArtifacts,
        answer_preview: answerPreview,
        total_artifacts_visible: publishedArtifacts.length,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error simulating buyer view", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
