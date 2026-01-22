/**
 * Forecast Heatmap API
 * Returns outbreak probability by surface and region
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    // Get recent forecasts grouped by surface and region
    const forecasts = await db.forecast.findMany({
      where: {
        tenantId: tenant_id,
        type: "OUTBREAK",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Build heatmap data structure
    const heatmap: Record<string, Record<string, number>> = {};

    for (const forecast of forecasts) {
      const metadata = (forecast.typeData || {}) as any;
      const surface = metadata.surface || "all";
      const region = metadata.region || "global";

      if (!heatmap[surface]) {
        heatmap[surface] = {};
      }

      // Use maximum probability for each surface/region combination
      if (!heatmap[surface][region] || forecast.value > heatmap[surface][region]) {
        heatmap[surface][region] = forecast.value;
      }
    }

    return NextResponse.json({ heatmap });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching heatmap", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
