/**
 * POS: AI Answer Authority Layer API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { AIAnswerAuthorityLayer } from "@/lib/pos/ai-answer-authority";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const aaalService = new AIAnswerAuthorityLayer();

const aaalRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("rebuttal"),
    title: z.string().min(1),
    content: z.string().min(1),
    targetClaimId: z.string().min(1).optional(),
    targetNodeId: z.string().min(1).optional(),
    evidenceRefs: z.array(z.string().min(1)).optional(),
    structuredData: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("incident"),
    incidentId: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    explanation: z.string().min(1),
    rootCause: z.string().optional(),
    resolution: z.string().optional(),
    prevention: z.string().optional(),
    evidenceRefs: z.array(z.string().min(1)).optional(),
  }),
  z.object({
    type: z.literal("dashboard"),
    name: z.string().min(1),
    description: z.string().optional(),
    metrics: z.array(z.object({
      name: z.string().min(1),
      value: z.number(),
      unit: z.string().min(1),
      target: z.number().optional(),
      trend: z.enum(["up", "down", "stable"]).optional(),
    })).min(1),
    refreshInterval: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("publish-rebuttal"),
    documentId: z.string().min(1),
    publicUrl: z.string().url().optional(),
  }),
  z.object({
    type: z.literal("publish-incident"),
    explanationId: z.string().min(1),
    publicUrl: z.string().url().optional(),
  }),
  z.object({
    type: z.literal("publish-dashboard"),
    dashboardId: z.string().min(1),
    publicUrl: z.string().url().optional(),
  }),
]);

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "citation-score") {
      const score = await aaalService.getAICitationScore(tenantId);
      return NextResponse.json({ score });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    logger.error("AAAL API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const body = await request.json();
    const validated = aaalRequestSchema.parse(body);

    if (validated.type === "rebuttal") {
      const documentId = await aaalService.createRebuttalDocument({
        tenantId,
        title: validated.title,
        content: validated.content,
        targetClaimId: validated.targetClaimId,
        targetNodeId: validated.targetNodeId,
        evidenceRefs: validated.evidenceRefs,
        structuredData: validated.structuredData as any,
      });
      return NextResponse.json({ success: true, documentId });
    }

    if (validated.type === "incident") {
      const explanationId = await aaalService.createIncidentExplanation({
        tenantId,
        incidentId: validated.incidentId,
        title: validated.title,
        summary: validated.summary,
        explanation: validated.explanation,
        rootCause: validated.rootCause,
        resolution: validated.resolution,
        prevention: validated.prevention,
        evidenceRefs: validated.evidenceRefs,
      });
      return NextResponse.json({ success: true, explanationId });
    }

    if (validated.type === "dashboard") {
      const dashboardId = await aaalService.createMetricsDashboard({
        tenantId,
        name: validated.name,
        description: validated.description,
        metrics: validated.metrics,
        refreshInterval: validated.refreshInterval,
      });
      return NextResponse.json({ success: true, dashboardId });
    }

    if (validated.type === "publish-rebuttal") {
      const url = await aaalService.publishRebuttal(validated.documentId, validated.publicUrl);
      return NextResponse.json({ success: true, publicUrl: url });
    }

    if (validated.type === "publish-incident") {
      const url = await aaalService.publishIncidentExplanation(
        validated.explanationId,
        validated.publicUrl
      );
      return NextResponse.json({ success: true, publicUrl: url });
    }

    if (validated.type === "publish-dashboard") {
      const url = await aaalService.publishMetricsDashboard(
        validated.dashboardId,
        validated.publicUrl
      );
      return NextResponse.json({ success: true, publicUrl: url });
    }

    return NextResponse.json(
      { error: "Invalid type" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    logger.error("AAAL API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
