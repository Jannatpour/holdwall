/**
 * Case Triage API
 * 
 * POST /api/cases/[id]/triage - Run autonomous triage on a case
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { CaseService } from "@/lib/cases/service";
import { autonomousTriageAgent } from "@/lib/cases/autonomous-triage";
import { logger } from "@/lib/logging/logger";

const caseService = new CaseService();

/**
 * POST /api/cases/[id]/triage - Run triage
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

        // Run triage
        const caseWithEvidence = case_ as typeof case_ & {
          evidence?: Array<{ evidenceId: string }>;
        };
        const triageResult = await autonomousTriageAgent.triage({
          caseId,
          tenantId,
          caseType: case_.type,
          description: case_.description || "",
          impact: case_.impact || undefined,
          evidenceIds: caseWithEvidence.evidence?.map((e) => e.evidenceId) || [],
          submittedBy: case_.submittedBy || undefined,
          metadata: case_.metadata as Record<string, unknown> | undefined,
        });

        // Update case with triage results
        const updated = await caseService.updateCase(caseId, tenantId, {
          status: triageResult.status,
          severity: triageResult.severity,
          priority: triageResult.priority,
        });

        // Send triage notification
        setImmediate(async () => {
          try {
            const { caseNotificationsService } = await import("@/lib/cases/notifications");
            await caseNotificationsService.sendCaseTriaged(updated);
          } catch (error) {
            logger.error("Failed to send triage notification", {
              case_id: caseId,
              error: error instanceof Error ? error.message : String(error),
            });
          }

          try {
            const { caseWebhooksService } = await import("@/lib/cases/webhooks");
            await caseWebhooksService.sendWebhook(tenantId, "case.triaged", updated, { triage: triageResult });
          } catch (error) {
            logger.error("Failed to send triage webhook", {
              case_id: caseId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        });

        logger.info("Case triaged", {
          case_id: caseId,
          severity: triageResult.severity,
          priority: triageResult.priority,
          confidence: triageResult.confidence,
        });

        return NextResponse.json({
          success: true,
          triage: triageResult,
        });
      } catch (error) {
        logger.error("Failed to triage case", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to triage case", message: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: 20, // Lower limit for triage operations
      },
    }
  );
  return handler(request);
}
