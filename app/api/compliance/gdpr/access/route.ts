/**
 * GDPR Data Access API
 * Request access to personal data (GDPR Article 15)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { gdprCompliance } from "@/lib/compliance/gdpr";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  let userId: string | undefined;
  let tenantId: string = "";
  try {
    const user = await requireAuth();
    userId = (user as any).id;
    tenantId = (user as any).tenantId || "";

    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 400 });
    }

    const result = await gdprCompliance.requestDataAccess(userId, tenantId);

    return NextResponse.json({
      requestId: result.requestId,
      data: result.data,
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Error accessing user data for GDPR request", {
      userId,
      tenantId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
