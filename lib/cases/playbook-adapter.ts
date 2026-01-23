/**
 * Case Playbook Adapter
 * 
 * Bridges Financial Services cases with the playbook execution system.
 * Handles case-specific playbook execution, tracking, and integration.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { PlaybookExecutor, type PlaybookExecutionResult } from "@/lib/playbooks/executor";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { TransactionManager } from "@/lib/operations/transaction-manager";
import type {
  Case,
  CaseType,
  CasePlaybookExecution,
  Playbook,
} from "@prisma/client";

const playbookExecutor = new PlaybookExecutor();
const eventStore = new DatabaseEventStore();
const transactionManager = new TransactionManager();

export interface CasePlaybookInput {
  caseId: string;
  tenantId: string;
  playbookId?: string; // Optional: if not provided, will auto-select
  parameters?: Record<string, unknown>;
  autopilotMode?: "RECOMMEND_ONLY" | "AUTO_DRAFT" | "AUTO_ROUTE" | "AUTO_PUBLISH";
}

export interface CasePlaybookResult {
  executionId: string;
  playbookId: string;
  playbookName: string;
  status: "completed" | "failed" | "pending_approval";
  result?: Record<string, unknown>;
  error?: string;
  approvalId?: string;
  steps?: Array<{ step: string; status: string; result?: unknown }>;
  casePlaybookExecutionId: string;
}

/**
 * Case Playbook Adapter
 * 
 * Manages playbook execution for cases, including:
 * - Auto-selecting appropriate playbooks based on case type
 * - Executing playbooks with case-specific parameters
 * - Tracking playbook executions
 * - Handling playbook results and approvals
 */
export class CasePlaybookAdapter {
  /**
   * Execute playbook for a case
   */
  async executePlaybook(input: CasePlaybookInput): Promise<CasePlaybookResult> {
    const startTime = Date.now();

    try {
      logger.info("Executing playbook for case", {
        caseId: input.caseId,
        playbookId: input.playbookId,
        tenantId: input.tenantId,
      });

      // Get case details
      const case_ = await db.case.findUnique({
        where: { id: input.caseId },
        include: {
          evidence: {
            include: {
              evidence: true,
            },
          },
          resolution: true,
        },
      });

      if (!case_) {
        throw new Error(`Case not found: ${input.caseId}`);
      }

      // Select playbook if not provided
      const playbookId = input.playbookId || (await this.selectPlaybook(case_));

      if (!playbookId) {
        throw new Error(`No playbook found for case type: ${case_.type}`);
      }

      // Get playbook
      const playbook = await db.playbook.findUnique({
        where: { id: playbookId },
      });

      if (!playbook) {
        throw new Error(`Playbook not found: ${playbookId}`);
      }

      // Build playbook parameters from case
      // Type assertion to match the expected signature
      const caseForParams = case_ as Case & {
        evidence?: Array<{ evidenceId: string; evidenceType: string }>;
        resolution?: { customerPlan: unknown; internalPlan: unknown; recommendedDecision?: string | null };
      };
      const parameters = this.buildPlaybookParameters(caseForParams, input.parameters);

      // Determine autopilot mode
      const autopilotMode = input.autopilotMode || playbook.autopilotMode || "AUTO_ROUTE";

      // Execute playbook
      const executionResult = await playbookExecutor.execute(playbookId, {
        ...parameters,
        case_id: input.caseId,
        tenant_id: input.tenantId,
        autopilot_mode: autopilotMode,
      });

      // Record playbook execution
      const casePlaybookExecution = await this.recordExecution(
        input.caseId,
        playbookId,
        executionResult.execution_id,
        executionResult
      );

      // Update case status if playbook completed successfully
      if (executionResult.status === "completed") {
        await this.updateCaseFromPlaybookResult(case_, executionResult);
      }

      const latencyMs = Date.now() - startTime;

      metrics.increment("cases.playbook.executed", {
        case_type: case_.type,
        playbook_id: playbookId,
        status: executionResult.status,
      });
      metrics.observe("cases.playbook.latency", latencyMs);

      logger.info("Playbook execution completed", {
        caseId: input.caseId,
        playbookId,
        executionId: executionResult.execution_id,
        status: executionResult.status,
        latencyMs,
      });

      return {
        executionId: executionResult.execution_id,
        playbookId,
        playbookName: playbook.name,
        status: executionResult.status,
        result: executionResult.result,
        error: executionResult.error,
        approvalId: executionResult.approval_id,
        steps: executionResult.steps,
        casePlaybookExecutionId: casePlaybookExecution.id,
      };
    } catch (error) {
      logger.error("Playbook execution failed", {
        caseId: input.caseId,
        error: error instanceof Error ? error.message : String(error),
      });

      metrics.increment("cases.playbook.failed", {
        case_id: input.caseId,
      });

      throw error;
    }
  }

