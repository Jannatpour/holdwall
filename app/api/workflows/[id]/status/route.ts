/**
 * Workflow Execution Status API
 * Get status of workflow execution
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { workflowEngine } from "@/lib/workflows/engine";
import { createApiHandler } from "@/lib/middleware/api-wrapper";

/**
 * GET /api/workflows/[id]/status - Get workflow execution status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return createApiHandler(async (req) => {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const { id } = await params;
    const execution = await workflowEngine.getExecutionStatus(id, tenantId);

    if (!execution) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(execution);
  })(request);
}
