/**
 * Preemptive Content Packs API
 * Generates content packs for predicted narratives
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const generatePackSchema = z.object({
  generate: z.boolean().optional(),
  narrative_id: z.string().optional(),
  target_surface: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    // Get high-probability narrative forecasts
    const highProbabilityForecasts = await db.forecast.findMany({
      where: {
        tenantId: tenant_id,
        type: "OUTBREAK",
        value: { gte: 0.5 },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { value: "desc" },
      take: 10,
    });

    // Generate content pack suggestions
    const packs = highProbabilityForecasts.map((forecast) => {
      const metadata = (forecast.typeData || {}) as any;
      return {
        id: `pack-${forecast.id}`,
        name: `Preemptive Pack: ${metadata.narrative || "Narrative Response"}`,
        description: `Content pack for predicted narrative with ${Math.round(forecast.value * 100)}% probability`,
        narrative_type: metadata.narrative_type || "general",
        target_surface: metadata.surface || "all",
        trigger_probability: forecast.value,
        artifacts_count: 3, // Would be calculated based on pack contents
        forecast_id: forecast.id,
      };
    });

    return NextResponse.json({ packs });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching content packs", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();
    const validated = generatePackSchema.parse(body);

    // Persist a pack record by creating a draft AAAL artifact that represents the pack.
    // This keeps the operation fully auditable and grounded in the existing artifact system.
    const created = await db.aAALArtifact.create({
      data: {
        tenantId: tenant_id,
        title: `Content Pack: ${validated.narrative_id || "Narrative Response"}`,
        content: [
          `# Content Pack`,
          ``,
          `Narrative: ${validated.narrative_id || "unknown"}`,
          `Target surface: ${validated.target_surface || "all"}`,
          ``,
          `## Draft responses`,
          `- Executive brief`,
          `- Customer support macro`,
          `- Public statement`,
          ``,
          `## Evidence plan`,
          `Link evidence and claims to each section before publishing.`,
        ].join("\n"),
        version: "1.0.0",
        status: "DRAFT",
        approvers: [],
        requiredApprovals: 0,
        padlPublished: false,
        padlUrl: null,
        publishedAt: null,
        policyChecks: ({
          content_pack: true,
          narrative_id: validated.narrative_id || null,
          target_surface: validated.target_surface || "all",
          generated_at: new Date().toISOString(),
        } as any),
      },
    });

    return NextResponse.json(
      {
        pack: {
          id: `pack-${created.id}`,
          artifact_id: created.id,
          name: created.title,
          description: "Draft content pack artifact created",
          target_surface: validated.target_surface || "all",
          generated_at: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
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
    logger.error("Error generating content pack", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
