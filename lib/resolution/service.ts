/**
 * Customer Resolution Service
 * 
 * Routes refunds/escalations, integrates with support ticket systems,
 * and tracks remediation actions with SLA monitoring.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { randomUUID } from "crypto";

export type ResolutionType = "REFUND" | "ESCALATION" | "SUPPORT_TICKET" | "APOLOGY" | "CLARIFICATION";
export type ResolutionStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "ESCALATED";
export type RemediationStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "VERIFIED" | "FAILED";

export interface CustomerResolution {
  id: string;
  tenant_id: string;
  cluster_id: string;
  type: ResolutionType;
  status: ResolutionStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  title: string;
  description: string;
  customer_info?: {
    email?: string;
    name?: string;
    account_id?: string;
  };
  assigned_to?: string;
  support_ticket_id?: string;
  external_ticket_id?: string;
  sla_deadline?: string;
  resolved_at?: string;
  resolution_details?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RemediationAction {
  id: string;
  resolution_id: string;
  tenant_id: string;
  action_type: string;
  description: string;
  status: RemediationStatus;
  assigned_to?: string;
  due_date?: string;
  completed_at?: string;
  verification_notes?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class CustomerResolutionService {
  private auditLog: DatabaseAuditLog;

  constructor() {
    this.auditLog = new DatabaseAuditLog();
  }

  /**
   * Create customer resolution
   */
  async createResolution(
    tenantId: string,
    clusterId: string,
    type: ResolutionType,
    title: string,
    description: string,
    options?: {
      priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      customer_info?: {
        email?: string;
        name?: string;
        account_id?: string;
      };
      assigned_to?: string;
      sla_hours?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<CustomerResolution> {
    try {
      // Calculate SLA deadline
      const slaDeadline = options?.sla_hours
        ? new Date(Date.now() + options.sla_hours * 60 * 60 * 1000)
        : this.calculateSLADeadline(type, options?.priority || "MEDIUM");

      const resolution = await db.customerResolution.create({
        data: {
          tenantId,
          clusterId,
          type: type as any,
          status: "OPEN",
          priority: (options?.priority || "MEDIUM") as any,
          title,
          description,
          customerInfo: options?.customer_info || undefined,
          assignedTo: options?.assigned_to || undefined,
          slaDeadline,
          metadata: (options?.metadata as any) || undefined,
        },
      });

      // Create support ticket if needed
      if (type === "SUPPORT_TICKET" || type === "ESCALATION") {
        await this.createSupportTicket(resolution.id, tenantId, type);
      }

      // Audit log
      await this.auditLog.append({
        audit_id: randomUUID(),
        tenant_id: tenantId,
        actor_id: "system",
        type: "event",
        timestamp: new Date().toISOString(),
        correlation_id: randomUUID(),
        data: {
          event_id: randomUUID(),
          tenant_id: tenantId,
          actor_id: "system",
          type: "resolution.created",
          occurred_at: new Date().toISOString(),
          correlation_id: randomUUID(),
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            resolution_id: resolution.id,
            cluster_id: clusterId,
            type,
            priority: options?.priority || "MEDIUM",
          },
          signatures: [],
        } as any,
        evidence_refs: [],
      });

      logger.info("Customer resolution created", {
        resolution_id: resolution.id,
        cluster_id: clusterId,
        tenant_id: tenantId,
        type,
      });

      return this.mapToResolution(resolution);
    } catch (error) {
      logger.error("Failed to create customer resolution", {
        error: error instanceof Error ? error.message : String(error),
        cluster_id: clusterId,
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Route resolution based on type and priority
   */
  async routeResolution(
    resolutionId: string,
    tenantId: string
  ): Promise<{ routed: boolean; route_to: string[] }> {
    try {
      const resolution = await db.customerResolution.findUnique({
        where: { id: resolutionId },
      });

      if (!resolution || resolution.tenantId !== tenantId) {
        throw new Error("Resolution not found or tenant mismatch");
      }

      const routes: string[] = [];

      // Route based on type and priority
      if (resolution.type === "REFUND" && resolution.priority === "URGENT") {
        routes.push("Finance", "Customer Support");
      } else if (resolution.type === "REFUND") {
        routes.push("Customer Support");
      }

      if (resolution.type === "ESCALATION") {
        routes.push("Management", "Customer Support");
      }

      if (resolution.type === "SUPPORT_TICKET") {
        routes.push("Customer Support");
      }

      if (resolution.priority === "URGENT" || resolution.priority === "HIGH") {
        routes.push("Escalation Team");
      }

      // Update resolution with routes
      await db.customerResolution.update({
        where: { id: resolutionId },
        data: {
          metadata: {
            ...((resolution.metadata as Record<string, unknown>) || {}),
            routes,
            routed_at: new Date().toISOString(),
          } as any,
        },
      });

      return {
        routed: true,
        route_to: Array.from(new Set(routes)),
      };
    } catch (error) {
      logger.error("Failed to route resolution", {
        error: error instanceof Error ? error.message : String(error),
        resolution_id: resolutionId,
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Create support ticket (integrate with external systems)
   */
  private async createSupportTicket(
    resolutionId: string,
    tenantId: string,
    type: ResolutionType
  ): Promise<void> {
    try {
      // In production, integrate with Zendesk, Jira, ServiceNow, etc.
      // For now, create internal ticket record
      const ticket = await db.supportTicket.create({
        data: {
          tenantId,
          resolutionId,
          externalSystem: "internal", // "zendesk", "jira", "servicenow"
          externalId: `ticket-${Date.now()}`,
          status: "OPEN",
          priority: "MEDIUM",
        },
      });

      // Update resolution with ticket ID
      await db.customerResolution.update({
        where: { id: resolutionId },
        data: {
          supportTicketId: ticket.id,
          externalTicketId: ticket.externalId,
        },
      });

      logger.info("Support ticket created", {
        ticket_id: ticket.id,
        resolution_id: resolutionId,
        tenant_id: tenantId,
      });
    } catch (error) {
      logger.warn("Failed to create support ticket", {
        error: error instanceof Error ? error.message : String(error),
        resolution_id: resolutionId,
      });
    }
  }

  /**
   * Create remediation action
   */
  async createRemediationAction(
    resolutionId: string,
    tenantId: string,
    actionType: string,
    description: string,
    options?: {
      assigned_to?: string;
      due_date?: Date;
      metadata?: Record<string, unknown>;
    }
  ): Promise<RemediationAction> {
    try {
      const action = await db.remediationAction.create({
        data: {
          resolutionId,
          tenantId,
          actionType,
          description,
          status: "PENDING",
          assignedTo: options?.assigned_to || undefined,
          dueDate: options?.due_date || undefined,
          metadata: (options?.metadata as any) || undefined,
        },
      });

      logger.info("Remediation action created", {
        action_id: action.id,
        resolution_id: resolutionId,
        tenant_id: tenantId,
      });

      return this.mapToRemediationAction(action);
    } catch (error) {
      logger.error("Failed to create remediation action", {
        error: error instanceof Error ? error.message : String(error),
        resolution_id: resolutionId,
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Get resolutions for cluster
   */
  async getResolutionsForCluster(
    clusterId: string,
    tenantId: string
  ): Promise<CustomerResolution[]> {
    const resolutions = await db.customerResolution.findMany({
      where: {
        clusterId,
        tenantId,
      },
      orderBy: { createdAt: "desc" },
    });

    return resolutions.map((r) => this.mapToResolution(r));
  }

  /**
   * Calculate SLA deadline based on type and priority
   */
  private calculateSLADeadline(
    type: ResolutionType,
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  ): Date {
    let hours = 24; // Default

    if (priority === "URGENT") {
      hours = 2;
    } else if (priority === "HIGH") {
      hours = 4;
    } else if (priority === "MEDIUM") {
      hours = 24;
    } else {
      hours = 72;
    }

    // Adjust based on type
    if (type === "REFUND") {
      hours = Math.min(hours, 48);
    } else if (type === "ESCALATION") {
      hours = Math.min(hours, 4);
    }

    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  /**
   * Map database record to CustomerResolution
   */
  private mapToResolution(resolution: any): CustomerResolution {
    return {
      id: resolution.id,
      tenant_id: resolution.tenantId,
      cluster_id: resolution.clusterId,
      type: resolution.type as ResolutionType,
      status: resolution.status as ResolutionStatus,
      priority: resolution.priority as any,
      title: resolution.title,
      description: resolution.description,
      customer_info: (resolution.customerInfo as Record<string, unknown>) || undefined,
      assigned_to: resolution.assignedTo || undefined,
      support_ticket_id: resolution.supportTicketId || undefined,
      external_ticket_id: resolution.externalTicketId || undefined,
      sla_deadline: resolution.slaDeadline?.toISOString() || undefined,
      resolved_at: resolution.resolvedAt?.toISOString() || undefined,
      resolution_details: resolution.resolutionDetails || undefined,
      metadata: (resolution.metadata as Record<string, unknown>) || undefined,
      created_at: resolution.createdAt.toISOString(),
      updated_at: resolution.updatedAt.toISOString(),
    };
  }

  /**
   * Map database record to RemediationAction
   */
  private mapToRemediationAction(action: any): RemediationAction {
    return {
      id: action.id,
      resolution_id: action.resolutionId,
      tenant_id: action.tenantId,
      action_type: action.actionType,
      description: action.description,
      status: action.status as RemediationStatus,
      assigned_to: action.assignedTo || undefined,
      due_date: action.dueDate?.toISOString() || undefined,
      completed_at: action.completedAt?.toISOString() || undefined,
      verification_notes: action.verificationNotes || undefined,
      metadata: (action.metadata as Record<string, unknown>) || undefined,
      created_at: action.createdAt.toISOString(),
      updated_at: action.updatedAt.toISOString(),
    };
  }
}
