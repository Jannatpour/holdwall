/**
 * Playbooks API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { PlaybookExecutor, type PlaybookExecutionResult } from "@/lib/playbooks/executor";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { validateBusinessRules } from "@/lib/validation/business-rules";
import { IdempotencyService, withIdempotency } from "@/lib/operations/idempotency";
import { TransactionManager } from "@/lib/operations/transaction-manager";
import { ErrorRecoveryService } from "@/lib/operations/error-recovery";
import type { EventEnvelope } from "@/lib/events/types";
import { randomUUID } from "crypto";
import { z } from "zod";

const idempotencyService = new IdempotencyService();
const transactionManager = new TransactionManager();
const errorRecovery = new ErrorRecoveryService();

const createPlaybookSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  template: z.record(z.string(), z.unknown()),
  autopilot_mode: z.enum(["RECOMMEND_ONLY", "AUTO_DRAFT", "AUTO_ROUTE", "AUTO_PUBLISH"]),
});

const executePlaybookSchema = z.object({
  playbook_id: z.string(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

const updatePlaybookSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  template: z.record(z.string(), z.unknown()).optional(),
  autopilot_mode: z.enum(["RECOMMEND_ONLY", "AUTO_DRAFT", "AUTO_ROUTE", "AUTO_PUBLISH"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const searchParams = request.nextUrl.searchParams;
    const playbook_id = searchParams.get("id");

    if (playbook_id) {
      const playbook = await db.playbook.findUnique({
        where: { id: playbook_id },
        include: {
          executions: {
            orderBy: { startedAt: "desc" },
            take: 10,
          },
        },
      });

      if (!playbook || playbook.tenantId !== tenant_id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json(playbook);
    }

    const playbooks = await db.playbook.findMany({
      where: { tenantId: tenant_id },
      include: {
        executions: {
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(playbooks);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error fetching playbooks", {
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
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();

    // Check if executing or creating
    if (body.playbook_id) {
      // Execute playbook
      const validated = executePlaybookSchema.parse(body);

      const playbook = await db.playbook.findUnique({
        where: { id: validated.playbook_id },
      });

      if (!playbook || playbook.tenantId !== tenant_id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      // Create execution record
      const execution = await db.playbookExecution.create({
        data: {
          playbookId: validated.playbook_id,
          status: "RUNNING",
        },
      });

      // Execute playbook with error recovery
      const executor = new PlaybookExecutor();
      const recoveryResult = await errorRecovery.executeWithRecovery(
        async () => {
          return await executor.execute(validated.playbook_id, validated.parameters);
        },
        {
          retry: {
            maxAttempts: 1, // Playbooks shouldn't be retried automatically
            backoffMs: 0,
            exponential: false,
          },
          timeout: 300_000, // 5 minutes for playbook execution
          circuitBreaker: errorRecovery.getCircuitBreaker("playbook_execution"),
        },
        "execute_playbook"
      );

      if (!recoveryResult.success) {
        await db.playbookExecution.update({
          where: { id: execution.id },
          data: {
            status: "FAILED",
            error: recoveryResult.error?.message || "Playbook execution failed",
            completedAt: new Date(),
          },
        });
        throw recoveryResult.error || new Error("Playbook execution failed");
      }

      const result = recoveryResult.result as PlaybookExecutionResult;

      // Update execution record
      const finalStatus = result.status === "completed" ? "COMPLETED" :
                         result.status === "failed" ? "FAILED" :
                         result.status === "pending_approval" ? "PENDING" : "RUNNING";

      await db.playbookExecution.update({
        where: { id: execution.id },
        data: {
          status: finalStatus,
          result: result.result as any,
          error: result.error,
          completedAt: result.status !== "pending_approval" ? new Date() : null,
        },
      });

      return NextResponse.json({
        ...execution,
        status: finalStatus,
        result: result.result,
        error: result.error,
        approval_id: result.approval_id,
      });
    } else {
      // Create playbook
      const validated = createPlaybookSchema.parse(body);

      // Validate playbook configuration
      const validation = await validateBusinessRules("playbook", {
        triggers: (validated.template as any)?.triggers || [],
        actions: (validated.template as any)?.actions || [],
      }, tenant_id);

      if (!validation.valid) {
        return NextResponse.json(
          { error: "Validation failed", details: validation.errors },
          { status: 400 }
        );
      }

      // Execute with idempotency
      const playbook = await withIdempotency(
        idempotencyService,
        tenant_id,
        "create_playbook",
        {
          name: validated.name,
          template: validated.template,
          autopilot_mode: validated.autopilot_mode,
        },
        async () => {
          return await transactionManager.executeSimple(async (tx) => {
            return await tx.playbook.create({
              data: {
                tenantId: tenant_id,
                name: validated.name,
                description: validated.description,
                template: validated.template as any,
                autopilotMode: validated.autopilot_mode,
              },
            });
          });
        }
      );

      // Audit logging
      const auditLog = new DatabaseAuditLog();
      const user_id = (user as any).id || "";
      const correlationId = `playbook-create-${playbook.id}-${Date.now()}`;
      const occurredAt = new Date().toISOString();
      const auditEvent: EventEnvelope = {
        event_id: randomUUID(),
        tenant_id,
        actor_id: user_id,
        type: "action.playbook_create",
        occurred_at: occurredAt,
        correlation_id: correlationId,
        causation_id: undefined,
        schema_version: "1.0",
        evidence_refs: [playbook.id],
        payload: {
          playbook_id: playbook.id,
          playbook_name: validated.name,
          autopilot_mode: validated.autopilot_mode,
        },
        signatures: [],
      };
      await auditLog.append({
        audit_id: randomUUID(),
        tenant_id,
        actor_id: user_id,
        type: "event",
        timestamp: occurredAt,
        correlation_id: correlationId,
        causation_id: undefined,
        data: auditEvent,
        evidence_refs: [playbook.id],
      });

      return NextResponse.json(playbook, { status: 201 });
    }
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
    logger.error("Error processing playbook", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();

    const searchParams = request.nextUrl.searchParams;
    const playbook_id = searchParams.get("id");

    if (!playbook_id) {
      return NextResponse.json({ error: "Playbook ID is required" }, { status: 400 });
    }

    // Verify playbook belongs to tenant
    const existingPlaybook = await db.playbook.findUnique({
      where: { id: playbook_id },
    });

    if (!existingPlaybook || existingPlaybook.tenantId !== tenant_id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const validated = updatePlaybookSchema.parse(body);

    const updatedPlaybook = await db.playbook.update({
      where: { id: playbook_id },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.template && { template: validated.template as any }),
        ...(validated.autopilot_mode && { autopilotMode: validated.autopilot_mode }),
      },
    });

    // Audit logging
    const auditLog = new DatabaseAuditLog();
    const user_id = (user as any).id || "";
    const correlationId = `playbook-update-${playbook_id}-${Date.now()}`;
    const occurredAt = new Date().toISOString();
    const auditEvent: EventEnvelope = {
      event_id: randomUUID(),
      tenant_id,
      actor_id: user_id,
      type: "action.playbook_update",
      occurred_at: occurredAt,
      correlation_id: correlationId,
      causation_id: undefined,
      schema_version: "1.0",
      evidence_refs: [playbook_id],
      payload: {
        playbook_id,
        updates: validated,
      },
      signatures: [],
    };
    await auditLog.append({
      audit_id: randomUUID(),
      tenant_id,
      actor_id: user_id,
      type: "event",
      timestamp: occurredAt,
      correlation_id: correlationId,
      causation_id: undefined,
      data: auditEvent,
      evidence_refs: [playbook_id],
    });

    return NextResponse.json(updatedPlaybook);
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
    logger.error("Error updating playbook", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const searchParams = request.nextUrl.searchParams;
    const playbook_id = searchParams.get("id");

    if (!playbook_id) {
      return NextResponse.json({ error: "Playbook ID is required" }, { status: 400 });
    }

    // Verify playbook belongs to tenant
    const existingPlaybook = await db.playbook.findUnique({
      where: { id: playbook_id },
    });

    if (!existingPlaybook || existingPlaybook.tenantId !== tenant_id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.playbook.delete({
      where: { id: playbook_id },
    });

    // Audit logging
    const auditLog = new DatabaseAuditLog();
    const user_id = (user as any).id || "";
    const correlationId = `playbook-delete-${playbook_id}-${Date.now()}`;
    const occurredAt = new Date().toISOString();
    const auditEvent: EventEnvelope = {
      event_id: randomUUID(),
      tenant_id,
      actor_id: user_id,
      type: "action.playbook_delete",
      occurred_at: occurredAt,
      correlation_id: correlationId,
      causation_id: undefined,
      schema_version: "1.0",
      evidence_refs: [playbook_id],
      payload: {
        playbook_id,
        playbook_name: existingPlaybook.name,
      },
      signatures: [],
    };
    await auditLog.append({
      audit_id: randomUUID(),
      tenant_id,
      actor_id: user_id,
      type: "event",
      timestamp: occurredAt,
      correlation_id: correlationId,
      causation_id: undefined,
      data: auditEvent,
      evidence_refs: [playbook_id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error deleting playbook", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
