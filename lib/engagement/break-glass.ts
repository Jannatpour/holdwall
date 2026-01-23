/**
 * Break-Glass Emergency Procedures
 * 
 * Emergency override procedures for critical situations that require
 * immediate action bypassing normal approval workflows.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { randomUUID } from "crypto";
import { RBACService } from "@/lib/auth/rbac";

export interface BreakGlassRequest {
  approval_id: string;
  requester_id: string;
  tenant_id: string;
  reason: string;
  justification?: string;
  urgency: "HIGH" | "CRITICAL";
}

export interface BreakGlassRecord {
  id: string;
  approval_id: string;
  tenant_id: string;
  triggered_by: string;
  reason: string;
  justification?: string;
  created_at: string;
}

export class BreakGlassService {
  private auditLog: DatabaseAuditLog;
  private rbacService: RBACService;

  constructor() {
    this.auditLog = new DatabaseAuditLog();
    this.rbacService = new RBACService();
  }

  /**
   * Execute break-glass procedure
   */
  async executeBreakGlass(request: BreakGlassRequest): Promise<BreakGlassRecord> {
    try {
      // Verify permission
      const hasPermission = await this.rbacService.hasPermission(
        request.requester_id,
        "approval",
        "break_glass",
        [
          { key: "tenantId", value: request.tenant_id },
          { key: "urgency", value: request.urgency },
        ]
      );

      if (!hasPermission) {
        throw new Error("Insufficient permissions for break-glass procedure");
      }

      // Verify approval exists
      const approval = await db.approval.findUnique({
        where: { id: request.approval_id },
      });

      if (!approval || approval.tenantId !== request.tenant_id) {
        throw new Error("Approval not found or tenant mismatch");
      }

      // Create break-glass record
      const breakGlass = await db.approvalBreakGlass.create({
        data: {
          approvalId: request.approval_id,
          tenantId: request.tenant_id,
          triggeredBy: request.requester_id,
          reason: request.reason,
          justification: request.justification || undefined,
          metadata: {
            urgency: request.urgency,
          } as any,
        },
      });

      // Approve immediately
      await db.approval.update({
        where: { id: request.approval_id },
        data: {
          decision: "APPROVED",
          approverId: request.requester_id,
          reason: `Break-glass: ${request.reason}`,
          decidedAt: new Date(),
          breakGlass: true,
          breakGlassReason: request.reason,
          breakGlassBy: request.requester_id,
          breakGlassAt: new Date(),
        },
      });

      // Mark all pending steps as approved
      await db.approvalStep.updateMany({
        where: {
          approvalId: request.approval_id,
          status: "PENDING",
        },
        data: {
          status: "APPROVED",
          decision: "APPROVED",
          reason: "Break-glass override",
          decidedAt: new Date(),
        },
      });

      // Audit log (critical event)
      await this.auditLog.append({
        audit_id: randomUUID(),
        tenant_id: request.tenant_id,
        actor_id: request.requester_id,
        type: "event",
        timestamp: new Date().toISOString(),
        correlation_id: randomUUID(),
        data: {
          event_id: randomUUID(),
          tenant_id: request.tenant_id,
          actor_id: request.requester_id,
          type: "approval.break_glass_executed",
          occurred_at: new Date().toISOString(),
          correlation_id: randomUUID(),
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            break_glass_id: breakGlass.id,
            approval_id: request.approval_id,
            reason: request.reason,
            justification: request.justification,
            urgency: request.urgency,
          },
          signatures: [],
        } as any,
        evidence_refs: [],
      });

      logger.warn("Break-glass procedure executed", {
        break_glass_id: breakGlass.id,
        approval_id: request.approval_id,
        triggered_by: request.requester_id,
        tenant_id: request.tenant_id,
        reason: request.reason,
        urgency: request.urgency,
      });

      return {
        id: breakGlass.id,
        approval_id: breakGlass.approvalId,
        tenant_id: breakGlass.tenantId,
        triggered_by: breakGlass.triggeredBy,
        reason: breakGlass.reason,
        justification: breakGlass.justification || undefined,
        created_at: breakGlass.createdAt.toISOString(),
      };
    } catch (error) {
      logger.error("Failed to execute break-glass", {
        error: error instanceof Error ? error.message : String(error),
        approval_id: request.approval_id,
        requester_id: request.requester_id,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Get break-glass history
   */
  async getBreakGlassHistory(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      approval_id?: string;
    }
  ): Promise<BreakGlassRecord[]> {
    const where: any = { tenantId };

    if (options?.approval_id) {
      where.approvalId = options.approval_id;
    }

    const records = await db.approvalBreakGlass.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit || 100,
      skip: options?.offset || 0,
    });

    return records.map((r) => ({
      id: r.id,
      approval_id: r.approvalId,
      tenant_id: r.tenantId,
      triggered_by: r.triggeredBy,
      reason: r.reason,
      justification: r.justification || undefined,
      created_at: r.createdAt.toISOString(),
    }));
  }
}
