/**
 * AAAL Artifacts API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { AAALStudioService } from "@/lib/aaal/studio";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { broadcastArtifactUpdate } from "@/lib/events/broadcast-helper";
import { validateBusinessRules } from "@/lib/validation/business-rules";
import { IdempotencyService, withIdempotency } from "@/lib/operations/idempotency";
import { TransactionManager } from "@/lib/operations/transaction-manager";
import { ErrorRecoveryService } from "@/lib/operations/error-recovery";
import { logger } from "@/lib/logging/logger";
import type { EventEnvelope } from "@/lib/events/types";
import { randomUUID } from "crypto";
import { z } from "zod";

// Skip data collection during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const eventStore = new DatabaseEventStore();
const evidenceVault = new DatabaseEvidenceVault();
const studioService = new AAALStudioService(evidenceVault, eventStore);
const idempotencyService = new IdempotencyService();
const transactionManager = new TransactionManager();
const errorRecovery = new ErrorRecoveryService();

const createDraftSchema = z.object({
  title: z.string(),
  content: z.string(),
  evidence_refs: z.array(z.string()),
});

const updateArtifactSchema = z.object({
  artifact_id: z.string(),
  title: z.string().optional(),
  content: z.string().optional(),
  evidence_refs: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "PUBLISHED"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const searchParams = request.nextUrl.searchParams;
    const artifact_id = searchParams.get("id");
    const status = searchParams.get("status");

    if (artifact_id) {
      const artifact = await db.aAALArtifact.findUnique({
        where: { id: artifact_id },
        include: {
          evidenceRefs: {
            include: {
              evidence: true,
            },
          },
        },
      });

      if (!artifact || artifact.tenantId !== tenant_id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json(artifact);
    }

    const where: any = { tenantId: tenant_id };
    if (status) {
      where.status = status.toUpperCase();
    }

    const artifacts = await db.aAALArtifact.findMany({
      where,
      include: {
        evidenceRefs: {
          include: {
            evidence: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(artifacts);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching artifacts", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
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
    const validated = createDraftSchema.parse(body);

    // Validate artifact content and citations
    const validation = await validateBusinessRules("artifact", {
      content: validated.content,
      type: "REBUTTAL", // Default type, can be made configurable
      evidenceIds: validated.evidence_refs,
    }, tenant_id);

    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      );
    }

    // Execute with idempotency, transaction management, and error recovery
    const artifact_id = await withIdempotency(
      idempotencyService,
      tenant_id,
      "create_artifact",
      {
        title: validated.title,
        content: validated.content,
        evidence_refs: validated.evidence_refs,
      },
      async () => {
        return await transactionManager.executeSimple(async (tx) => {
          // Create artifact in database
          const artifact = await tx.aAALArtifact.create({
            data: {
              tenantId: tenant_id,
              title: validated.title,
              content: validated.content,
              version: "1.0.0",
              status: "DRAFT",
              approvers: [],
              requiredApprovals: 0,
            },
          });

          // Create evidence references
          if (validated.evidence_refs.length > 0) {
            await tx.aAALArtifactEvidence.createMany({
              data: validated.evidence_refs.map((evidenceId) => ({
                artifactId: artifact.id,
                evidenceId,
              })),
            });
          }

          // Emit event via studio service (for event sourcing)
          await studioService.createDraft(
            tenant_id,
            validated.title,
            validated.content,
            validated.evidence_refs
          ).catch((error) => {
            // Log event emission failure but don't fail the transaction
            logger.warn("Failed to emit artifact creation event", {
              artifactId: artifact.id,
              error: error instanceof Error ? error.message : String(error),
            });
          });

          return artifact.id;
        });
      }
    );

    // Broadcast real-time update
    await broadcastArtifactUpdate(artifact_id, "created", {
      title: validated.title,
      status: "DRAFT",
    }, tenant_id);

    return NextResponse.json({ artifact_id }, { status: 201 });
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
    logger.error("Error creating artifact", {
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
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();
    const validated = updateArtifactSchema.parse(body);

    const artifact = await db.aAALArtifact.findUnique({
      where: { id: validated.artifact_id },
    });

    if (!artifact || artifact.tenantId !== tenant_id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Update artifact
    const updateData: any = {};
    if (validated.title !== undefined) updateData.title = validated.title;
    if (validated.content !== undefined) updateData.content = validated.content;
    if (validated.status !== undefined) updateData.status = validated.status;

    const updated = await db.aAALArtifact.update({
      where: { id: validated.artifact_id },
      data: updateData,
    });

    // Update evidence refs if provided
    if (validated.evidence_refs !== undefined) {
      // Delete existing refs
      await db.aAALArtifactEvidence.deleteMany({
        where: { artifactId: validated.artifact_id },
      });

      // Create new refs
      await db.aAALArtifactEvidence.createMany({
        data: validated.evidence_refs.map((evidenceId) => ({
          artifactId: validated.artifact_id,
          evidenceId,
        })),
      });
    }

    // Audit logging
    const auditLog = new DatabaseAuditLog();
    const user_id = (user as any).id || "";
    const correlationId = `aaal-update-${validated.artifact_id}-${Date.now()}`;
    const occurredAt = new Date().toISOString();
    const auditEvent: EventEnvelope = {
      event_id: randomUUID(),
      tenant_id,
      actor_id: user_id,
      type: "action.aaal_artifact_update",
      occurred_at: occurredAt,
      correlation_id: correlationId,
      causation_id: undefined,
      schema_version: "1.0",
      evidence_refs: [validated.artifact_id, ...(validated.evidence_refs || [])],
      payload: {
        artifact_id: validated.artifact_id,
        changes: {
          title: validated.title !== undefined,
          content: validated.content !== undefined,
          status: validated.status !== undefined,
          evidence_refs: validated.evidence_refs !== undefined,
        },
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
      evidence_refs: [validated.artifact_id, ...(validated.evidence_refs || [])],
    });

    // Broadcast real-time update
    await broadcastArtifactUpdate(validated.artifact_id, "updated", {
      title: updated.title,
      status: updated.status,
      changes: {
        title: validated.title !== undefined,
        content: validated.content !== undefined,
        status: validated.status !== undefined,
        evidence_refs: validated.evidence_refs !== undefined,
      },
    }, tenant_id);

    return NextResponse.json(updated);
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
    logger.error("Error updating artifact", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
