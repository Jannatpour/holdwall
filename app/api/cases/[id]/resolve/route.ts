/**
 * Case Resolution API
 * 
 * POST /api/cases/[id]/resolve - Mark case as resolved
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { CaseService } from "@/lib/cases/service";
import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const caseService = new CaseService();
const eventStore = new DatabaseEventStore();

const resolveSchema = z.object({
  resolutionNotes: z.string().optional(),
  outcome: z.string().optional(),
  artifactIds: z.array(z.string()).optional(),
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

        const body = await request.json();
        const validated = resolveSchema.parse(body);

        // Update case status to RESOLVED
        const updated = await caseService.updateCase(caseId, tenantId, {
          status: "RESOLVED",
        });

        // Update resolution if it exists
        const resolution = await db.caseResolution.findUnique({
          where: { caseId },
        });

        if (resolution) {
          await db.caseResolution.update({
            where: { caseId },
            data: {
              status: "APPROVED",
              resolvedBy: context?.user?.id || "system",
              resolvedAt: new Date(),
            },
          });
        }

        // Emit event
        await eventStore.append({
          event_id: crypto.randomUUID(),
          tenant_id: tenantId,
          actor_id: context?.user?.id || "system",
          type: "case.resolved",
          occurred_at: new Date().toISOString(),
          correlation_id: caseId,
          schema_version: "1.0",
          evidence_refs: validated.artifactIds || [],
          payload: {
            case_id: caseId,
            resolution_notes: validated.resolutionNotes,
            outcome: validated.outcome,
            artifact_ids: validated.artifactIds,
          },
          signatures: [],
        });

        logger.info("Case resolved", {
          tenant_id: tenantId,
          case_id: caseId,
        });

        return NextResponse.json({
          success: true,
          case: updated,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Validation error", details: error.issues },
            { status: 400 }
          );
        }

        logger.error("Failed to resolve case", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to resolve case", message: error instanceof Error ? error.message : "Unknown error" },
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
