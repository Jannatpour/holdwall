/**
 * GDPR Data Deletion API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { gdprCompliance } from "@/lib/compliance/gdpr";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const deleteSchema = z.object({
  anonymize: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  let userId: string | undefined;
  let tenantId: string = "";
  let anonymize: boolean = true;
  try {
    const user = await requireAuth();
    userId = (user as any).id;
    tenantId = (user as any).tenantId || "";
    const body = await request.json();
    ({ anonymize } = deleteSchema.parse(body));

    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 400 });
    }

    const result = await gdprCompliance.requestDataDeletion(userId, tenantId);

    return NextResponse.json({
      success: true,
      requestId: result.requestId,
      status: result.status,
      message: anonymize
        ? "User data has been anonymized"
        : "User data deletion request processed",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }

    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Error deleting user data for GDPR request", {
      userId,
      tenantId,
      anonymize,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
