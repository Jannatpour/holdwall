import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const onboardingSourcesSchema = z.object({
  sku: z.string().min(1),
  sources: z.array(z.unknown()).default([]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const { sku, sources } = onboardingSourcesSchema.parse(body);

    logger.info("Onboarding: Sources saved", { tenant_id, sku, source_count: sources.length });

    // Persist to tenant settings for durable onboarding state.
    const tenant = await db.tenant.findUnique({ where: { id: tenant_id } });
    if (tenant) {
      const currentSettings = (tenant.settings || {}) as any;
      await db.tenant.update({
        where: { id: tenant_id },
        data: {
          settings: {
            ...currentSettings,
            onboarding: {
              ...(currentSettings.onboarding || {}),
              sku,
              sources,
              sources_completed_at: new Date().toISOString(),
            },
          },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    logger.error("Onboarding: Failed to save sources", { error });
    return NextResponse.json(
      { error: "Failed to save sources" },
      { status: 500 }
    );
  }
}
