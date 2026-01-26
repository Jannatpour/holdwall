/**
 * Financial Services Workflow API
 * Track Day 1 → Day 7 → Day 30 workflow progression
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { workflowEngine } from "@/lib/financial-services/workflow-engine";
import { financialServicesMode } from "@/lib/financial-services/operating-mode";
import { z } from "zod";

const workflowActionSchema = z.object({
  action: z.enum(["complete_milestone"]),
  milestoneId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const progress = await workflowEngine.getProgress(tenantId);
    const statusSummary = await workflowEngine.getStatusSummary(tenantId);

    return NextResponse.json({
      progress,
      statusSummary,
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error fetching workflow progress", {
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
    const validated = workflowActionSchema.parse(body);
    const { action, milestoneId } = validated;

    if (action === "complete_milestone") {
      const progress = await workflowEngine.getProgress(tenantId);
      const milestone = progress.milestones.find((m) => m.id === milestoneId);

      if (!milestone) {
        return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
      }

      // Mark milestone as completed based on stage
      if (milestone.stage === "day1") {
        await financialServicesMode.completeDay1(tenantId);
      } else if (milestone.stage === "day7") {
        await financialServicesMode.completeDay7(tenantId);
      } else if (milestone.stage === "day30") {
        await financialServicesMode.completeDay30(tenantId);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
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
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error updating workflow", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
