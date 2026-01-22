/**
 * Forecast Accuracy API
 * Returns accuracy metrics for forecast predictions
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    // Use stored evalScore as the canonical validation signal when available.
    const validatedForecasts = await db.forecast.findMany({
      where: {
        tenantId: tenant_id,
        evalScore: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    if (validatedForecasts.length === 0) {
      return NextResponse.json({
        overall_accuracy: 0,
        outbreak_accuracy: 0,
        drift_accuracy: 0,
        recent_forecasts: [],
        total_validated: 0,
        message: "No validated forecasts yet (evalScore is null).",
      });
    }

    // Calculate accuracy metrics
    let totalScore = 0;
    let outbreakScore = 0;
    let driftScore = 0;
    let outbreakCount = 0;
    let driftCount = 0;
    const recentForecasts: any[] = [];

    for (const forecast of validatedForecasts) {
      const score = typeof forecast.evalScore === "number" ? forecast.evalScore : 0;
      totalScore += score;

      if (forecast.type === "OUTBREAK") {
        outbreakScore += score;
        outbreakCount++;
      } else if (forecast.type === "DRIFT") {
        driftScore += score;
        driftCount++;
      }

      recentForecasts.push({
        id: forecast.id,
        type: forecast.type,
        value: forecast.value,
        eval_score: score,
      });
    }

    const overallAccuracy = totalScore / validatedForecasts.length;
    const outbreakAccuracy = outbreakCount > 0 ? outbreakScore / outbreakCount : 0;
    const driftAccuracy = driftCount > 0 ? driftScore / driftCount : 0;

    return NextResponse.json({
      overall_accuracy: Math.max(0, Math.min(1, overallAccuracy)),
      outbreak_accuracy: Math.max(0, Math.min(1, outbreakAccuracy)),
      drift_accuracy: Math.max(0, Math.min(1, driftAccuracy)),
      recent_forecasts: recentForecasts.slice(0, 10),
      total_validated: validatedForecasts.length,
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching accuracy metrics", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
