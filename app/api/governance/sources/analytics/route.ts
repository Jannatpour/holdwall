/**
 * Source Analytics API
 * Provides statistics and analytics for source policies
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    // Get all policies
    const policies = await db.sourcePolicy.findMany({
      where: { tenantId: tenant_id },
    });

    // Get source health data
    const healthResponse = await fetch(`${request.nextUrl.origin}/api/sources/health`, {
      headers: {
        Cookie: request.headers.get("cookie") || "",
      },
    });
    const healthData = healthResponse.ok ? await healthResponse.json() : { sources: [] };

    // Calculate statistics
    const totalPolicies = policies.length;
    
    // Count by collection method
    const byMethod: Record<string, number> = {};
    policies.forEach((policy) => {
      const method = policy.collectionMethod;
      byMethod[method] = (byMethod[method] || 0) + 1;
    });

    // Count by compliance flags
    const byCompliance: Record<string, number> = {};
    policies.forEach((policy) => {
      policy.complianceFlags.forEach((flag) => {
        byCompliance[flag] = (byCompliance[flag] || 0) + 1;
      });
    });

    // Health statistics
    const healthStats = {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
    };
    healthData.sources?.forEach((source: any) => {
      if (source.status === "healthy") healthStats.healthy++;
      else if (source.status === "degraded") healthStats.degraded++;
      else if (source.status === "unhealthy") healthStats.unhealthy++;
    });

    // Average retention days
    const avgRetention = policies.length > 0
      ? policies.reduce((sum, p) => sum + p.retentionDays, 0) / policies.length
      : 0;

    // Auto-delete enabled count
    const autoDeleteCount = policies.filter((p) => p.autoDelete).length;

    // Total allowed sources
    const totalAllowedSources = policies.reduce(
      (sum, p) => sum + p.allowedSources.length,
      0
    );

    // Time series data (last 30 days, daily buckets)
    const dailyBuckets: Record<string, number> = {};
    const daysInMonth = 30;
    const now = new Date();
    for (let i = 0; i < daysInMonth; i++) {
      const dayStart = new Date(now.getTime() - (daysInMonth - i) * 24 * 60 * 60 * 1000);
      const dayKey = dayStart.toISOString().split("T")[0];
      dailyBuckets[dayKey] = 0;
    }

    // Get evidence counts by day
    const evidenceCounts = await db.evidence.groupBy({
      by: ["sourceType"],
      where: {
        tenantId: tenant_id,
        createdAt: {
          gte: new Date(now.getTime() - daysInMonth * 24 * 60 * 60 * 1000),
        },
      },
      _count: { id: true },
    });

    // Aggregate evidence by day for time series
    const evidenceByDay: Record<string, number> = {};
    const allEvidence = await db.evidence.findMany({
      where: {
        tenantId: tenant_id,
        createdAt: {
          gte: new Date(now.getTime() - daysInMonth * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        createdAt: true,
      },
    });

    allEvidence.forEach((evidence) => {
      const dayKey = new Date(evidence.createdAt).toISOString().split("T")[0];
      if (dailyBuckets[dayKey] !== undefined) {
        evidenceByDay[dayKey] = (evidenceByDay[dayKey] || 0) + 1;
      }
    });

    const timeSeries = Object.entries(dailyBuckets).map(([date, _]) => ({
      date,
      count: evidenceByDay[date] || 0,
    }));

    return NextResponse.json({
      total: totalPolicies,
      byMethod,
      byCompliance,
      health: healthStats,
      averageRetention: Math.round(avgRetention),
      autoDeleteEnabled: autoDeleteCount,
      totalAllowedSources,
      timeSeries,
      sources: healthData.sources || [],
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching source analytics", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
