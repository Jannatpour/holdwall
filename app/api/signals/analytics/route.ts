/**
 * Signals Analytics API
 * Provides statistics and analytics for signals
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { logger } from "@/lib/logging/logger";

const evidenceVault = new DatabaseEvidenceVault();

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const searchParams = request.nextUrl.searchParams;
    const timeframe = searchParams.get("timeframe") || "24h";

    // Calculate time window
    const now = new Date();
    let timeWindow: Date;
    switch (timeframe) {
      case "1h":
        timeWindow = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case "24h":
        timeWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        timeWindow = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        timeWindow = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get all signals in timeframe
    const allSignals = await evidenceVault.query({
      tenant_id,
      type: "signal",
    });

    const signalsInTimeframe = allSignals.filter((signal: any) => {
      const signalDate = new Date(signal.created_at || signal.collected_at || 0);
      return signalDate >= timeWindow;
    });

    // Calculate statistics
    const totalSignals = signalsInTimeframe.length;
    
    // Count by source
    const bySource: Record<string, number> = {};
    signalsInTimeframe.forEach((signal: any) => {
      const sourceType = signal.source?.type || signal.sourceType || "unknown";
      bySource[sourceType] = (bySource[sourceType] || 0) + 1;
    });

    // Count by severity
    const bySeverity: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    signalsInTimeframe.forEach((signal: any) => {
      const severity = signal.metadata?.severity || signal.severity || "low";
      if (bySeverity[severity]) {
        bySeverity[severity]++;
      }
    });

    // Count high-risk signals
    const highRiskCount = signalsInTimeframe.filter(
      (s: any) => (s.metadata as any)?.high_risk
    ).length;

    // Count unclustered signals
    const unclusteredCount = signalsInTimeframe.filter((s: any) => {
      const metadata = s.metadata as any;
      return !metadata?.cluster_id && !metadata?.suggested_cluster_id;
    }).length;

    // Calculate average amplification
    let totalAmplification = 0;
    let amplificationCount = 0;
    signalsInTimeframe.forEach((signal: any) => {
      const amp = (signal.metadata as any)?.amplification_score;
      if (typeof amp === "number") {
        totalAmplification += amp;
        amplificationCount++;
      }
    });
    const avgAmplification = amplificationCount > 0 
      ? totalAmplification / amplificationCount 
      : 0;

    // Time series data (last 24 hours, hourly buckets)
    const hourlyBuckets: Record<string, number> = {};
    const hoursInDay = 24;
    for (let i = 0; i < hoursInDay; i++) {
      const hourStart = new Date(now.getTime() - (hoursInDay - i) * 60 * 60 * 1000);
      const hourKey = hourStart.toISOString().slice(0, 13) + ":00:00Z";
      hourlyBuckets[hourKey] = 0;
    }

    signalsInTimeframe.forEach((signal: any) => {
      const signalDate = new Date(signal.created_at || signal.collected_at || 0);
      const hourKey = signalDate.toISOString().slice(0, 13) + ":00:00Z";
      if (hourlyBuckets[hourKey] !== undefined) {
        hourlyBuckets[hourKey]++;
      }
    });

    const timeSeries = Object.entries(hourlyBuckets).map(([timestamp, count]) => ({
      timestamp,
      count,
    }));

    // Trend calculation
    const recentCount = timeSeries.slice(-6).reduce((sum, item) => sum + item.count, 0);
    const previousCount = timeSeries.slice(-12, -6).reduce((sum, item) => sum + item.count, 0);
    const trend = previousCount > 0 
      ? ((recentCount - previousCount) / previousCount) * 100 
      : 0;

    return NextResponse.json({
      total: totalSignals,
      bySource,
      bySeverity,
      highRisk: highRiskCount,
      unclustered: unclusteredCount,
      averageAmplification: avgAmplification,
      timeSeries,
      trend: {
        value: trend,
        direction: trend > 0 ? "increasing" : trend < 0 ? "decreasing" : "stable",
      },
      timeframe,
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching signal analytics", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