  /**
   * Select appropriate playbook for a case
   */
  private async selectPlaybook(case_: Case): Promise<string | null> {
    // Map case types to playbook names/patterns
    const playbookMapping: Record<CaseType, string[]> = {
      DISPUTE: ["dispute", "chargeback", "payment_dispute"],
      FRAUD_ATO: ["fraud", "ato", "account_takeover", "security"],
      OUTAGE_DELAY: ["outage", "delay", "incident", "service_disruption"],
      COMPLAINT: ["complaint", "customer_service"],
    };

    const keywords = playbookMapping[case_.type] || [];

    // Find matching playbook
    const playbooks = await db.playbook.findMany({
      where: {
        tenantId: case_.tenantId,
      },
      select: {
        id: true,
        name: true,
        template: true,
      },
    });

    // Match by keywords
    const matched = playbooks.find((p) =>
      keywords.some((kw) => p.name.toLowerCase().includes(kw.toLowerCase()))
    );

    if (matched) {
      return matched.id;
    }

    // Fallback: find any financial services playbook
    const fallback = playbooks.find((p) => p.name.toLowerCase().includes("financial"));
    if (fallback) {
      return fallback.id;
    }

    return null;
  }

  /**
   * Build playbook parameters from case
   */
  private buildPlaybookParameters(
    case_: Case & {
      evidence?: Array<{ evidenceId: string; evidenceType: string }>;
      resolution?: { customerPlan: unknown; internalPlan: unknown; recommendedDecision?: string | null };
    },
    additionalParams?: Record<string, unknown>
  ): Record<string, unknown> {
    const baseParams: Record<string, unknown> = {
      case_id: case_.id,
      case_number: case_.caseNumber,
      case_type: case_.type,
      case_status: case_.status,
      case_severity: case_.severity,
      case_priority: case_.priority,
      description: case_.description,
      impact: case_.impact,
      submitted_by: case_.submittedBy,
      submitted_by_email: case_.submittedByEmail,
      submitted_by_name: case_.submittedByName,
      regulatory_sensitivity: case_.regulatorySensitivity,
      metadata: case_.metadata || {},
    };

    // Add evidence IDs
    const caseWithEvidenceParams = case_ as typeof case_ & {
      evidence?: Array<{ evidenceId: string }>;
    };
    if (caseWithEvidenceParams.evidence && caseWithEvidenceParams.evidence.length > 0) {
      baseParams.evidence_ids = caseWithEvidenceParams.evidence.map((e) => e.evidenceId);
    }

    // Add resolution data if available
    const caseWithResolution = case_ as typeof case_ & {
      resolution?: { customerPlan: unknown; internalPlan: unknown; recommendedDecision?: string | null };
    };
    if (caseWithResolution.resolution) {
      baseParams.customer_plan = caseWithResolution.resolution.customerPlan;
      baseParams.internal_plan = caseWithResolution.resolution.internalPlan;
      if (caseWithResolution.resolution.recommendedDecision) {
        baseParams.recommended_decision = caseWithResolution.resolution.recommendedDecision;
      }
    }

    // Merge additional parameters
    return {
      ...baseParams,
      ...(additionalParams || {}),
    };
  }

