/**
 * Metering & Entitlements API
 * Returns entitlements and current usage per tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const [entitlements, counters] = await Promise.all([
      db.entitlement.findMany({
        where: { tenantId: tenant_id },
        orderBy: { metric: "asc" },
      }),
      db.meteringCounter.findMany({
        where: { tenantId: tenant_id },
        orderBy: { metric: "asc" },
      }),
    ]);

    const counterByMetric = new Map<string, typeof counters[number]>();
    for (const c of counters) counterByMetric.set(c.metric, c);

    return NextResponse.json({
      entitlements: entitlements.map((e) => ({
        id: e.id,
        metric: e.metric,
        soft_limit: e.softLimit,
        hard_limit: e.hardLimit,
        enforcement: e.enforcement,
        current_usage: e.currentUsage,
        counter: counterByMetric.get(e.metric)
          ? {
              value: counterByMetric.get(e.metric)!.value,
              period: counterByMetric.get(e.metric)!.period,
              last_reset: counterByMetric.get(e.metric)!.lastReset.toISOString(),
              next_reset: counterByMetric.get(e.metric)!.nextReset.toISOString(),
            }
          : null,
      })),
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching entitlements", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

