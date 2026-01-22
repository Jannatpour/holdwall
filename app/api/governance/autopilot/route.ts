/**
 * Autopilot Controls API
 * Manage workflow automation modes with audit logging and permission checks
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { z } from "zod";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { randomUUID } from "crypto";

const updateAutopilotSchema = z.object({
  workflow_id: z.string(),
  mode: z.enum(["recommend_only", "auto_draft", "auto_route", "auto_publish"]),
  enabled: z.boolean(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    await requireRole("VIEWER"); // Any authenticated user can view autopilot configs
    const tenant_id = (user as any).tenantId || "";

    if (!tenant_id) {
      return NextResponse.json(
        { error: "Tenant ID is required" },
        { status: 400 }
      );
    }

    const playbooks = await db.playbook.findMany({
      where: { tenantId: tenant_id },
      select: {
        id: true,
        name: true,
        description: true,
        autopilotMode: true,
        template: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const workflows = playbooks.map((pb) => ({
      id: pb.id,
      name: pb.name,
      description: pb.description || "",
      mode:
        pb.autopilotMode === "RECOMMEND_ONLY"
          ? ("recommend_only" as const)
          : pb.autopilotMode === "AUTO_DRAFT"
            ? ("auto_draft" as const)
            : pb.autopilotMode === "AUTO_ROUTE"
              ? ("auto_route" as const)
              : ("auto_publish" as const),
      enabled:
        typeof (pb.template as any)?.enabled === "boolean"
          ? Boolean((pb.template as any).enabled)
          : true,
    }));

    return NextResponse.json({ workflows });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error fetching autopilot configs", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" 
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    await requireRole("APPROVER"); // Only approvers and admins can modify autopilot configs
    const tenant_id = (user as any).tenantId || "";
    const user_id = (user as any).id || "";

    const body = await request.json();
    const validated = updateAutopilotSchema.parse(body);

    const workflowId = validated.workflow_id;
    const mode = validated.mode;

    // Update playbook autopilot mode
    const playbook = await db.playbook.findFirst({
      where: {
        id: workflowId,
        tenantId: tenant_id,
      },
    });

    if (!playbook) {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
    }

    const modeMap: Record<
      "recommend_only" | "auto_draft" | "auto_route" | "auto_publish",
      "RECOMMEND_ONLY" | "AUTO_DRAFT" | "AUTO_ROUTE" | "AUTO_PUBLISH"
    > = {
      recommend_only: "RECOMMEND_ONLY",
      auto_draft: "AUTO_DRAFT",
      auto_route: "AUTO_ROUTE",
      auto_publish: "AUTO_PUBLISH",
    };

    const oldMode = playbook.autopilotMode;
    const oldEnabled = typeof (playbook.template as any)?.enabled === "boolean" 
      ? Boolean((playbook.template as any).enabled) 
      : true;

    await db.playbook.update({
      where: { id: workflowId },
      data: {
        autopilotMode: modeMap[mode],
        template: {
          ...(playbook.template as any),
          enabled: validated.enabled,
        } as any,
      },
    });

    // Audit logging
    const auditLog = new DatabaseAuditLog();
    const correlationId = `autopilot-${workflowId}-${Date.now()}`;
    await auditLog.append({
      audit_id: randomUUID(),
      tenant_id,
      actor_id: user_id,
      type: "approval",
      timestamp: new Date().toISOString(),
      correlation_id: correlationId,
      causation_id: undefined,
      data: {
        action: "autopilot_config_update",
        workflow_id: workflowId,
        workflow_name: playbook.name,
        changes: {
          mode: {
            from: oldMode,
            to: modeMap[mode],
          },
          enabled: {
            from: oldEnabled,
            to: validated.enabled,
          },
        },
      } as any,
      evidence_refs: [],
    });

    return NextResponse.json({ success: true });
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
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error updating autopilot config", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" 
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      },
      { status: 500 }
    );
  }
}
