/**
 * CAPA (Corrective Action and Preventive Action) Service
 * 
 * Links claim clusters to corrective/preventive actions, tracks ownership,
 * and measures effectiveness to create a provable improvement loop.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { randomUUID } from "crypto";

export type ActionStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "VERIFIED";
export type ActionPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ChangeEventType =
  | "POLICY_REVISION"
  | "VENDOR_TERMINATION"
  | "LEADERSHIP_CHANGE"
  | "CONTROL_ADDED"
  | "PROCESS_CHANGE"
  | "SYSTEM_UPDATE"
  | "OTHER";

export interface CorrectiveAction {
  id: string;
  tenant_id: string;
  cluster_id: string;
  title: string;
  description: string;
  status: ActionStatus;
  priority: ActionPriority;
  owner_id?: string;
  due_date?: string;
  completed_at?: string;
  effectiveness?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PreventiveAction {
  id: string;
  tenant_id: string;
  cluster_id: string;
  title: string;
  description: string;
  status: ActionStatus;
  priority: ActionPriority;
  owner_id?: string;
  due_date?: string;
  completed_at?: string;
  effectiveness?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ChangeEvent {
  id: string;
  tenant_id: string;
  type: ChangeEventType;
  title: string;
  description: string;
  changed_by: string;
  changed_at: string;
  corrective_action_id?: string;
  preventive_action_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ActionOwner {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  email?: string;
  role?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class CAPAService {
  private auditLog: DatabaseAuditLog;

  constructor() {
    this.auditLog = new DatabaseAuditLog();
  }

  /**
   * Create corrective action
   */
  async createCorrectiveAction(
    tenantId: string,
    clusterId: string,
    title: string,
    description: string,
    options?: {
      priority?: ActionPriority;
      ownerId?: string;
      dueDate?: Date;
      metadata?: Record<string, unknown>;
    }
  ): Promise<CorrectiveAction> {
    try {
      const action = await db.correctiveAction.create({
        data: {
          tenantId,
          clusterId,
          title,
          description,
          status: "OPEN",
          priority: options?.priority || "MEDIUM",
          ownerId: options?.ownerId || undefined,
          dueDate: options?.dueDate || undefined,
          metadata: (options?.metadata as any) || undefined,
        },
      });

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
          type: "capa.created",
          occurred_at: new Date().toISOString(),
          correlation_id: randomUUID(),
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            action_id: action.id,
            action_type: "corrective",
            cluster_id: clusterId,
            title,
          },
          signatures: [],
        } as any,
        evidence_refs: [],
      });

      logger.info("Corrective action created", {
        action_id: action.id,
        cluster_id: clusterId,
        tenant_id: tenantId,
      });

      return this.mapToCorrectiveAction(action);
    } catch (error) {
      logger.error("Failed to create corrective action", {
        error: error instanceof Error ? error.message : String(error),
        cluster_id: clusterId,
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Create preventive action
   */
  async createPreventiveAction(
    tenantId: string,
    clusterId: string,
    title: string,
    description: string,
    options?: {
      priority?: ActionPriority;
      ownerId?: string;
      dueDate?: Date;
      metadata?: Record<string, unknown>;
    }
  ): Promise<PreventiveAction> {
    try {
      const action = await db.preventiveAction.create({
        data: {
          tenantId,
          clusterId,
          title,
          description,
          status: "OPEN",
          priority: options?.priority || "MEDIUM",
          ownerId: options?.ownerId || undefined,
          dueDate: options?.dueDate || undefined,
          metadata: (options?.metadata as any) || undefined,
        },
      });

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
          type: "capa.created",
          occurred_at: new Date().toISOString(),
          correlation_id: randomUUID(),
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            action_id: action.id,
            action_type: "preventive",
            cluster_id: clusterId,
            title,
          },
          signatures: [],
        } as any,
        evidence_refs: [],
      });

      logger.info("Preventive action created", {
        action_id: action.id,
        cluster_id: clusterId,
        tenant_id: tenantId,
      });

      return this.mapToPreventiveAction(action);
    } catch (error) {
      logger.error("Failed to create preventive action", {
        error: error instanceof Error ? error.message : String(error),
        cluster_id: clusterId,
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Update action status
   */
  async updateActionStatus(
    actionId: string,
    actionType: "corrective" | "preventive",
    status: ActionStatus,
    tenantId: string,
    actorId: string
  ): Promise<CorrectiveAction | PreventiveAction> {
    try {
      if (actionType === "corrective") {
        const action = await db.correctiveAction.update({
          where: { id: actionId },
          data: {
            status: status as any,
            completedAt: status === "COMPLETED" ? new Date() : undefined,
          },
        });

        if (action.tenantId !== tenantId) {
          throw new Error("Tenant mismatch");
        }

        // Audit log
        await this.auditLog.append({
          audit_id: randomUUID(),
          tenant_id: tenantId,
          actor_id: actorId,
          type: "event",
          timestamp: new Date().toISOString(),
          correlation_id: randomUUID(),
          data: {
            event_id: randomUUID(),
            tenant_id: tenantId,
            actor_id: actorId,
            type: "capa.status_updated",
            occurred_at: new Date().toISOString(),
            correlation_id: randomUUID(),
            schema_version: "1.0",
            evidence_refs: [],
            payload: {
              action_id: actionId,
              action_type: "corrective",
              old_status: action.status,
              new_status: status,
            },
            signatures: [],
          } as any,
          evidence_refs: [],
        });

        return this.mapToCorrectiveAction(action);
      } else {
        const action = await db.preventiveAction.update({
          where: { id: actionId },
          data: {
            status: status as any,
            completedAt: status === "COMPLETED" ? new Date() : undefined,
          },
        });

        if (action.tenantId !== tenantId) {
          throw new Error("Tenant mismatch");
        }

        // Audit log
        await this.auditLog.append({
          audit_id: randomUUID(),
          tenant_id: tenantId,
          actor_id: actorId,
          type: "event",
          timestamp: new Date().toISOString(),
          correlation_id: randomUUID(),
          data: {
            event_id: randomUUID(),
            tenant_id: tenantId,
            actor_id: actorId,
            type: "capa.status_updated",
            occurred_at: new Date().toISOString(),
            correlation_id: randomUUID(),
            schema_version: "1.0",
            evidence_refs: [],
            payload: {
              action_id: actionId,
              action_type: "preventive",
              old_status: action.status,
              new_status: status,
            },
            signatures: [],
          } as any,
          evidence_refs: [],
        });

        return this.mapToPreventiveAction(action);
      }
    } catch (error) {
      logger.error("Failed to update action status", {
        error: error instanceof Error ? error.message : String(error),
        action_id: actionId,
        action_type: actionType,
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Assign owner to action
   */
  async assignOwner(
    actionId: string,
    actionType: "corrective" | "preventive",
    ownerId: string,
    tenantId: string,
    actorId: string
  ): Promise<void> {
    try {
      if (actionType === "corrective") {
        const action = await db.correctiveAction.findUnique({
          where: { id: actionId },
        });

        if (!action || action.tenantId !== tenantId) {
          throw new Error("Action not found or tenant mismatch");
        }

        await db.correctiveAction.update({
          where: { id: actionId },
          data: { ownerId },
        });
      } else {
        const action = await db.preventiveAction.findUnique({
          where: { id: actionId },
        });

        if (!action || action.tenantId !== tenantId) {
          throw new Error("Action not found or tenant mismatch");
        }

        await db.preventiveAction.update({
          where: { id: actionId },
          data: { ownerId },
        });
      }

      // Audit log
      await this.auditLog.append({
        audit_id: randomUUID(),
        tenant_id: tenantId,
        actor_id: actorId,
        type: "event",
        timestamp: new Date().toISOString(),
        correlation_id: randomUUID(),
        data: {
          event_id: randomUUID(),
          tenant_id: tenantId,
          actor_id: actorId,
          type: "capa.owner_assigned",
          occurred_at: new Date().toISOString(),
          correlation_id: randomUUID(),
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            action_id: actionId,
            action_type: actionType,
            owner_id: ownerId,
          },
          signatures: [],
        } as any,
        evidence_refs: [],
      });

      logger.info("Action owner assigned", {
        action_id: actionId,
        action_type: actionType,
        owner_id: ownerId,
        tenant_id: tenantId,
      });
    } catch (error) {
      logger.error("Failed to assign action owner", {
        error: error instanceof Error ? error.message : String(error),
        action_id: actionId,
        action_type: actionType,
        owner_id: ownerId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Get actions for cluster
   */
  async getActionsForCluster(
    clusterId: string,
    tenantId: string
  ): Promise<{
    corrective: CorrectiveAction[];
    preventive: PreventiveAction[];
  }> {
    const corrective = await db.correctiveAction.findMany({
      where: {
        clusterId,
        tenantId,
      },
      orderBy: { createdAt: "desc" },
    });

    const preventive = await db.preventiveAction.findMany({
      where: {
        clusterId,
        tenantId,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      corrective: corrective.map((a) => this.mapToCorrectiveAction(a)),
      preventive: preventive.map((a) => this.mapToPreventiveAction(a)),
    };
  }

  /**
   * Create or get action owner
   */
  async getOrCreateOwner(
    tenantId: string,
    userId: string,
    name: string,
    options?: {
      email?: string;
      role?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<ActionOwner> {
    const existing = await db.actionOwner.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId,
        },
      },
    });

    if (existing) {
      return this.mapToActionOwner(existing);
    }

    const owner = await db.actionOwner.create({
      data: {
        tenantId,
        userId,
        name,
        email: options?.email || undefined,
        role: options?.role || undefined,
        metadata: (options?.metadata as any) || undefined,
      },
    });

    return this.mapToActionOwner(owner);
  }

  /**
   * Map database record to CorrectiveAction
   */
  private mapToCorrectiveAction(action: any): CorrectiveAction {
    return {
      id: action.id,
      tenant_id: action.tenantId,
      cluster_id: action.clusterId,
      title: action.title,
      description: action.description,
      status: action.status as ActionStatus,
      priority: action.priority as ActionPriority,
      owner_id: action.ownerId || undefined,
      due_date: action.dueDate?.toISOString() || undefined,
      completed_at: action.completedAt?.toISOString() || undefined,
      effectiveness: action.effectiveness || undefined,
      metadata: (action.metadata as Record<string, unknown>) || undefined,
      created_at: action.createdAt.toISOString(),
      updated_at: action.updatedAt.toISOString(),
    };
  }

  /**
   * Map database record to PreventiveAction
   */
  private mapToPreventiveAction(action: any): PreventiveAction {
    return {
      id: action.id,
      tenant_id: action.tenantId,
      cluster_id: action.clusterId,
      title: action.title,
      description: action.description,
      status: action.status as ActionStatus,
      priority: action.priority as ActionPriority,
      owner_id: action.ownerId || undefined,
      due_date: action.dueDate?.toISOString() || undefined,
      completed_at: action.completedAt?.toISOString() || undefined,
      effectiveness: action.effectiveness || undefined,
      metadata: (action.metadata as Record<string, unknown>) || undefined,
      created_at: action.createdAt.toISOString(),
      updated_at: action.updatedAt.toISOString(),
    };
  }

  /**
   * Map database record to ActionOwner
   */
  private mapToActionOwner(owner: any): ActionOwner {
    return {
      id: owner.id,
      tenant_id: owner.tenantId,
      user_id: owner.userId,
      name: owner.name,
      email: owner.email || undefined,
      role: owner.role || undefined,
      metadata: (owner.metadata as Record<string, unknown>) || undefined,
      created_at: owner.createdAt.toISOString(),
      updated_at: owner.updatedAt.toISOString(),
    };
  }
}
