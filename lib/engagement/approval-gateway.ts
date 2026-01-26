/**
 * Approval Gateway
 * 
 * Human-gated approval system for autonomous operations.
 * Routes critical actions through approval workflows with multi-step support,
 * break-glass procedures, and workspace scoping.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import type { AuditEntry } from "@/lib/audit/lineage";
import { randomUUID } from "crypto";

export interface ApprovalRequest {
  resourceType: string;
  resourceId: string;
  action: string;
  content: string;
  context?: Record<string, unknown>;
  priority?: "low" | "medium" | "high" | "critical";
  requesterId?: string;
  workspaceId?: string;
  workflowId?: string;
}

export interface Approval {
  id: string;
  request: ApprovalRequest;
  status: "pending" | "approved" | "rejected";
  decision?: "approved" | "rejected";
  approverId?: string;
  reason?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface ApprovalPolicy {
  resourceType: string;
  action: string;
  requiresApproval: boolean;
  autoApproveConditions?: {
    confidence?: number;
    riskLevel?: "low" | "medium" | "high";
    contentLength?: number;
  };
  approvers?: string[]; // User IDs or roles
}

export class ApprovalGateway {
  private policies: Map<string, ApprovalPolicy> = new Map();
  private auditLog: DatabaseAuditLog;

  constructor() {
    this.auditLog = new DatabaseAuditLog();
    this.createDefaultPolicies();
  }

  /**
   * Create default approval policies
   */
  private createDefaultPolicies(): void {
    // Low-risk responses can auto-approve
    this.policies.set("forum_response:low", {
      resourceType: "forum_response",
      action: "publish",
      requiresApproval: false,
      autoApproveConditions: {
        confidence: 0.8,
        riskLevel: "low",
      },
    });

    // High-risk responses require approval
    this.policies.set("crisis_response:high", {
      resourceType: "crisis_response",
      action: "publish",
      requiresApproval: true,
      approvers: ["admin", "legal"],
    });

    // Comments require approval by default
    this.policies.set("comment:publish", {
      resourceType: "comment",
      action: "publish",
      requiresApproval: true,
    });

    // Social media posts require approval
    this.policies.set("social_post:publish", {
      resourceType: "social_post",
      action: "publish",
      requiresApproval: true,
    });
  }

  /**
   * Register approval policy
   */
  registerPolicy(policy: ApprovalPolicy): void {
    const key = `${policy.resourceType}:${policy.action}`;
    this.policies.set(key, policy);
  }

  /**
   * Create an approval record directly (explicit approvers)
   *
   * This is intended for internal systems (workflows, automation) that already
   * computed approvers and want a durable, human-gated record regardless of policy defaults.
   */
  async createApproval(input: {
    tenantId: string;
    type: string;
    approvers: string[];
    data: Record<string, unknown>;
    correlationId: string;
    requesterId?: string;
    workspaceId?: string;
    priority?: "low" | "medium" | "high" | "critical";
  }): Promise<Approval> {
    const resourceType = "workflow";
    const resourceId = input.correlationId;
    const action = input.type;

    const approval = await db.approval.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId || undefined,
        resourceType,
        resourceId,
        action,
        requesterId: input.requesterId || "system",
        approvers: input.approvers || [],
        decision: null,
        approverId: null,
        reason: null,
        currentStep: 0,
        totalSteps: 1,
      },
    });

    // Audit log (best-effort)
    try {
      const entry: AuditEntry = {
        audit_id: randomUUID(),
        timestamp: new Date().toISOString(),
        type: "approval",
        tenant_id: input.tenantId,
        actor_id: input.requesterId || "system",
        correlation_id: input.correlationId,
        causation_id: undefined,
        evidence_refs: [],
        data: {
          approval_id: approval.id,
          resource_type: resourceType,
          resource_id: resourceId,
          action,
          decision: "approved", // creation event (separate from approval decision workflow)
          approver_id: "",
          reason: undefined,
        },
      };
      await this.auditLog.append(entry);
    } catch (error) {
      logger.warn("Failed to write approval audit log", {
        tenantId: input.tenantId,
        approvalId: approval.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return this.mapToApproval(approval);
  }

  /**
   * Request approval with multi-step workflow support
   */
  async requestApproval(
    request: ApprovalRequest,
    tenantId: string
  ): Promise<Approval> {
    try {
      // Check if approval is required
      const policy = this.getPolicy(request.resourceType, request.action);

      if (!policy || !policy.requiresApproval) {
        // Check auto-approve conditions
        if (policy?.autoApproveConditions) {
          const canAutoApprove = await this.checkAutoApproveConditions(
            request,
            policy.autoApproveConditions
          );

          if (canAutoApprove) {
            // Create auto-approved approval record
            const approval = await db.approval.create({
              data: {
                tenantId,
                workspaceId: request.workspaceId || undefined,
                resourceType: request.resourceType,
                resourceId: request.resourceId,
                action: request.action,
                requesterId: request.requesterId || "system",
                approvers: [],
                decision: "APPROVED",
                approverId: "system",
                reason: "Auto-approved based on policy",
                currentStep: 0,
                totalSteps: 1,
                decidedAt: new Date(),
              },
            });

            return this.mapToApproval(approval);
          }
        } else {
          // No policy means auto-approve
          const approval = await db.approval.create({
            data: {
              tenantId,
              workspaceId: request.workspaceId || undefined,
              resourceType: request.resourceType,
              resourceId: request.resourceId,
              action: request.action,
              requesterId: request.requesterId || "system",
              approvers: [],
              decision: "APPROVED",
              approverId: "system",
              reason: "No approval required",
              currentStep: 0,
              totalSteps: 1,
              decidedAt: new Date(),
            },
          });

          return this.mapToApproval(approval);
        }
      }

      // Get workflow or create default
      let workflowId: string | undefined;
      let totalSteps = 1;
      let approvers: string[] = policy.approvers || [];

      if (request.workflowId) {
        workflowId = request.workflowId;
        const workflow = await db.approvalWorkflow.findUnique({
          where: { id: request.workflowId },
        });
        if (workflow) {
          const steps = (workflow.steps as any[]) || [];
          totalSteps = steps.length;
          approvers = steps.map((s) => s.approverId || s.approverRole || "").filter(Boolean);
        }
      } else {
        // Create default single-step workflow
        approvers = policy.approvers || await this.getDefaultApprovers(tenantId, request.workspaceId);
      }

      // Create approval
      const approval = await db.approval.create({
        data: {
          tenantId,
          workspaceId: request.workspaceId || undefined,
          resourceType: request.resourceType,
          resourceId: request.resourceId,
          action: request.action,
          requesterId: request.requesterId || "system",
          approvers,
          workflowId: workflowId || undefined,
          currentStep: 0,
          totalSteps,
        },
      });

      // Create approval steps if multi-step
      if (totalSteps > 1 && request.workflowId) {
        const workflow = await db.approvalWorkflow.findUnique({
          where: { id: request.workflowId },
        });
        if (workflow) {
          const steps = (workflow.steps as any[]) || [];
          for (let i = 0; i < steps.length; i++) {
            await db.approvalStep.create({
              data: {
                approvalId: approval.id,
                stepNumber: i + 1,
                approverId: steps[i].approverId || "",
                approverRole: steps[i].approverRole || undefined,
                status: i === 0 ? "PENDING" : "PENDING",
              },
            });
          }
        }
      } else {
        // Single-step approval
        await db.approvalStep.create({
          data: {
            approvalId: approval.id,
            stepNumber: 1,
            approverId: approvers[0] || "",
            status: "PENDING",
          },
        });
      }

      // Audit log
      await this.auditLog.append({
        audit_id: randomUUID(),
        tenant_id: tenantId,
        actor_id: request.requesterId || "system",
        type: "event",
        timestamp: new Date().toISOString(),
        correlation_id: randomUUID(),
        data: {
          event_id: randomUUID(),
          tenant_id: tenantId,
          actor_id: request.requesterId || "system",
          type: "approval.requested",
          occurred_at: new Date().toISOString(),
          correlation_id: randomUUID(),
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            approval_id: approval.id,
            resource_type: request.resourceType,
            resource_id: request.resourceId,
            action: request.action,
            total_steps: totalSteps,
          },
          signatures: [],
        } as any,
        evidence_refs: [],
      });

      logger.info("Approval requested", {
        approval_id: approval.id,
        resource_type: request.resourceType,
        resource_id: request.resourceId,
        tenant_id: tenantId,
        total_steps: totalSteps,
      });

      return this.mapToApproval(approval);
    } catch (error) {
      logger.error("Failed to request approval", {
        error: error instanceof Error ? error.message : String(error),
        resource_type: request.resourceType,
        resource_id: request.resourceId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Get policy for resource type and action
   */
  private getPolicy(resourceType: string, action: string): ApprovalPolicy | null {
    const key = `${resourceType}:${action}`;
    return this.policies.get(key) || null;
  }

  /**
   * Check auto-approve conditions
   */
  private async checkAutoApproveConditions(
    request: ApprovalRequest,
    conditions: NonNullable<ApprovalPolicy["autoApproveConditions"]>
  ): Promise<boolean> {
    // Check confidence (calculated from content analysis)
    if (conditions.confidence !== undefined) {
      // Calculate confidence from content analysis
      const calculatedConfidence = await this.calculateConfidence(request);
      if (calculatedConfidence < conditions.confidence) {
        return false;
      }
    }

    // Check risk level
    if (conditions.riskLevel) {
      const requestRisk = request.priority === "critical" ? "high" :
                         request.priority === "high" ? "medium" : "low";
      
      const riskLevels = { low: 0, medium: 1, high: 2 };
      if (riskLevels[requestRisk] >= riskLevels[conditions.riskLevel]) {
        return false;
      }
    }

    // Check content length
    if (conditions.contentLength !== undefined) {
      if (request.content.length > conditions.contentLength) {
        return false;
      }
    }

    return true;
  }

  /**
   * Approve step in multi-step workflow
   */
  async approveStep(
    approvalId: string,
    stepNumber: number,
    approverId: string,
    tenantId: string,
    reason?: string
  ): Promise<Approval> {
    try {
      const approval = await db.approval.findUnique({
        where: { id: approvalId },
        include: { steps: { orderBy: { stepNumber: "asc" } } },
      });

      if (!approval || approval.tenantId !== tenantId) {
        throw new Error("Approval not found or tenant mismatch");
      }

      // Find step
      const step = approval.steps.find((s) => s.stepNumber === stepNumber);
      if (!step) {
        throw new Error(`Step ${stepNumber} not found`);
      }

      if (step.status !== "PENDING") {
        throw new Error(`Step ${stepNumber} is not pending`);
      }

      // Update step
      await db.approvalStep.update({
        where: { id: step.id },
        data: {
          status: "APPROVED",
          decision: "APPROVED",
          reason: reason || undefined,
          decidedAt: new Date(),
        },
      });

      // Check if all steps approved
      const allSteps = approval.steps;
      const allApproved = allSteps.every((s) => s.status === "APPROVED" || s.status === "SKIPPED");

      if (allApproved) {
        // Final approval
        await db.approval.update({
          where: { id: approvalId },
          data: {
            decision: "APPROVED",
            approverId,
            reason: reason || undefined,
            decidedAt: new Date(),
            currentStep: stepNumber,
          },
        });
      } else {
        // Move to next step
        const nextStep = allSteps.find((s) => s.stepNumber === stepNumber + 1);
        if (nextStep) {
          await db.approval.update({
            where: { id: approvalId },
            data: {
              currentStep: stepNumber + 1,
            },
          });
        }
      }

      // Audit log
      await this.auditLog.append({
        audit_id: randomUUID(),
        tenant_id: tenantId,
        actor_id: approverId,
        type: "event",
        timestamp: new Date().toISOString(),
        correlation_id: randomUUID(),
        data: {
          event_id: randomUUID(),
          tenant_id: tenantId,
          actor_id: approverId,
          type: "approval.step_approved",
          occurred_at: new Date().toISOString(),
          correlation_id: randomUUID(),
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            approval_id: approvalId,
            step_number: stepNumber,
            all_approved: allApproved,
          },
          signatures: [],
        } as any,
        evidence_refs: [],
      });

      const updated = await db.approval.findUnique({
        where: { id: approvalId },
        include: { steps: { orderBy: { stepNumber: "asc" } } },
      });

      return this.mapToApproval(updated!);
    } catch (error) {
      logger.error("Failed to approve step", {
        error: error instanceof Error ? error.message : String(error),
        approval_id: approvalId,
        step_number: stepNumber,
        approver_id: approverId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Reject step (rejects entire approval)
   */
  async rejectStep(
    approvalId: string,
    stepNumber: number,
    approverId: string,
    tenantId: string,
    reason: string
  ): Promise<Approval> {
    try {
      const approval = await db.approval.findUnique({
        where: { id: approvalId },
        include: { steps: { orderBy: { stepNumber: "asc" } } },
      });

      if (!approval || approval.tenantId !== tenantId) {
        throw new Error("Approval not found or tenant mismatch");
      }

      // Find step
      const step = approval.steps.find((s) => s.stepNumber === stepNumber);
      if (!step) {
        throw new Error(`Step ${stepNumber} not found`);
      }

      // Update step
      await db.approvalStep.update({
        where: { id: step.id },
        data: {
          status: "REJECTED",
          decision: "REJECTED",
          reason,
          decidedAt: new Date(),
        },
      });

      // Reject entire approval
      await db.approval.update({
        where: { id: approvalId },
        data: {
          decision: "REJECTED",
          approverId,
          reason,
          decidedAt: new Date(),
          currentStep: stepNumber,
        },
      });

      // Audit log
      await this.auditLog.append({
        audit_id: randomUUID(),
        tenant_id: tenantId,
        actor_id: approverId,
        type: "event",
        timestamp: new Date().toISOString(),
        correlation_id: randomUUID(),
        data: {
          event_id: randomUUID(),
          tenant_id: tenantId,
          actor_id: approverId,
          type: "approval.rejected",
          occurred_at: new Date().toISOString(),
          correlation_id: randomUUID(),
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            approval_id: approvalId,
            step_number: stepNumber,
            reason,
          },
          signatures: [],
        } as any,
        evidence_refs: [],
      });

      const updated = await db.approval.findUnique({
        where: { id: approvalId },
        include: { steps: { orderBy: { stepNumber: "asc" } } },
      });

      return this.mapToApproval(updated!);
    } catch (error) {
      logger.error("Failed to reject step", {
        error: error instanceof Error ? error.message : String(error),
        approval_id: approvalId,
        step_number: stepNumber,
        approver_id: approverId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Break-glass procedure (emergency override)
   */
  async breakGlass(
    approvalId: string,
    approverId: string,
    tenantId: string,
    reason: string,
    justification?: string
  ): Promise<Approval> {
    try {
      const approval = await db.approval.findUnique({
        where: { id: approvalId },
      });

      if (!approval || approval.tenantId !== tenantId) {
        throw new Error("Approval not found or tenant mismatch");
      }

      // Check if user has break-glass permission
      const hasPermission = await this.checkBreakGlassPermission(approverId, tenantId);
      if (!hasPermission) {
        throw new Error("Insufficient permissions for break-glass procedure");
      }

      // Create break-glass record
      await db.approvalBreakGlass.create({
        data: {
          approvalId,
          tenantId,
          triggeredBy: approverId,
          reason,
          justification: justification || undefined,
        },
      });

      // Approve immediately
      await db.approval.update({
        where: { id: approvalId },
        data: {
          decision: "APPROVED",
          approverId,
          reason: `Break-glass: ${reason}`,
          decidedAt: new Date(),
          breakGlass: true,
          breakGlassReason: reason,
          breakGlassBy: approverId,
          breakGlassAt: new Date(),
        },
      });

      // Mark all steps as approved
      await db.approvalStep.updateMany({
        where: {
          approvalId,
          status: "PENDING",
        },
        data: {
          status: "APPROVED",
          decision: "APPROVED",
          reason: "Break-glass override",
          decidedAt: new Date(),
        },
      });

      // Audit log
      await this.auditLog.append({
        audit_id: randomUUID(),
        tenant_id: tenantId,
        actor_id: approverId,
        type: "event",
        timestamp: new Date().toISOString(),
        correlation_id: randomUUID(),
        data: {
          event_id: randomUUID(),
          tenant_id: tenantId,
          actor_id: approverId,
          type: "approval.break_glass",
          occurred_at: new Date().toISOString(),
          correlation_id: randomUUID(),
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            approval_id: approvalId,
            reason,
            justification,
          },
          signatures: [],
        } as any,
        evidence_refs: [],
      });

      logger.warn("Break-glass procedure executed", {
        approval_id: approvalId,
        approver_id: approverId,
        tenant_id: tenantId,
        reason,
      });

      const updated = await db.approval.findUnique({
        where: { id: approvalId },
        include: { steps: { orderBy: { stepNumber: "asc" } } },
      });

      return this.mapToApproval(updated!);
    } catch (error) {
      logger.error("Failed to execute break-glass", {
        error: error instanceof Error ? error.message : String(error),
        approval_id: approvalId,
        approver_id: approverId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(tenantId: string, workspaceId?: string): Promise<Approval[]> {
    const where: any = {
      tenantId,
      decision: null,
    };

    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    const approvals = await db.approval.findMany({
      where,
      include: {
        steps: { orderBy: { stepNumber: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return approvals.map((a) => this.mapToApproval(a));
  }

  /**
   * Get approval by ID
   */
  async getApproval(approvalId: string, tenantId: string): Promise<Approval | null> {
    const approval = await db.approval.findUnique({
      where: { id: approvalId },
      include: {
        steps: { orderBy: { stepNumber: "asc" } },
      },
    });

    if (!approval || approval.tenantId !== tenantId) {
      return null;
    }

    return this.mapToApproval(approval);
  }

  /**
   * Get default approvers for tenant/workspace
   */
  private async getDefaultApprovers(
    tenantId: string,
    workspaceId?: string
  ): Promise<string[]> {
    // Get approvers from workspace if specified
    if (workspaceId) {
      const workspace = await db.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          users: {
            where: {
              role: { in: ["APPROVER", "ADMIN"] },
            },
          },
        },
      });

      if (workspace && workspace.users.length > 0) {
        return workspace.users.map((u) => u.userId);
      }
    }

    // Fallback to tenant-level approvers
    const approvers = await db.user.findMany({
      where: {
        tenantId,
        role: { in: ["APPROVER", "ADMIN"] as any },
      },
      select: { id: true },
      take: 10,
    });

    return approvers.map((u) => u.id);
  }

  /**
   * Check break-glass permission
   */
  private async checkBreakGlassPermission(
    userId: string,
    tenantId: string
  ): Promise<boolean> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, tenantId: true },
    });

    if (!user || user.tenantId !== tenantId) {
      return false;
    }

    // Only ADMIN and APPROVER roles can break-glass
    return user.role === "ADMIN" || user.role === "APPROVER";
  }

  /**
   * Map database record to Approval
   */
  private mapToApproval(approval: any): Approval {
    return {
      id: approval.id,
      request: {
        resourceType: approval.resourceType,
        resourceId: approval.resourceId,
        action: approval.action,
        content: "", // Not stored in approval table
        requesterId: approval.requesterId,
        workspaceId: approval.workspaceId || undefined,
        workflowId: approval.workflowId || undefined,
      },
      status: approval.decision ? (approval.decision === "APPROVED" ? "approved" : "rejected") : "pending",
      decision: approval.decision?.toLowerCase() as "approved" | "rejected" | undefined,
      approverId: approval.approverId || undefined,
      reason: approval.reason || undefined,
      createdAt: approval.createdAt.toISOString(),
      decidedAt: approval.decidedAt?.toISOString() || undefined,
    };
  }

  /**
   * Calculate confidence score from content analysis
   */
  private async calculateConfidence(request: ApprovalRequest): Promise<number> {
    let confidence = 0.5; // Base confidence

    // Factor 1: Content length (longer content = more context = higher confidence)
    const contentLength = request.content.length;
    if (contentLength > 500) {
      confidence += 0.1;
    } else if (contentLength < 50) {
      confidence -= 0.2;
    }

    // Factor 2: Context completeness
    if (request.context) {
      const contextKeys = Object.keys(request.context);
      if (contextKeys.length > 3) {
        confidence += 0.1;
      }
    }

    // Factor 3: Priority (higher priority = lower auto-approve confidence)
    const priorityWeights = { low: 0.1, medium: 0, high: -0.1, critical: -0.2 };
    confidence += priorityWeights[request.priority || "medium"] || 0;

    // Factor 4: Content quality indicators (basic heuristics)
    const hasStructure = /^#{1,3}\s|^\d+\.|^[-*]\s/.test(request.content);
    if (hasStructure) {
      confidence += 0.05;
    }

    const hasEvidence = /evidence|source|reference|citation/i.test(request.content);
    if (hasEvidence) {
      confidence += 0.1;
    }

    // Factor 5: Use AI-based confidence if available
    try {
      const { VectorEmbeddings } = await import("@/lib/search/embeddings");
      const embeddings = new VectorEmbeddings();
      const contentEmbedding = await embeddings.embed(request.content, { model: "openai" });
      
      // Higher dimensional embeddings suggest richer content
      if (contentEmbedding.vector.length > 512) {
        confidence += 0.05;
      }
    } catch (error) {
      // Fallback if embeddings unavailable
      console.warn("Confidence calculation: embeddings unavailable", error);
    }

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, confidence));
  }
}
