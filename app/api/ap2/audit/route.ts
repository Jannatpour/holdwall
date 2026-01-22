/**
 * AP2 Audit Logs API
 * Retrieve audit logs for payment operations
 */

import { NextRequest, NextResponse } from "next/server";
import { getAP2Protocol } from "@/lib/payment/ap2";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const ap2Protocol = getAP2Protocol();

    const filters: {
      mandateId?: string;
      transactionId?: string;
      agentId?: string;
      action?: string;
      startTime?: Date;
      endTime?: Date;
    } = {};

    if (searchParams.get("mandateId")) {
      filters.mandateId = searchParams.get("mandateId")!;
    }
    if (searchParams.get("transactionId")) {
      filters.transactionId = searchParams.get("transactionId")!;
    }
    if (searchParams.get("agentId")) {
      filters.agentId = searchParams.get("agentId")!;
    }
    if (searchParams.get("action")) {
      filters.action = searchParams.get("action")!;
    }
    if (searchParams.get("startTime")) {
      filters.startTime = new Date(searchParams.get("startTime")!);
    }
    if (searchParams.get("endTime")) {
      filters.endTime = new Date(searchParams.get("endTime")!);
    }

    const logs = await ap2Protocol.getAuditLogs(filters);

    return NextResponse.json({
      logs,
      count: logs.length,
    });
  } catch (error) {
    logger.error("AP2 audit log retrieval failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Retrieval failed" },
      { status: 500 }
    );
  }
}
