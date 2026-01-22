/**
 * Metrics API
 * Prometheus-compatible metrics endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { metrics } from "@/lib/observability/metrics";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    // Only authenticated users can access metrics
    await requireAuth();

    const format = request.nextUrl.searchParams.get("format") || "prometheus";

    if (format === "json") {
      const summary = metrics.getSummary();
      return NextResponse.json(summary);
    }

    // Default: Prometheus format
    const prometheus = metrics.getPrometheusFormat();
    return new NextResponse(prometheus, {
      headers: {
        "Content-Type": "text/plain; version=0.0.4",
      },
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Error fetching metrics", {
      format: request.nextUrl.searchParams.get("format"),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
