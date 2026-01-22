/**
 * Financial Services Monthly Impact Report API
 * 
 * Generates executive-ready monthly reports showing:
 * - Outbreaks prevented
 * - Time-to-resolution improvements
 * - Reduced negative AI interpretations
 * - Support cost reduction
 * - Legal exposure mitigation
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { financialServicesMode } from "@/lib/financial-services/operating-mode";
import { FinancialServicesMonthlyReporting } from "@/lib/financial-services/monthly-reporting";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const config = await financialServicesMode.getConfig(tenantId);

    if (!config.enabled) {
      return NextResponse.json(
        { error: "Financial Services mode not enabled" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    // Use the existing monthly reporting service
    const reportingService = new FinancialServicesMonthlyReporting();
    const report = await reportingService.generateReport(tenantId, start, end);

    return NextResponse.json(report);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error generating Financial Services monthly report", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
