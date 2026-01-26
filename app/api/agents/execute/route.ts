/**
 * Agent Execution API
 * 
 * Executes agent tasks with proper authentication, validation, and error handling
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { AgentOrchestrator } from "@/lib/agents/orchestrator";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";
import crypto from "crypto";

const orchestrator = new AgentOrchestrator();

const executeTaskSchema = z.object({
  task_type: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()),
  priority: z.number().min(0).max(10).optional(),
  deadline: z.string().datetime().optional(),
});

export const POST = createApiHandler(
  async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
    try {
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

      logger.info("Executing agent task", {
        task_id: task.task_id,
        task_type: task.task_type,
        tenant_id: task.tenant_id,
        actor_id: task.actor_id,
      });

      const result = await orchestrator.executeTask(task);

      logger.info("Agent task completed", {
        task_id: task.task_id,
        task_type: task.task_type,
        success: true,
      });

      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation error", details: error.issues },
          { status: 400 }
        );
      }

      logger.error("Agent execution error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 }
      );
    }
  },
  {
    requireAuth: true,
    rateLimit: {
      windowMs: 60 * 1000,
      maxRequests: 20, // Stricter limit for agent execution
    },
  }
);
