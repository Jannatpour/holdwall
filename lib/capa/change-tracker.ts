/**
 * Change Tracker Service
 * 
 * Tracks policy revisions, vendor changes, leadership changes, and control additions
 * to provide evidence of "what changed" for claim clusters.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { randomUUID } from "crypto";
import type { ChangeEventType } from "./service";

export interface ChangeEventInput {
  tenant_id: string;
  type: ChangeEventType;
  title: string;
  description: string;
  changed_by: string;
  corrective_action_id?: string;
  preventive_action_id?: string;
  metadata?: Record<string, unknown>;
}

export class ChangeTracker {
  private auditLog: DatabaseAuditLog;

  constructor() {
    this.auditLog = new DatabaseAuditLog();
  }

  /**
   * Record change event
   */
  async recordChange(input: ChangeEventInput): Promise<string> {
    try {
      const changeEvent = await db.changeEvent.create({
        data: {
          tenantId: input.tenant_id,
          type: input.type as any,
          title: input.title,
          description: input.description,
          changedBy: input.changed_by,
          correctiveActionId: input.corrective_action_id || undefined,
          preventiveActionId: input.preventive_action_id || undefined,
          metadata: (input.metadata as any) || undefined,
        },
      });

      // Audit log
      await this.auditLog.append({
        audit_id: randomUUID(),
        tenant_id: input.tenant_id,
        actor_id: input.changed_by,
        type: "event",
        timestamp: new Date().toISOString(),
        correlation_id: randomUUID(),
        data: {
          event_id: randomUUID(),
          tenant_id: input.tenant_id,
          actor_id: input.changed_by,
          type: "capa.change_event_recorded",
          occurred_at: new Date().toISOString(),
          correlation_id: randomUUID(),
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            change_event_id: changeEvent.id,
            type: input.type,
            title: input.title,
          },
          signatures: [],
        } as any,
        evidence_refs: [],
      });

      logger.info("Change event recorded", {
        change_event_id: changeEvent.id,
        type: input.type,
        tenant_id: input.tenant_id,
      });

      return changeEvent.id;
    } catch (error) {
      logger.error("Failed to record change event", {
        error: error instanceof Error ? error.message : String(error),
        type: input.type,
        tenant_id: input.tenant_id,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Record policy revision
   */
  async recordPolicyRevision(
    tenantId: string,
    policyName: string,
    revisionDetails: string,
    changedBy: string,
    actionId?: string,
    actionType?: "corrective" | "preventive"
  ): Promise<string> {
    return this.recordChange({
      tenant_id: tenantId,
      type: "POLICY_REVISION",
      title: `Policy Revision: ${policyName}`,
      description: revisionDetails,
      changed_by: changedBy,
      corrective_action_id: actionType === "corrective" ? actionId : undefined,
      preventive_action_id: actionType === "preventive" ? actionId : undefined,
      metadata: {
        policy_name: policyName,
      },
    });
  }

  /**
   * Record vendor termination
   */
  async recordVendorTermination(
    tenantId: string,
    vendorName: string,
    terminationDetails: string,
    changedBy: string,
    actionId?: string,
    actionType?: "corrective" | "preventive"
  ): Promise<string> {
    return this.recordChange({
      tenant_id: tenantId,
      type: "VENDOR_TERMINATION",
      title: `Vendor Termination: ${vendorName}`,
      description: terminationDetails,
      changed_by: changedBy,
      corrective_action_id: actionType === "corrective" ? actionId : undefined,
      preventive_action_id: actionType === "preventive" ? actionId : undefined,
      metadata: {
        vendor_name: vendorName,
      },
    });
  }

  /**
   * Record leadership change
   */
  async recordLeadershipChange(
    tenantId: string,
    role: string,
    changeDetails: string,
    changedBy: string,
    actionId?: string,
    actionType?: "corrective" | "preventive"
  ): Promise<string> {
    return this.recordChange({
      tenant_id: tenantId,
      type: "LEADERSHIP_CHANGE",
      title: `Leadership Change: ${role}`,
      description: changeDetails,
      changed_by: changedBy,
      corrective_action_id: actionType === "corrective" ? actionId : undefined,
      preventive_action_id: actionType === "preventive" ? actionId : undefined,
      metadata: {
        role,
      },
    });
  }

  /**
   * Record control addition
   */
  async recordControlAddition(
    tenantId: string,
    controlName: string,
    controlDetails: string,
    changedBy: string,
    actionId?: string,
    actionType?: "corrective" | "preventive"
  ): Promise<string> {
    return this.recordChange({
      tenant_id: tenantId,
      type: "CONTROL_ADDED",
      title: `Control Added: ${controlName}`,
      description: controlDetails,
      changed_by: changedBy,
      corrective_action_id: actionType === "corrective" ? actionId : undefined,
      preventive_action_id: actionType === "preventive" ? actionId : undefined,
      metadata: {
        control_name: controlName,
      },
    });
  }

  /**
   * Get change events for action
   */
  async getChangeEventsForAction(
    actionId: string,
    actionType: "corrective" | "preventive",
    tenantId: string
  ) {
    const where: any = {
      tenantId,
    };

    if (actionType === "corrective") {
      where.correctiveActionId = actionId;
    } else {
      where.preventiveActionId = actionId;
    }

    const events = await db.changeEvent.findMany({
      where,
      orderBy: { changedAt: "desc" },
    });

    return events.map((e) => ({
      id: e.id,
      tenant_id: e.tenantId,
      type: e.type,
      title: e.title,
      description: e.description,
      changed_by: e.changedBy,
      changed_at: e.changedAt.toISOString(),
      corrective_action_id: e.correctiveActionId || undefined,
      preventive_action_id: e.preventiveActionId || undefined,
      metadata: (e.metadata as Record<string, unknown>) || undefined,
      created_at: e.createdAt.toISOString(),
    }));
  }
}
