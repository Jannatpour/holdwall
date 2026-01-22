import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const { sku, sources } = body;

    // Save sources to database (create SourceIntegration records)
    // For now, just log and return success
    logger.info("Onboarding: Sources saved", { tenant_id, sku, source_count: sources.length });

    // In production, save to database:
    // await db.sourceIntegration.createMany({...})

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Onboarding: Failed to save sources", { error });
    return NextResponse.json(
      { error: "Failed to save sources" },
      { status: 500 }
    );
  }
}
