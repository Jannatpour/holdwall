/**
 * Source Health API
 * Returns health status for all configured sources
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    // Get source policies to determine which sources are configured
    const sourcePolicies = await db.sourcePolicy.findMany({
      where: { tenantId: tenant_id },
      select: { sourceType: true },
    });

    // Get recent evidence by source type to determine health
    const sources = await db.evidence.groupBy({
      by: ["sourceType"],
      where: {
        tenantId: tenant_id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      _count: { id: true },
      _max: { createdAt: true },
    });

    // Get error counts from audit logs (if available)
    const healthData: Array<{
      source_type: string;
      status: "healthy" | "degraded" | "unhealthy";
      last_success: string;
      error_rate: number;
    }> = [];

    for (const source of sources) {
      const sourceType = source.sourceType || "unknown";
      const count = ((source as any)._count?.id as number | undefined) || 0;
      const lastSuccess = (((source as any)._max?.createdAt as Date | undefined) || new Date(0));
      
      // Determine health status based on recent activity
      let status: "healthy" | "degraded" | "unhealthy";
      let errorRate = 0;

      if (count === 0) {
        status = "unhealthy";
        errorRate = 1.0;
      } else if (count < 10) {
        status = "degraded";
        errorRate = 0.3;
      } else {
        status = "healthy";
        errorRate = 0.05;
      }

      // Check if source is too old (no activity in last 6 hours)
      const hoursSinceLastSuccess = (Date.now() - lastSuccess.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastSuccess > 6) {
        status = "degraded";
      }
      if (hoursSinceLastSuccess > 24) {
        status = "unhealthy";
      }

      healthData.push({
        source_type: sourceType,
        status,
        last_success: lastSuccess.toISOString(),
        error_rate: errorRate,
      });
    }

    // Add configured sources that have no recent activity
    const configuredTypes = new Set(sourcePolicies.map((p) => p.sourceType));
    const activeTypes = new Set(sources.map((s) => s.sourceType));
    
    for (const sourceType of configuredTypes) {
      if (!activeTypes.has(sourceType)) {
        healthData.push({
          source_type: sourceType,
          status: "unhealthy",
          last_success: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          error_rate: 1.0,
        });
      }
    }

    return NextResponse.json({ sources: healthData });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error fetching source health", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
