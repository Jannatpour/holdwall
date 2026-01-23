/**
 * CAPA API
 * 
 * Endpoints for Corrective Action and Preventive Action management
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CAPAService } from "@/lib/capa/service";
import { TimelineBuilder } from "@/lib/capa/timeline-builder";
import { ChangeTracker } from "@/lib/capa/change-tracker";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const capaService = new CAPAService();
const timelineBuilder = new TimelineBuilder();
const changeTracker = new ChangeTracker();

const createCorrectiveActionSchema = z.object({
  cluster_id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  owner_id: z.string().optional(),
  due_date: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const createPreventiveActionSchema = z.object({
  cluster_id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  owner_id: z.string().optional(),
  due_date: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateActionStatusSchema = z.object({
  action_id: z.string(),
  action_type: z.enum(["corrective", "preventive"]),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "VERIFIED"]),
});

const assignOwnerSchema = z.object({
  action_id: z.string(),
  action_type: z.enum(["corrective", "preventive"]),
  owner_id: z.string(),
});

const getActionsSchema = z.object({
  cluster_id: z.string(),
});

const getTimelineSchema = z.object({
  cluster_id: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const actor_id = (user as any).id || "";

    const body = await request.json();
    const action = body.action;

    if (action === "create_corrective") {
      const validated = createCorrectiveActionSchema.parse(body);

      const correctiveAction = await capaService.createCorrectiveAction(
        tenant_id,
        validated.cluster_id,
        validated.title,
        validated.description,
        {
          priority: validated.priority as any,
          ownerId: validated.owner_id,
          dueDate: validated.due_date ? new Date(validated.due_date) : undefined,
          metadata: validated.metadata,
        }
      );

      return NextResponse.json({
        action: correctiveAction,
      });
    }

    if (action === "create_preventive") {
      const validated = createPreventiveActionSchema.parse(body);

      const preventiveAction = await capaService.createPreventiveAction(
        tenant_id,
        validated.cluster_id,
        validated.title,
        validated.description,
        {
          priority: validated.priority as any,
          ownerId: validated.owner_id,
          dueDate: validated.due_date ? new Date(validated.due_date) : undefined,
          metadata: validated.metadata,
        }
      );

      return NextResponse.json({
        action: preventiveAction,
      });
    }

    if (action === "update_status") {
      const validated = updateActionStatusSchema.parse(body);

      const updatedAction = await capaService.updateActionStatus(
        validated.action_id,
        validated.action_type,
        validated.status as any,
        tenant_id,
        actor_id
      );

      return NextResponse.json({
        action: updatedAction,
      });
    }

    if (action === "assign_owner") {
      const validated = assignOwnerSchema.parse(body);

      await capaService.assignOwner(
        validated.action_id,
        validated.action_type,
        validated.owner_id,
        tenant_id,
        actor_id
      );

      return NextResponse.json({
        success: true,
      });
    }

    return NextResponse.json(
      {
        error:
          "Invalid action. Use 'create_corrective', 'create_preventive', 'update_status', or 'assign_owner'",
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

    logger.error("CAPA API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "get_actions";

    if (action === "get_actions") {
      const cluster_id = searchParams.get("cluster_id");
      if (!cluster_id) {
        return NextResponse.json({ error: "cluster_id is required" }, { status: 400 });
      }

      const validated = getActionsSchema.parse({ cluster_id });

      const actions = await capaService.getActionsForCluster(validated.cluster_id, tenant_id);

      return NextResponse.json({
        actions,
      });
    }

    if (action === "get_timeline") {
      const cluster_id = searchParams.get("cluster_id");
      if (!cluster_id) {
        return NextResponse.json({ error: "cluster_id is required" }, { status: 400 });
      }

      const validated = getTimelineSchema.parse({ cluster_id });

      const timeline = await timelineBuilder.buildTimeline(validated.cluster_id, tenant_id);

      return NextResponse.json({
        timeline,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'get_actions' or 'get_timeline'" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("CAPA API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
