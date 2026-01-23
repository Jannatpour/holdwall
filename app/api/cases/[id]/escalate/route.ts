/**
 * Case Escalation API
 * 
 * POST /api/cases/[id]/escalate - Escalate case
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const eventStore = new DatabaseEventStore();

const escalateSchema = z.object({
  reason: z.string().min(1).max(5000),
  fromLevel: z.string().min(1),
  toLevel: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const handler = createApiHandler(
    async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
      try {
        const caseId = id;
        const tenantId = context?.tenantId;

        if (!tenantId) {
          return NextResponse.json(
            { error: "Tenant ID required" },
            { status: 400 }
          );
        }

        if (!context?.user?.id) {
          return NextResponse.json(
            { error: "User ID required" },
            { status: 401 }
          );
        }

        // Verify case belongs to tenant
        const case_ = await db.case.findFirst({
          where: { id: caseId, tenantId },
        });

        if (!case_) {
          return NextResponse.json(
            { error: "Case not found" },
            { status: 404 }
          );
        }

        const body = await request.json();
        const validated = escalateSchema.parse(body);

        const escalation = await db.caseEscalation.create({
          data: {
            caseId,
            reason: validated.reason,
            fromLevel: validated.fromLevel,
            toLevel: validated.toLevel,
            escalatedBy: context.user.id,
          },
        });

        // Emit event
        await eventStore.append({
          event_id: crypto.randomUUID(),
          tenant_id: tenantId,
          actor_id: context.user.id,
          type: "case.escalated",
          occurred_at: new Date().toISOString(),
          correlation_id: caseId,
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            case_id: caseId,
            from_level: validated.fromLevel,
            to_level: validated.toLevel,
            reason: validated.reason,
          },
          signatures: [],
        });

        logger.info("Case escalated", {
          tenant_id: tenantId,
          case_id: caseId,
          from_level: validated.fromLevel,
          to_level: validated.toLevel,
        });

        return NextResponse.json(escalation, { status: 201 });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Validation error", details: error.issues },
            { status: 400 }
          );
        }

        logger.error("Failed to escalate case", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to escalate case", message: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: 100,
      },
    }
  );
  return handler(request);
}
