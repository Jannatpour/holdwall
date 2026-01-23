/**
 * Multi-Step Approval API
 * 
 * Endpoints for multi-step approval workflows
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ApprovalGateway } from "@/lib/engagement/approval-gateway";
import { BreakGlassService } from "@/lib/engagement/break-glass";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const approvalGateway = new ApprovalGateway();
const breakGlassService = new BreakGlassService();

const approveStepSchema = z.object({
  approval_id: z.string(),
  step_number: z.number().int().positive(),
  reason: z.string().optional(),
});

const rejectStepSchema = z.object({
  approval_id: z.string(),
  step_number: z.number().int().positive(),
  reason: z.string(),
});

const breakGlassSchema = z.object({
  approval_id: z.string(),
  reason: z.string(),
  justification: z.string().optional(),
  urgency: z.enum(["HIGH", "CRITICAL"]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const actor_id = (user as any).id || "";

    const body = await request.json();
    const action = body.action;

    if (action === "approve_step") {
      const validated = approveStepSchema.parse(body);

      const approval = await approvalGateway.approveStep(
        validated.approval_id,
        validated.step_number,
        actor_id,
        tenant_id,
        validated.reason
      );

      return NextResponse.json({
        approval,
      });
    }

    if (action === "reject_step") {
      const validated = rejectStepSchema.parse(body);

      const approval = await approvalGateway.rejectStep(
        validated.approval_id,
        validated.step_number,
        actor_id,
        tenant_id,
        validated.reason
      );

      return NextResponse.json({
        approval,
      });
    }

    if (action === "break_glass") {
      const validated = breakGlassSchema.parse(body);

      const breakGlass = await breakGlassService.executeBreakGlass({
        approval_id: validated.approval_id,
        requester_id: actor_id,
        tenant_id,
        reason: validated.reason,
        justification: validated.justification,
        urgency: validated.urgency,
      });

      const approval = await approvalGateway.getApproval(validated.approval_id, tenant_id);

      return NextResponse.json({
        break_glass: breakGlass,
        approval,
      });
    }

    return NextResponse.json(
      {
        error: "Invalid action. Use 'approve_step', 'reject_step', or 'break_glass'",
      },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Multi-step approval API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
