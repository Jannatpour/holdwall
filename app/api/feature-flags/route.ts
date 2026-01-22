/**
 * Feature Flags API
 * Manage and check feature flags
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { getFeatureFlagManager, isFeatureEnabled } from "@/lib/feature-flags/config";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const flagName = request.nextUrl.searchParams.get("flag");

    if (flagName) {
      // Check specific flag
      const enabled = await isFeatureEnabled(
        flagName,
        (user as any).id,
        (user as any).tenantId,
        (user as any).role
      );

      return NextResponse.json({
        flag: flagName,
        enabled,
      });
    }

    // List all flags (admin only)
    await requireRole("ADMIN");
    const manager = getFeatureFlagManager();
    const flags = manager.listFlags();

    return NextResponse.json({ flags });
  } catch (error) {
    if ((error as Error).message === "Unauthorized" || (error as Error).message === "Forbidden") {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: (error as Error).message === "Unauthorized" ? 401 : 403 }
      );
    }

    logger.error("Error fetching feature flags", {
      flagName: request.nextUrl.searchParams.get("flag"),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  let body: any = null;
  try {
    await requireAuth();
    await requireRole("ADMIN"); // Only admins can update feature flags

    body = await request.json();
    const flagSchema = z.object({
      name: z.string(),
      enabled: z.boolean(),
      description: z.string().optional(),
      rollout_percentage: z.number().min(0).max(100).optional(),
      target_users: z.array(z.string()).optional(),
      target_tenants: z.array(z.string()).optional(),
      target_roles: z.array(z.string()).optional(),
    });

    const flag = flagSchema.parse(body);
    const manager = getFeatureFlagManager();
    manager.setFlag(flag);

    return NextResponse.json({ success: true, flag });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }

    if ((error as Error).message === "Unauthorized" || (error as Error).message === "Forbidden") {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: (error as Error).message === "Unauthorized" ? 401 : 403 }
      );
    }

    logger.error("Error updating feature flag", {
      flagName: body?.name,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
