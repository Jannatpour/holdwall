/**
 * Case Reprocessing API
 * 
 * POST /api/cases/[id]/reprocess - Manually trigger case processing (triage + resolution)
 * 
 * Useful when automatic processing failed or when reprocessing is needed.
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { CaseService } from "@/lib/cases/service";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { logger } from "@/lib/logging/logger";
import crypto from "crypto";

const caseService = new CaseService();
const eventStore = new DatabaseEventStore();

/**
 * POST /api/cases/[id]/reprocess - Reprocess case
 */
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

        // Get case
        const case_ = await caseService.getCase(caseId, tenantId);
        if (!case_) {
          return NextResponse.json(
            { error: "Case not found" },
            { status: 404 }
          );
        }

        logger.info("Manual case reprocessing initiated", {
          case_id: caseId,
          case_number: case_.caseNumber,
          current_status: case_.status,
          tenant_id: tenantId,
        });

        // Emit case.created event to trigger processing
        await eventStore.append({
          event_id: crypto.randomUUID(),
          tenant_id: tenantId,
          actor_id: context?.user?.id || "manual-reprocess",
          type: "case.created",
          occurred_at: new Date().toISOString(),
          correlation_id: caseId,
          schema_version: "1.0",
          evidence_refs: case_.evidence?.map((e) => e.evidenceId) || [],
          payload: {
            case_id: caseId,
            case_number: case_.caseNumber,
            type: case_.type,
            status: case_.status,
            reprocess: true,
            triggered_by: context?.user?.id || "manual",
          },
          signatures: [],
        });

        logger.info("Case reprocessing event emitted", {
          case_id: caseId,
          tenant_id: tenantId,
        });

        return NextResponse.json({
          success: true,
          message: "Case reprocessing initiated. Processing will occur asynchronously.",
          caseId,
        });
      } catch (error) {
        logger.error("Failed to reprocess case", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to reprocess case", message: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: 10, // Lower limit for reprocessing
      },
    }
  );
  return handler(request);
}
