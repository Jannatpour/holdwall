/**
 * Case Playbook Execution API
 * 
 * POST /api/cases/[id]/execute-playbook - Execute playbook for a case
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { casePlaybookAdapter } from "@/lib/cases/playbook-adapter";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const executePlaybookSchema = z.object({
  playbookId: z.string().optional(),
  autopilotMode: z.enum(["RECOMMEND_ONLY", "AUTO_DRAFT", "AUTO_ROUTE", "AUTO_PUBLISH"]).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/cases/[id]/execute-playbook - Execute playbook
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

        const body = await request.json();
        const validated = executePlaybookSchema.parse(body);

        // Execute playbook
        const result = await casePlaybookAdapter.executePlaybook({
          caseId,
          tenantId,
          playbookId: validated.playbookId,
          autopilotMode: validated.autopilotMode,
          parameters: validated.parameters,
        });

        logger.info("Playbook executed for case", {
          case_id: caseId,
          playbook_id: result.playbookId,
          execution_id: result.executionId,
          status: result.status,
        });

        return NextResponse.json({
          success: true,
          result,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Validation error", details: error.issues },
            { status: 400 }
          );
        }

        logger.error("Failed to execute playbook", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to execute playbook", message: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: 20, // Lower limit for playbook execution
      },
    }
  );
  return handler(request);
}
