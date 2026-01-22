/**
 * Agent Execution API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { AgentOrchestrator } from "@/lib/agents/orchestrator";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const orchestrator = new AgentOrchestrator();

const executeTaskSchema = z.object({
  task_type: z.string(),
  parameters: z.record(z.string(), z.unknown()),
  priority: z.number().min(0).max(10).optional(),
  deadline: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const validated = executeTaskSchema.parse(body);

    const task = {
      task_id: crypto.randomUUID(),
      task_type: validated.task_type,
      parameters: validated.parameters,
      priority: validated.priority || 5,
      deadline: validated.deadline,
    };

    const result = await orchestrator.executeTask(task);

    return NextResponse.json(result);
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
    logger.error("Error executing agent task", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
