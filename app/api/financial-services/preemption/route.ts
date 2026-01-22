/**
 * Financial Services Preemption Playbooks API
 * Manage and execute preemptive narrative management
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { preemptionPlaybooks } from "@/lib/financial-services/preemption-playbooks";
import { z } from "zod";

const executePlaybookSchema = z.object({
  playbookId: z.string(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const playbooks = await preemptionPlaybooks.getPlaybooks(tenantId);
    const triggers = await preemptionPlaybooks.checkTriggers(tenantId);

    return NextResponse.json({
      playbooks,
      triggers,
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error fetching preemption playbooks", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const body = await request.json();
    const { action } = body;

    if (action === "create_defaults") {
      await preemptionPlaybooks.createDefaultPlaybooks(tenantId);
      return NextResponse.json({ success: true });
    }

    if (action === "execute") {
      const validated = executePlaybookSchema.parse(body);
      const result = await preemptionPlaybooks.executePreemptiveActions(
        tenantId,
        validated.playbookId
      );
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error executing preemption playbook", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