  /**
   * Record playbook execution in database
   */
  private async recordExecution(
    caseId: string,
    playbookId: string,
    executionId: string,
    result: PlaybookExecutionResult
  ): Promise<CasePlaybookExecution> {
    return await db.casePlaybookExecution.create({
      data: {
        caseId,
        playbookId,
        executionId,
        result: result as any,
      },
    });
  }

  /**
   * Update case based on playbook execution result
   */
  private async updateCaseFromPlaybookResult(
    case_: Case,
    result: PlaybookExecutionResult
  ): Promise<void> {
    // Update case status if playbook completed
    if (result.status === "completed" && case_.status === "TRIAGED") {
      await db.case.update({
        where: { id: case_.id },
        data: {
          status: "IN_PROGRESS",
        },
      });

      // Record event
      await eventStore.append({
        event_id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        tenant_id: case_.tenantId,
        actor_id: "playbook-executor",
        type: "case.playbook.completed",
        occurred_at: new Date().toISOString(),
        correlation_id: case_.id,
        causation_id: undefined,
        schema_version: "1.0",
        evidence_refs: [],
        payload: {
          executionId: result.execution_id,
          result: result.result,
        },
        signatures: [],
      });
    }

    // Handle approval routing
    if (result.status === "pending_approval" && result.approval_id) {
      await eventStore.append({
        event_id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        tenant_id: case_.tenantId,
        actor_id: "playbook-executor",
        type: "case.playbook.pending_approval",
        occurred_at: new Date().toISOString(),
        correlation_id: case_.id,
        causation_id: undefined,
        schema_version: "1.0",
        evidence_refs: [],
        payload: {
          executionId: result.execution_id,
          approvalId: result.approval_id,
        },
        signatures: [],
      });
    }
  }

  /**
   * Get playbook execution history for a case
   */
  async getExecutionHistory(caseId: string): Promise<CasePlaybookExecution[]> {
    return await db.casePlaybookExecution.findMany({
      where: { caseId },
      include: {
        playbook: {
          select: {
            id: true,
            name: true,
            template: true,
          },
        },
      },
      orderBy: {
        triggeredAt: "desc",
      },
    });
  }

  /**
   * Get recommended playbooks for a case
   */
  async getRecommendedPlaybooks(caseId: string): Promise<Playbook[]> {
    const case_ = await db.case.findUnique({
      where: { id: caseId },
    });

    if (!case_) {
      return [];
    }

    // Get playbooks matching case type
    const playbookMapping: Record<CaseType, string[]> = {
      DISPUTE: ["dispute", "chargeback", "payment"],
      FRAUD_ATO: ["fraud", "ato", "security"],
      OUTAGE_DELAY: ["outage", "delay", "incident"],
      COMPLAINT: ["complaint", "customer"],
    };

    const keywords = playbookMapping[case_.type] || [];

    const playbooks = await db.playbook.findMany({
      where: {
        tenantId: case_.tenantId,
      },
    });

    // Filter and rank by relevance
    const relevant = playbooks.filter((p) =>
      keywords.some((kw) => p.name.toLowerCase().includes(kw.toLowerCase()))
    );

    return relevant;
  }

  /**
   * Check if case has active playbook execution
   */
  async hasActiveExecution(caseId: string): Promise<boolean> {
    const active = await db.casePlaybookExecution.findFirst({
      where: {
        caseId,
        result: {
          path: ["status"],
          not: "completed",
        },
      },
      orderBy: {
        triggeredAt: "desc",
      },
    });

    return active !== null;
  }
}

// Export singleton instance
export const casePlaybookAdapter = new CasePlaybookAdapter();
