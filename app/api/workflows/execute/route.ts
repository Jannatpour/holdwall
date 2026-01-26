/**
 * Workflow Execution API
 * Execute workflows dynamically
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { workflowEngine } from "@/lib/workflows/engine";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const executeWorkflowSchema = z.object({
  workflowId: z.string(),
  input: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/workflows/execute - Execute workflow
 */
export async function POST(request: NextRequest) {
  return createApiHandler(async (req) => {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";
    const actorId = (user as any).id || "";

    const body = await req.json();
    const validated = executeWorkflowSchema.parse(body);

    const execution = await workflowEngine.executeWorkflow(
      validated.workflowId,
      tenantId,
      validated.input,
      actorId
    );

    logger.info("Workflow executed", {
      executionId: execution.id,
      workflowId: validated.workflowId,
      tenantId,
      status: execution.status,
    });

    return NextResponse.json(execution, { status: 200 });
  })(request);
}
