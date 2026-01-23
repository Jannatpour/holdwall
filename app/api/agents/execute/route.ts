/**
 * Agent Execution API
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { AgentOrchestrator } from "@/lib/agents/orchestrator";
import { z } from "zod";
import crypto from "crypto";

const orchestrator = new AgentOrchestrator();

const executeTaskSchema = z.object({
  task_type: z.string(),
  parameters: z.record(z.string(), z.unknown()),
  priority: z.number().min(0).max(10).optional(),
  deadline: z.string().datetime().optional(),
});

export const POST = createApiHandler(
  async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
    const user = context?.user;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = executeTaskSchema.parse(body);

    const task = {
      task_id: crypto.randomUUID(),
      task_type: validated.task_type,
      parameters: validated.parameters,
      priority: validated.priority || 5,
      deadline: validated.deadline,
      tenant_id: context?.tenantId || (user as any).tenantId || "default",
      actor_id: (user as any).id,
    };

    const result = await orchestrator.executeTask(task);

    return NextResponse.json(result);
  },
  {
    requireAuth: true,
    rateLimit: {
      windowMs: 60 * 1000,
      maxRequests: 20, // Stricter limit for agent execution
    },
  }
);
