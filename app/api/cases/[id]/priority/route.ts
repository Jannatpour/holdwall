/**
 * Case Priority API
 * 
 * PUT /api/cases/[id]/priority - Update case priority
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { CaseService } from "@/lib/cases/service";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const caseService = new CaseService();
const eventStore = new DatabaseEventStore();

const updatePrioritySchema = z.object({
  priority: z.enum(["P0", "P1", "P2", "P3"]).nullable(),
});

export async function PUT(
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

        const body = await request.json();
        const validated = updatePrioritySchema.parse(body);

        const updated = await caseService.updateCase(caseId, tenantId, {
          priority: validated.priority,
        });

        // Emit event
        await eventStore.append({
          event_id: crypto.randomUUID(),
          tenant_id: tenantId,
          actor_id: context?.user?.id || "system",
          type: "case.priority.updated",
          occurred_at: new Date().toISOString(),
          correlation_id: caseId,
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            case_id: caseId,
            priority: validated.priority,
          },
          signatures: [],
        });

        logger.info("Case priority updated", {
          tenant_id: tenantId,
          case_id: caseId,
          priority: validated.priority,
        });

        return NextResponse.json(updated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Validation error", details: error.issues },
            { status: 400 }
          );
        }

        logger.error("Failed to update priority", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to update priority", message: error instanceof Error ? error.message : "Unknown error" },
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
