/**
 * Autonomous Operations Cycle API
 * 
 * Endpoint for executing full autonomous operation cycles
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { AutonomousOrchestrator } from "@/lib/autonomous/orchestrator";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { randomUUID } from "crypto";
import { z } from "zod";
import type { EventEnvelope } from "@/lib/events/types";

const cycleSchema = z.object({
  operation: z.enum(["monitoring", "publishing", "engagement", "semantic-dominance", "full"]),
  config: z.object({
    enabledOperations: z.object({
      monitoring: z.boolean().optional(),
      publishing: z.boolean().optional(),
      engagement: z.boolean().optional(),
      semanticDominance: z.boolean().optional(),
    }).optional(),
    policyConstraints: z.object({
      requireApproval: z.boolean().optional(),
      autoApproveThreshold: z.number().optional(),
      maxOperationsPerDay: z.number().optional(),
    }).optional(),
  }).optional(),
  // For publishing
  artifactId: z.string().optional(),
  content: z.string().optional(),
  title: z.string().optional(),
  // For engagement
  signal: z.object({
    content: z.string(),
    url: z.string(),
    platform: z.string(),
  }).optional(),
});

/**
 * POST /api/autonomous/cycle
 * Execute autonomous operation cycle
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();
    const validated = cycleSchema.parse(body);

    const config = {
      tenantId: tenant_id,
      brandName: (user as any).brandName || "Unknown",
      enabledOperations: validated.config?.enabledOperations || {
        monitoring: true,
        publishing: true,
        engagement: true,
        semanticDominance: true,
      },
      policyConstraints: validated.config?.policyConstraints,
    };

    const orchestrator = new AutonomousOrchestrator(config);

    let result;

    switch (validated.operation) {
      case "monitoring":
        result = await orchestrator.executeMonitoringCycle();
        break;

      case "publishing":
        if (!validated.artifactId || !validated.content || !validated.title) {
          return NextResponse.json(
            { error: "artifactId, content, and title required for publishing" },
            { status: 400 }
          );
        }
        result = await orchestrator.executePublishingCycle(
          validated.artifactId,
          validated.content,
          validated.title
        );
        break;

      case "engagement":
        if (!validated.signal) {
          return NextResponse.json(
            { error: "signal required for engagement" },
            { status: 400 }
          );
        }
        result = await orchestrator.executeEngagementCycle(validated.signal);
        break;

      case "semantic-dominance":
        if (!validated.content || !validated.title) {
          return NextResponse.json(
            { error: "content and title required for semantic dominance" },
            { status: 400 }
          );
        }
        result = await orchestrator.executeSemanticDominanceOptimization(
          validated.content,
          validated.title
        );
        break;

      case "full":
        result = await orchestrator.executeFullCycle();
        break;

      default:
        return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
    }

    // Audit logging
    const auditLog = new DatabaseAuditLog();
    const user_id = (user as any).id || "";
    const correlationId = `autonomous-cycle-${validated.operation}-${Date.now()}`;
    const occurredAt = new Date().toISOString();
    const auditEvent: EventEnvelope = {
      event_id: randomUUID(),
      tenant_id,
      actor_id: user_id,
      type: "action.autonomous_cycle_execute",
      occurred_at: occurredAt,
      correlation_id: correlationId,
      causation_id: undefined,
      schema_version: "1.0",
      evidence_refs: [],
      payload: {
        operation: validated.operation,
        config: validated.config,
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
      evidence_refs: [],
    });

    return NextResponse.json({
      success: true,
      tenant_id,
      result,
    });
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
    logger.error("Autonomous cycle error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
