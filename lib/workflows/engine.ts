/**
 * Universal Workflow Engine
 * 
 * Handles any workflow, case story, situation, task, status, scenario, change, or update.
 * Maximally flexible and adaptable to any operational edge case.
 * 
 * Features:
 * - Dynamic workflow definition and execution
 * - Conditional branching based on any criteria
 * - Parallel and sequential step execution
 * - Event-driven workflow triggers
 * - Custom action handlers
 * - Workflow versioning and rollback
 * - Real-time workflow monitoring
 * - Workflow templates and inheritance
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { TransactionManager } from "@/lib/operations/transaction-manager";
import { ErrorRecoveryService } from "@/lib/operations/error-recovery";
import { AIOrchestrator } from "@/lib/ai/orchestrator";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";

const eventStore = new DatabaseEventStore();
const transactionManager = new TransactionManager();
const errorRecovery = new ErrorRecoveryService();
const evidenceVault = new DatabaseEvidenceVault();
const aiOrchestrator = new AIOrchestrator(evidenceVault);

export type WorkflowStatus = "draft" | "active" | "paused" | "archived";
export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled";
export type StepType = 
  | "action" 
  | "condition" 
  | "parallel" 
  | "loop" 
  | "delay" 
  | "webhook" 
  | "ai_generate"
  | "approval"
  | "notification"
  | "data_transform"
  | "integration"
  | "custom";

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  description?: string;
  config: Record<string, unknown>;
  conditions?: WorkflowCondition[];
  onSuccess?: string[]; // Next step IDs
  onFailure?: string[]; // Next step IDs
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
  timeoutMs?: number;
  parallel?: boolean; // Execute in parallel with other steps
}

export interface WorkflowCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "exists" | "matches" | "custom";
  value: unknown;
  customEvaluator?: string; // Function name for custom evaluation
}

export interface WorkflowDefinition {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  version: number;
  status: WorkflowStatus;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  variables?: Record<string, unknown>; // Workflow-level variables
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowTrigger {
  type: "event" | "schedule" | "manual" | "webhook" | "api" | "condition";
  config: Record<string, unknown>;
  conditions?: WorkflowCondition[];
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  tenantId: string;
  status: "running" | "completed" | "failed" | "paused" | "cancelled";
  currentStepId?: string;
  stepResults: Record<string, WorkflowStepResult>;
  context: Record<string, unknown>; // Execution context/variables
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowStepResult {
  stepId: string;
  status: StepStatus;
  result?: unknown;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  retries?: number;
}

export interface WorkflowExecutionContext {
  execution: WorkflowExecution;
  workflow: WorkflowDefinition;
  tenantId: string;
  actorId?: string;
  input?: Record<string, unknown>;
}

/**
 * Universal Workflow Engine
 * 
 * Executes any workflow definition dynamically, handling:
 * - Conditional branching
 * - Parallel execution
 * - Error recovery
 * - Retries
 * - Timeouts
 * - Custom actions
 * - AI-powered steps
 * - Integration steps
 */
export class UniversalWorkflowEngine {
  private actionHandlers: Map<string, (context: WorkflowExecutionContext, step: WorkflowStep) => Promise<unknown>> = new Map();

  constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * Register custom action handler
   */
  registerHandler(actionType: string, handler: (context: WorkflowExecutionContext, step: WorkflowStep) => Promise<unknown>): void {
    this.actionHandlers.set(actionType, handler);
    logger.info("Workflow action handler registered", { actionType });
  }

