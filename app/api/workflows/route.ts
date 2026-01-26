/**
 * Universal Workflow Engine API
 * 
 * Handles any workflow, case story, situation, task, status, scenario, change, or update.
 * Maximally flexible and adaptable to any operational edge case.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { workflowEngine } from "@/lib/workflows/engine";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";
import type {
  WorkflowDefinition,
  WorkflowTrigger,
  WorkflowStep,
  WorkflowStatus,
} from "@/lib/workflows/engine";

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  trigger: z.object({
    type: z.enum(["event", "schedule", "manual", "webhook", "api", "condition"]),
    config: z.record(z.string(), z.unknown()),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.enum(["equals", "not_equals", "contains", "greater_than", "less_than", "exists", "matches", "custom"]),
      value: z.unknown(),
      customEvaluator: z.string().optional(),
    })).optional(),
  }),
  steps: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["action", "condition", "parallel", "loop", "delay", "webhook", "ai_generate", "approval", "notification", "data_transform", "integration", "custom"]),
    description: z.string().optional(),
    config: z.record(z.string(), z.unknown()),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.enum(["equals", "not_equals", "contains", "greater_than", "less_than", "exists", "matches", "custom"]),
      value: z.unknown(),
      customEvaluator: z.string().optional(),
    })).optional(),
    onSuccess: z.array(z.string()).optional(),
    onFailure: z.array(z.string()).optional(),
    retryPolicy: z.object({
      maxRetries: z.number().int().min(0).max(10),
      backoffMs: z.number().int().min(100),
    }).optional(),
    timeoutMs: z.number().int().min(1000).optional(),
    parallel: z.boolean().optional(),
  })),
  variables: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const executeWorkflowSchema = z.object({
  workflowId: z.string(),
  input: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /api/workflows - List workflows
 */
export async function GET(request: NextRequest) {
  return createApiHandler(async (req) => {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as WorkflowStatus | null;

    const workflows = await workflowEngine.listWorkflows(tenantId, status || undefined);

    return NextResponse.json({
      workflows,
      count: workflows.length,
    });
  })(request);
}

/**
 * POST /api/workflows - Create workflow definition
 */
export async function POST(request: NextRequest) {
  return createApiHandler(async (req) => {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const body = await req.json();
    const validated = createWorkflowSchema.parse(body);

    const workflow = await workflowEngine.defineWorkflow(tenantId, {
      name: validated.name,
      description: validated.description,
      status: (validated.status || "draft") as WorkflowStatus,
      trigger: validated.trigger as WorkflowTrigger,
      steps: validated.steps as WorkflowStep[],
      variables: validated.variables,
      metadata: validated.metadata,
    });

    logger.info("Workflow created", {
      workflowId: workflow.id,
      tenantId,
      name: workflow.name,
      stepsCount: workflow.steps.length,
    });

    return NextResponse.json(workflow, { status: 201 });
  })(request);
}
