/**
 * Traces API
 * Get distributed tracing information
 */

import { NextRequest, NextResponse } from "next/server";
import { tracer } from "@/lib/observability/tracing";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const traceId = request.nextUrl.searchParams.get("traceId");

    if (traceId) {
      const spans = tracer.getTrace(traceId);
      return NextResponse.json({ traceId, spans });
    }

    // Return all recent spans
    const allSpans = tracer.getAllSpans();
    return NextResponse.json({ spans: allSpans.slice(-100) }); // Last 100 spans
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Traces error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
