/**
 * Update Signal Severity API
 * 
 * Updates the severity of a signal
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const updateSeveritySchema = z.object({
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  reason: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let signal_id: string | undefined;
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const resolvedParams = await params;
    signal_id = resolvedParams.id;

    const body = await request.json();
    const validated = updateSeveritySchema.parse(body);

    // Verify signal exists (signals are stored as Evidence rows)
    const signal = await db.evidence.findUnique({ where: { id: signal_id } });

    if (!signal || signal.tenantId !== tenant_id || signal.type !== "SIGNAL") {
      return NextResponse.json({ error: "Signal not found" }, { status: 404 });
    }

    // Update severity in Evidence.metadata for downstream filtering/UI
    const currentMeta = ((signal.metadata as any) || {}) as Record<string, unknown>;
    const severity = validated.severity.toLowerCase();
    await db.evidence.update({
      where: { id: signal_id },
      data: {
        metadata: ({
          ...currentMeta,
          severity,
          severity_reason: validated.reason,
          severity_updated_at: new Date().toISOString(),
          severity_updated_by: (user as any).id || "system",
        } as any),
      },
    });

    return NextResponse.json({
      signal_id,
      severity: validated.severity,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error updating signal severity", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      signalId: signal_id,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
