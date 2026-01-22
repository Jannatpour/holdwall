/**
 * POS: AI Answer Authority Layer API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { AIAnswerAuthorityLayer } from "@/lib/pos/ai-answer-authority";
import { logger } from "@/lib/logging/logger";

const aaalService = new AIAnswerAuthorityLayer();

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
    const { type, ...data } = body;

    if (type === "rebuttal") {
      const documentId = await aaalService.createRebuttalDocument({
        tenantId,
        ...data,
      });
      return NextResponse.json({ success: true, documentId });
    }

    if (type === "incident") {
      const explanationId = await aaalService.createIncidentExplanation({
        tenantId,
        ...data,
      });
      return NextResponse.json({ success: true, explanationId });
    }

    if (type === "dashboard") {
      const dashboardId = await aaalService.createMetricsDashboard({
        tenantId,
        ...data,
      });
      return NextResponse.json({ success: true, dashboardId });
    }

    if (type === "publish-rebuttal") {
      const { documentId, publicUrl } = data;
      const url = await aaalService.publishRebuttal(documentId, publicUrl);
      return NextResponse.json({ success: true, publicUrl: url });
    }

    if (type === "publish-incident") {
      const { explanationId, publicUrl } = data;
      const url = await aaalService.publishIncidentExplanation(
        explanationId,
        publicUrl
      );
      return NextResponse.json({ success: true, publicUrl: url });
    }

    if (type === "publish-dashboard") {
      const { dashboardId, publicUrl } = data;
      const url = await aaalService.publishMetricsDashboard(
        dashboardId,
        publicUrl
      );
      return NextResponse.json({ success: true, publicUrl: url });
    }

    return NextResponse.json(
      { error: "Invalid type" },
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
