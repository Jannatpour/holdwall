/**
 * Source Compliance Policies API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { DatabaseSourceComplianceService } from "@/lib/compliance/source-implementation";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { logger } from "@/lib/logging/logger";
import type { EventEnvelope } from "@/lib/events/types";
import { randomUUID } from "crypto";
import { z } from "zod";

const complianceService = new DatabaseSourceComplianceService();

const policySchema = z.object({
  source_type: z.string().min(1),
  allowed_sources: z.array(z.string()),
  collection_method: z.enum(["SCRAPE", "API", "RSS", "WEBHOOK"]),
  retention: z.object({
    days: z.number().positive(),
    auto_delete: z.boolean(),
  }),
});

/**
 * GET /api/compliance/source-policies
 * Get all source policies
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const policies = await db.sourcePolicy.findMany({
      where: { tenantId: tenant_id },
      orderBy: { sourceType: "asc" },
    });

    return NextResponse.json({
      policies: policies.map((p) => ({
        id: p.id,
        source_type: p.sourceType,
        allowed_sources: p.allowedSources,
        collection_method: p.collectionMethod,
        retention: {
          days: p.retentionDays,
          auto_delete: p.autoDelete,
        },
        compliance_flags: p.complianceFlags,
      })),
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching source policies", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/compliance/source-policies
 * Create a new source policy
 */
export async function POST(request: NextRequest) {
  let validated: z.infer<typeof policySchema> | null = null;
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    validated = policySchema.parse(body);

    const policyId = await complianceService.createPolicy({
      tenant_id,
      source_type: validated.source_type,
      allowed_sources: validated.allowed_sources,
      collection_method: validated.collection_method.toLowerCase() as any,
      retention: validated.retention,
      compliance_flags: [],
    });

    // Audit logging
    const auditLog = new DatabaseAuditLog();
    const user_id = (user as any).id || "";
    const correlationId = `source-policy-create-${policyId}-${Date.now()}`;
    const occurredAt = new Date().toISOString();
    const auditEvent: EventEnvelope = {
      event_id: randomUUID(),
      tenant_id,
      actor_id: user_id,
      type: "action.source_policy_create",
      occurred_at: occurredAt,
      correlation_id: correlationId,
      causation_id: undefined,
      schema_version: "1.0",
      evidence_refs: [policyId],
      payload: {
        policy_id: policyId,
        source_type: validated.source_type,
        collection_method: validated.collection_method,
        retention_days: validated.retention.days,
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
      evidence_refs: [policyId],
    });

    return NextResponse.json({ id: policyId });
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
    logger.error("Error creating source policy", {
      sourceType: validated?.source_type,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
