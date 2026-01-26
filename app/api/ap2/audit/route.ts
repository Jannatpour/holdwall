/**
 * AP2 Audit Logs API
 * Retrieve audit logs for payment operations
 */

import { NextRequest, NextResponse } from "next/server";
import { getAP2Protocol } from "@/lib/payment/ap2";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const ap2AuditFiltersSchema = z.object({
  mandateId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  action: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const ap2Protocol = getAP2Protocol();

    // Parse and validate query parameters
    const rawFilters: Record<string, string | undefined> = {
      mandateId: searchParams.get("mandateId") || undefined,
      transactionId: searchParams.get("transactionId") || undefined,
      agentId: searchParams.get("agentId") || undefined,
      action: searchParams.get("action") || undefined,
      startTime: searchParams.get("startTime") || undefined,
      endTime: searchParams.get("endTime") || undefined,
    };

    // Remove undefined values
    Object.keys(rawFilters).forEach(key => {
      if (rawFilters[key] === undefined) {
        delete rawFilters[key];
      }
    });

    const validated = ap2AuditFiltersSchema.parse(rawFilters);

    const filters: {
      mandateId?: string;
      transactionId?: string;
      agentId?: string;
      action?: string;
      startTime?: Date;
      endTime?: Date;
    } = {
      ...validated,
      startTime: validated.startTime ? new Date(validated.startTime) : undefined,
      endTime: validated.endTime ? new Date(validated.endTime) : undefined,
    };

    const logs = await ap2Protocol.getAuditLogs(filters);

    return NextResponse.json({
      logs,
      count: logs.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("AP2 audit log retrieval failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Retrieval failed" },
      { status: 500 }
    );
  }
}