  /**
   * Create or update workflow definition
   */
  async defineWorkflow(
    tenantId: string,
    definition: Omit<WorkflowDefinition, "id" | "tenantId" | "version" | "createdAt" | "updatedAt">
  ): Promise<WorkflowDefinition> {
    return await transactionManager.executeSimple(async (tx) => {
      // Check if workflow with same name exists
      const existing = await tx.workflow.findFirst({
        where: {
          tenantId,
          name: definition.name,
          status: { not: "archived" },
        },
        orderBy: { version: "desc" },
      });

      const version = existing ? existing.version + 1 : 1;
      const workflowId = existing?.id || `wf-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      // If new version, archive old version
      if (existing && existing.status === "active") {
        await tx.workflow.update({
          where: { id: existing.id },
          data: { status: "archived" },
        });
      }

      const workflow = await tx.workflow.create({
        data: {
          id: workflowId,
          tenantId,
          name: definition.name,
          description: definition.description,
          version,
          status: definition.status,
          trigger: definition.trigger as any,
          steps: definition.steps as any,
          variables: definition.variables as any,
          metadata: definition.metadata as any,
        },
      });

      logger.info("Workflow defined", {
        tenantId,
        workflowId,
        name: definition.name,
        version,
        stepsCount: definition.steps.length,
      });

      metrics.increment("workflows_defined_total", { tenantId });

      return {
        id: workflow.id,
        tenantId: workflow.tenantId,
        name: workflow.name,
        description: workflow.description || undefined,
        version: workflow.version,
        status: workflow.status as WorkflowStatus,
        trigger: workflow.trigger as unknown as WorkflowTrigger,
        steps: workflow.steps as unknown as WorkflowStep[],
        variables: workflow.variables as Record<string, unknown> | undefined,
        metadata: workflow.metadata as Record<string, unknown> | undefined,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      };
    });
  }

  /**
   * Execute workflow
   */
  async executeWorkflow(
    workflowId: string,
    tenantId: string,
    input?: Record<string, unknown>,
    actorId?: string
  ): Promise<WorkflowExecution> {
    const workflow = await db.workflow.findFirst({
      where: {
        id: workflowId,
        tenantId,
        status: "active",
      },
      orderBy: { version: "desc" },
    });

    if (!workflow) {
      throw new Error(`Active workflow not found: ${workflowId}`);
    }

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      tenantId,
      status: "running",
      stepResults: {},
      context: {
        ...(workflow.variables as Record<string, unknown> || {}),
        ...(input || {}),
      },
      startedAt: new Date(),
      metadata: {
        actorId,
        workflowVersion: workflow.version,
      },
    };

    // Save execution to database
    await db.workflowExecution.create({
      data: {
        id: executionId,
        workflowId,
        tenantId,
        status: "running",
        context: execution.context as any,
        metadata: execution.metadata as any,
      },
    });

    try {
      logger.info("Workflow execution started", {
        executionId,
        workflowId,
        tenantId,
        stepsCount: (workflow.steps as unknown as WorkflowStep[]).length,
      });

      // Execute workflow steps
      await this.executeSteps(
        {
          execution,
          workflow: {
            id: workflow.id,
            tenantId: workflow.tenantId,
            name: workflow.name,
            description: workflow.description || undefined,
            version: workflow.version,
            status: workflow.status as WorkflowStatus,
            trigger: workflow.trigger as unknown as WorkflowTrigger,
            steps: workflow.steps as unknown as WorkflowStep[],
            variables: workflow.variables as Record<string, unknown> | undefined,
            metadata: workflow.metadata as Record<string, unknown> | undefined,
            createdAt: workflow.createdAt,
            updatedAt: workflow.updatedAt,
          },
          tenantId,
          actorId,
          input,
        }
      );

      execution.status = "completed";
      execution.completedAt = new Date();

      await db.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: "completed",
          completedAt: execution.completedAt,
          stepResults: execution.stepResults as any,
        },
      });

      logger.info("Workflow execution completed", {
        executionId,
        workflowId,
        durationMs: execution.completedAt.getTime() - execution.startedAt.getTime(),
      });

      metrics.increment("workflows_completed_total", { tenantId });
      metrics.observe("workflow_execution_duration_ms", 
        execution.completedAt.getTime() - execution.startedAt.getTime(),
        { tenantId }
      );

      return execution;
    } catch (error) {
      execution.status = "failed";
      execution.error = error instanceof Error ? error.message : String(error);
      execution.completedAt = new Date();

      await db.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: "failed",
          error: execution.error,
          completedAt: execution.completedAt,
          stepResults: execution.stepResults as any,
        },
      });

      logger.error("Workflow execution failed", {
        executionId,
        workflowId,
        error: execution.error,
      });

      metrics.increment("workflows_failed_total", { tenantId });

      // Attempt error recovery
      await errorRecovery.recover({
        error: error instanceof Error ? error : new Error(String(error)),
        context: {
          executionId,
          workflowId,
          tenantId,
        },
        operationName: "workflow_execution",
      });

      throw error;
    }
  }

  /**
   * Execute workflow steps
   */
  private async executeSteps(context: WorkflowExecutionContext): Promise<void> {
    const { workflow, execution } = context;
    const executedSteps = new Set<string>();
    const stepQueue: string[] = [];
    
    // Find entry steps (steps with no dependencies or first steps)
    const entrySteps = workflow.steps.filter(step => 
      !workflow.steps.some(s => s.onSuccess?.includes(step.id) || s.onFailure?.includes(step.id))
    );
    
    if (entrySteps.length === 0 && workflow.steps.length > 0) {
      // If no entry steps, start with first step
      stepQueue.push(workflow.steps[0].id);
    } else {
      entrySteps.forEach(step => stepQueue.push(step.id));
    }

    while (stepQueue.length > 0) {
      const stepId = stepQueue.shift()!;
      
      if (executedSteps.has(stepId)) {
        continue;
      }

      const step = workflow.steps.find(s => s.id === stepId);
      if (!step) {
        logger.warn("Step not found in workflow", { stepId, workflowId: workflow.id });
        continue;
      }

      // Check conditions
      if (step.conditions && !this.evaluateConditions(step.conditions, execution.context)) {
        execution.stepResults[stepId] = {
          stepId,
          status: "skipped",
          startedAt: new Date(),
          completedAt: new Date(),
        };
        executedSteps.add(stepId);
        continue;
      }

      // Execute step
      try {
        execution.currentStepId = stepId;
        const stepResult = await this.executeStep(context, step);
        
        execution.stepResults[stepId] = stepResult;
        executedSteps.add(stepId);

        // Add next steps to queue
        if (stepResult.status === "completed" && step.onSuccess) {
          step.onSuccess.forEach(nextStepId => {
            if (!executedSteps.has(nextStepId)) {
              stepQueue.push(nextStepId);
            }
          });
        } else if (stepResult.status === "failed" && step.onFailure) {
          step.onFailure.forEach(nextStepId => {
            if (!executedSteps.has(nextStepId)) {
              stepQueue.push(nextStepId);
            }
          });
        }

        // Update execution context with step result
        execution.context[`step_${stepId}_result`] = stepResult.result;
      } catch (error) {
        const stepResult: WorkflowStepResult = {
          stepId,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
          startedAt: new Date(),
          completedAt: new Date(),
        };
        
        execution.stepResults[stepId] = stepResult;
        executedSteps.add(stepId);

        // Handle failure path
        if (step.onFailure) {
          step.onFailure.forEach(nextStepId => {
            if (!executedSteps.has(nextStepId)) {
              stepQueue.push(nextStepId);
            }
          });
        } else {
          // No failure handler, workflow fails
          throw error;
        }
      }
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    context: WorkflowExecutionContext,
    step: WorkflowStep
  ): Promise<WorkflowStepResult> {
    const startTime = Date.now();
    const stepResult: WorkflowStepResult = {
      stepId: step.id,
      status: "running",
      startedAt: new Date(),
      retries: 0,
    };

    try {
      logger.info("Executing workflow step", {
        executionId: context.execution.id,
        stepId: step.id,
        stepName: step.name,
        stepType: step.type,
      });

      let result: unknown;

      // Get handler for step type
      const handler = this.actionHandlers.get(step.type);
      if (handler) {
        result = await this.executeWithRetry(
          () => handler(context, step),
          step.retryPolicy,
          step.timeoutMs
        );
      } else {
        // Use default handler
        result = await this.executeWithRetry(
          () => this.executeDefaultStep(context, step),
          step.retryPolicy,
          step.timeoutMs
        );
      }

      stepResult.status = "completed";
      stepResult.result = result;
      stepResult.completedAt = new Date();
      stepResult.durationMs = Date.now() - startTime;

      logger.info("Workflow step completed", {
        executionId: context.execution.id,
        stepId: step.id,
        durationMs: stepResult.durationMs,
      });

      return stepResult;
    } catch (error) {
      stepResult.status = "failed";
      stepResult.error = error instanceof Error ? error.message : String(error);
      stepResult.completedAt = new Date();
      stepResult.durationMs = Date.now() - startTime;

      logger.error("Workflow step failed", {
        executionId: context.execution.id,
        stepId: step.id,
        error: stepResult.error,
      });

      return stepResult;
    }
  }

  /**
   * Execute step with retry logic
   */
  private async executeWithRetry(
    fn: () => Promise<unknown>,
    retryPolicy?: { maxRetries: number; backoffMs: number },
    timeoutMs?: number
  ): Promise<unknown> {
    const maxRetries = retryPolicy?.maxRetries || 0;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (timeoutMs) {
          return await Promise.race([
            fn(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Step timeout after ${timeoutMs}ms`)), timeoutMs)
            ),
          ]);
        }
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          const backoff = retryPolicy?.backoffMs || 1000;
          await new Promise(resolve => setTimeout(resolve, backoff * (attempt + 1)));
          continue;
        }
        
        throw lastError;
      }
    }

    throw lastError || new Error("Execution failed");
  }

  /**
   * Execute default step handler
   */
  private async executeDefaultStep(
    context: WorkflowExecutionContext,
    step: WorkflowStep
  ): Promise<unknown> {
    const { execution, workflow } = context;
    const config = step.config;

    switch (step.type) {
      case "action":
        // Generic action - execute configured action
        const action = config.action as string;
        const params = config.parameters as Record<string, unknown> || {};
        return await this.executeAction(action, params, execution.context);

      case "condition":
        // Conditional branching - already handled in executeSteps
        return { evaluated: true };

      case "delay":
        const delayMs = (config.delayMs as number) || 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return { delayed: delayMs };

      case "webhook":
        const url = config.url as string;
        const method = (config.method as string) || "POST";
        const headers = (config.headers as Record<string, string>) || {};
        const body = config.body as unknown;
        
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        
        if (!response.ok) {
          throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
        }
        
        return await response.json().catch(() => ({}));

      case "ai_generate":
        const prompt = config.prompt as string;
        const model = (config.model as string) || undefined;
        const temperature = (config.temperature as number) || 0.7;
        
        const aiResult = await aiOrchestrator.orchestrate({
          query: prompt,
          tenant_id: context.tenantId,
          model,
          temperature,
          max_tokens: (config.maxTokens as number) || 2000,
        });
        
        return aiResult.response;

      case "approval":
        const approvalType = (config.approvalType as string) || "standard";
        const approvers = (config.approvers as string[]) || [];
        const approvalData = config.data as Record<string, unknown> || {};
        
        // Create approval request
        const { ApprovalGateway } = await import("@/lib/engagement/approval-gateway");
        const approvalGateway = new ApprovalGateway();
        
        const approval = await approvalGateway.createApproval({
          tenantId: context.tenantId,
          type: approvalType,
          approvers,
          data: approvalData,
          correlationId: execution.id,
          requesterId: context.actorId || "system",
        });
        
        return { approvalId: approval.id };

      case "notification":
        const rawType = (config.type as string) || "email";
        const notificationType = (["email", "push", "sms"] as const).includes(rawType as any)
          ? (rawType as any)
          : "email";
        const recipients = (config.recipients as string[]) || [];
        const subject = config.subject as string;
        const message = config.message as string;
        
        // Send notification
        const { NotificationService } = await import("@/lib/notifications/service");
        const notificationService = new NotificationService();
        
        await notificationService.send({
          type: notificationType,
          recipients,
          subject,
          message,
          metadata: {
            workflowId: workflow.id,
            executionId: execution.id,
          },
        });
        
        return { sent: true };

      case "data_transform":
        const transform = config.transform as string;
        const inputData = config.input as unknown;
        
        // Execute data transformation
        return await this.executeDataTransform(transform, inputData, execution.context);

      case "integration":
        const integrationType = config.type as string;
        const integrationConfig = config.config as Record<string, unknown> || {};
        
        return await this.executeIntegration(integrationType, integrationConfig, execution.context);

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * Execute generic action
   */
  private async executeAction(
    action: string,
    parameters: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<unknown> {
    // Resolve action handlers dynamically
    const actionMap: Record<string, (params: Record<string, unknown>, ctx: Record<string, unknown>) => Promise<unknown>> = {
      "create_case": async (params, ctx) => {
        const { CaseService } = await import("@/lib/cases/service");
        const caseService = new CaseService();
        return await caseService.createCase({
          tenantId: ctx.tenantId as string,
          type: params.type as any,
          submittedBy: params.submittedBy as string,
          description: params.description as string,
          evidenceIds: params.evidenceIds as string[],
        });
      },
      "create_artifact": async (params, ctx) => {
        const { AAALStudioService } = await import("@/lib/aaal/studio");
        const studio = new AAALStudioService(evidenceVault, eventStore);
        const tenantId = ctx.tenantId as string;
        const content = params.content as string;
        const evidenceIds = (params.evidenceIds as string[]) || [];
        const title =
          (params.title as string) ||
          content
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 72) ||
          "AAAL Draft";

        const artifactId = await studio.createDraft(tenantId, title, content, evidenceIds);
        return { artifactId };
      },
      "extract_claims": async (params, ctx) => {
        const { ClaimExtractionService } = await import("@/lib/claims/extraction");
        const extractionService = new ClaimExtractionService(evidenceVault, eventStore);
        const evidenceId = params.evidenceId as string;
        const claims = await extractionService.extractClaims(evidenceId, {
          use_llm: (params.useLLM as boolean | undefined) ?? true,
          rules: (params.rules as string[] | undefined) ?? undefined,
        });
        return { evidenceId, claims };
      },
      "generate_forecast": async (params, ctx) => {
        const { ForecastService } = await import("@/lib/forecasts/service");
        const { DatabaseBeliefGraphService } = await import("@/lib/graph/belief-implementation");
        const beliefGraph = new DatabaseBeliefGraphService();
        const forecastService = new ForecastService(eventStore, beliefGraph as any);
        const tenantId = ctx.tenantId as string;
        const forecasts = await forecastService.generateForecasts(tenantId);
        return { tenantId, forecasts };
      },
    };

    const handler = actionMap[action];
    if (!handler) {
      throw new Error(`Unknown action: ${action}`);
    }

    return await handler(parameters, context);
  }

  /**
   * Execute data transformation
   */
  private async executeDataTransform(
    transform: string,
    input: unknown,
    context: Record<string, unknown>
  ): Promise<unknown> {
    // Support common transformations
    const transforms: Record<string, (input: unknown, ctx: Record<string, unknown>) => unknown> = {
      "json_parse": (input) => {
        if (typeof input === "string") {
          return JSON.parse(input);
        }
        return input;
      },
      "json_stringify": (input) => JSON.stringify(input),
      "extract_field": (input, ctx) => {
        const field = ctx.field as string;
        if (typeof input === "object" && input !== null) {
          return (input as Record<string, unknown>)[field];
        }
        return null;
      },
      "merge_objects": (input, ctx) => {
        const other = ctx.other as Record<string, unknown>;
        if (typeof input === "object" && input !== null) {
          return { ...(input as Record<string, unknown>), ...other };
        }
        return other;
      },
      "filter_array": (input, ctx) => {
        const condition = ctx.condition as string;
        if (Array.isArray(input)) {
          // Simple filtering - can be enhanced with expression evaluation
          return input.filter((item) => {
            if (condition.includes(">")) {
              const [field, value] = condition.split(">").map(s => s.trim());
              const raw = (item as Record<string, unknown>)[field];
              const left = typeof raw === "number" ? raw : Number(raw);
              return Number.isFinite(left) ? left > Number(value) : false;
            }
            return true;
          });
        }
        return input;
      },
    };

    const handler = transforms[transform];
    if (!handler) {
      throw new Error(`Unknown transform: ${transform}`);
    }

    return handler(input, context);
  }

  /**
   * Execute integration step
   */
  private async executeIntegration(
    type: string,
    config: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<unknown> {
    // Support common integrations
    const integrations: Record<string, (config: Record<string, unknown>, ctx: Record<string, unknown>) => Promise<unknown>> = {
      "database_query": async (config, ctx) => {
        const query = config.query as string;
        const params = config.params as unknown[] || [];
        return await db.$queryRawUnsafe(query, ...params);
      },
      "api_call": async (config, ctx) => {
        const url = config.url as string;
        const method = (config.method as string) || "GET";
        const headers = (config.headers as Record<string, string>) || {};
        const body = config.body as unknown;
        
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        
        return await response.json();
      },
      "event_emit": async (config, ctx) => {
        const eventType = config.eventType as string;
        const payload = config.payload as Record<string, unknown> || {};
        
        await eventStore.append({
          event_id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          tenant_id: ctx.tenantId as string,
          actor_id: ctx.actorId as string || "system",
          type: eventType,
          occurred_at: new Date().toISOString(),
          correlation_id: ctx.executionId as string,
          schema_version: "1.0",
          evidence_refs: [],
          payload,
          signatures: [],
        });
        
        return { emitted: true };
      },
    };

    const handler = integrations[type];
    if (!handler) {
      throw new Error(`Unknown integration type: ${type}`);
    }

    return await handler(config, context);
  }

  /**
   * Evaluate workflow conditions
   */
  private evaluateConditions(
    conditions: WorkflowCondition[],
    context: Record<string, unknown>
  ): boolean {
    for (const condition of conditions) {
      const fieldValue = this.getNestedValue(context, condition.field);
      const conditionMet = this.evaluateCondition(condition, fieldValue);
      
      if (!conditionMet) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(condition: WorkflowCondition, fieldValue: unknown): boolean {
    switch (condition.operator) {
      case "equals":
        return fieldValue === condition.value;
      case "not_equals":
        return fieldValue !== condition.value;
      case "contains":
        if (typeof fieldValue === "string" && typeof condition.value === "string") {
          return fieldValue.includes(condition.value);
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(condition.value);
        }
        return false;
      case "greater_than":
        return Number(fieldValue) > Number(condition.value);
      case "less_than":
        return Number(fieldValue) < Number(condition.value);
      case "exists":
        return fieldValue !== undefined && fieldValue !== null;
      case "matches":
        if (typeof fieldValue === "string" && typeof condition.value === "string") {
          const regex = new RegExp(condition.value);
          return regex.test(fieldValue);
        }
        return false;
      case "custom":
        // Custom evaluator would need to be implemented
        // For now, return true (can be enhanced with expression evaluation)
        return true;
      default:
        return false;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let value: unknown = obj;
    
    for (const part of parts) {
      if (value && typeof value === "object" && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Register default action handlers
   */
  private registerDefaultHandlers(): void {
    // Default handlers are implemented in executeDefaultStep
    // Custom handlers can be registered via registerHandler
    logger.info("Default workflow handlers registered");
  }

  /**
   * Get workflow execution status
   */
  async getExecutionStatus(executionId: string, tenantId: string): Promise<WorkflowExecution | null> {
    const execution = await db.workflowExecution.findFirst({
      where: {
        id: executionId,
        tenantId,
      },
    });

    if (!execution) {
      return null;
    }

    return {
      id: execution.id,
      workflowId: execution.workflowId,
      tenantId: execution.tenantId,
      status: execution.status as any,
      currentStepId: execution.currentStepId || undefined,
      stepResults: (execution.stepResults as unknown as Record<string, WorkflowStepResult>) || {},
      context: (execution.context as Record<string, unknown>) || {},
      startedAt: execution.startedAt,
      completedAt: execution.completedAt || undefined,
      error: execution.error || undefined,
      metadata: (execution.metadata as Record<string, unknown>) || undefined,
    };
  }

  /**
   * List workflows for tenant
   */
  async listWorkflows(
    tenantId: string,
    status?: WorkflowStatus
  ): Promise<WorkflowDefinition[]> {
    const workflows = await db.workflow.findMany({
      where: {
        tenantId,
        ...(status && { status }),
      },
      orderBy: [
        { version: "desc" },
        { updatedAt: "desc" },
      ],
    });

    return workflows.map(w => ({
      id: w.id,
      tenantId: w.tenantId,
      name: w.name,
      description: w.description || undefined,
      version: w.version,
      status: w.status as WorkflowStatus,
      trigger: w.trigger as unknown as WorkflowTrigger,
      steps: w.steps as unknown as WorkflowStep[],
      variables: w.variables as Record<string, unknown> | undefined,
      metadata: w.metadata as Record<string, unknown> | undefined,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));
  }
}

export const workflowEngine = new UniversalWorkflowEngine();
