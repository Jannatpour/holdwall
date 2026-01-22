/**
 * Approvals API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { financialServicesMode } from "@/lib/financial-services/operating-mode";
import { broadcastArtifactUpdate } from "@/lib/events/broadcast-helper";
import { logger } from "@/lib/logging/logger";
import { randomUUID } from "crypto";
import { z } from "zod";

const createApprovalSchema = z.object({
  resource_type: z.string(),
  resource_id: z.string(),
  action: z.string(),
  approvers: z.array(z.string()),
  evidence_refs: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const decideApprovalSchema = z.object({
  approval_id: z.string(),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch (authError) {
      const errorMessage = authError instanceof Error ? authError.message : "Authentication failed";
      if (errorMessage === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      logger.error("Auth error in approvals route", {
        error: authError instanceof Error ? authError.message : String(authError),
      });
      return NextResponse.json(
        { error: "Authentication error", details: errorMessage },
        { status: 401 }
      );
    }

    const tenant_id = (user as any)?.tenantId || "";

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status"); // "pending" | "decided"
    const countOnly = searchParams.get("count") === "true"; // For overview page

    const where: any = { tenantId: tenant_id };
    if (status === "pending") {
      where.decision = null;
    } else if (status === "decided") {
      where.decision = { not: null };
    }

    // If count only, return just the count
    if (countOnly) {
      const count = await db.approval.count({ where }).catch(() => 0);
      return NextResponse.json({ count });
    }

    const approvals = await db.approval.findMany({
      where,
      include: {
        artifact: true,
      },
      orderBy: { createdAt: "desc" },
    }).catch(() => []);

    return NextResponse.json(approvals);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error fetching approvals", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: process.env.NODE_ENV === "development" ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();

    // Check if creating or deciding
    if (body.approval_id) {
      // Deciding on approval
      const validated = decideApprovalSchema.parse(body);
      await requireRole("APPROVER");

      const userId = (user as any).id;
      if (!userId) {
        return NextResponse.json({ error: "User ID not found" }, { status: 400 });
      }

      const approval = await db.approval.update({
        where: { id: validated.approval_id },
        data: {
          decision: validated.decision.toUpperCase() as any,
          approverId: userId,
          reason: validated.reason,
          decidedAt: new Date(),
        },
      });

      // If approved and it's an artifact, update artifact status
      if (validated.decision === "approved" && approval.resourceType === "AAAL_ARTIFACT") {
        const updated = await db.aAALArtifact.update({
          where: { id: approval.resourceId },
          data: { status: "APPROVED" },
        });
        
        // Broadcast real-time update
        await broadcastArtifactUpdate(approval.resourceId, "approved", {
          status: "APPROVED",
          approverId: userId,
        }, tenant_id);
      }

      // Audit logging
      const auditLog = new DatabaseAuditLog();
      const correlationId = `approval-decision-${validated.approval_id}-${Date.now()}`;
      await auditLog.append({
        audit_id: randomUUID(),
        tenant_id,
        actor_id: userId,
        type: "approval",
        timestamp: new Date().toISOString(),
        correlation_id: correlationId,
        causation_id: undefined,
        data: {
          action: "approval_decision",
          approval_id: validated.approval_id,
          decision: validated.decision,
          reason: validated.reason,
          resource_type: approval.resourceType,
          resource_id: approval.resourceId,
        } as any,
        evidence_refs: [validated.approval_id, approval.resourceId],
      });

      return NextResponse.json(approval);
    } else {
      // Creating approval request
      const validated = createApprovalSchema.parse(body);
      const userId = (user as any).id;
      if (!userId) {
        return NextResponse.json({ error: "User ID not found" }, { status: 400 });
      }

      // Check Financial Services mode - if enabled, require Legal approval
      let approvers: string[] = [];
      try {
        const fsConfig = await financialServicesMode.getConfig(tenant_id);
        if (fsConfig.enabled && fsConfig.legalApprovalRequired && validated.resource_type === "AAAL_ARTIFACT") {
          // For Financial Services, ensure Legal is in approvers list
          // Find users with Legal role or approver role
          const legalApprovers = await db.user.findMany({
            where: {
              tenantId: tenant_id,
              OR: [
                { role: "APPROVER" as any },
                { role: "ADMIN" as any },
              ],
            },
            select: { id: true, name: true, email: true },
          });

          // Add Legal as a required approver (using role name as identifier)
          approvers = ["Legal", ...legalApprovers.map((u: { id: string; name: string | null; email: string | null }) => u.id)];
        } else {
          // Standard approval flow
          approvers =
            validated.approvers.length > 0
              ? validated.approvers
              : (
                  await db.user.findMany({
                    where: {
                      tenantId: tenant_id,
                      role: { in: ["ADMIN", "APPROVER"] as any },
                    },
                    select: { id: true },
                  })
                ).map((u: { id: string }) => u.id);
        }
      } catch (fsError) {
        // If Financial Services check fails, use standard flow
        approvers =
          validated.approvers.length > 0
            ? validated.approvers
            : (
                await db.user.findMany({
                  where: {
                    tenantId: tenant_id,
                    role: { in: ["ADMIN", "APPROVER"] as any },
                  },
                  select: { id: true },
                })
              ).map((u: { id: string }) => u.id);
      }

      const approval = await db.approval.create({
        data: {
          tenantId: tenant_id,
          resourceType: validated.resource_type,
          resourceId: validated.resource_id,
          action: validated.action,
          requesterId: userId,
          approvers,
          artifactId: validated.resource_type === "AAAL_ARTIFACT" ? validated.resource_id : null,
        },
      });

      // Audit logging
      const auditLog = new DatabaseAuditLog();
      const correlationId = `approval-create-${approval.id}-${Date.now()}`;
      await auditLog.append({
        audit_id: randomUUID(),
        tenant_id,
        actor_id: userId,
        type: "approval",
        timestamp: new Date().toISOString(),
        correlation_id: correlationId,
        causation_id: undefined,
        data: {
          action: "approval_create",
          approval_id: approval.id,
          resource_type: validated.resource_type,
          resource_id: validated.resource_id,
          action_type: validated.action,
          approvers_count: approvers.length,
        } as any,
        evidence_refs: [approval.id, validated.resource_id, ...(validated.evidence_refs || [])],
      });

      return NextResponse.json(approval, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    if ((error as Error).message === "Unauthorized" || (error as Error).message === "Forbidden") {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: (error as Error).message === "Unauthorized" ? 401 : 403 }
      );
    }
    logger.error("Error processing approval", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
