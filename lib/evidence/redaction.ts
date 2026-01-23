/**
 * Evidence Redaction Service
 * 
 * Manages evidence redaction with full audit trail, approval workflow, and before/after tracking.
 * Ensures compliance with privacy regulations (GDPR, CCPA, HIPAA).
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { EvidenceAccessControlService } from "./access-control";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { randomUUID } from "crypto";

export type RedactionStatus = "PENDING" | "APPROVED" | "REJECTED" | "APPLIED";

export interface RedactionRequest {
  evidence_id: string;
  tenant_id: string;
  redacted_by: string;
  redaction_map: Record<string, string>; // Map of original -> redacted
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface RedactionEntry {
  id: string;
  evidence_id: string;
  tenant_id: string;
  redacted_by: string;
  approved_by?: string;
  before_content?: string;
  after_content?: string;
  redaction_map: Record<string, string>;
  reason?: string;
  status: RedactionStatus;
  created_at: string;
  approved_at?: string;
  metadata?: Record<string, unknown>;
}

export class EvidenceRedactionService {
  private accessControl: EvidenceAccessControlService;
  private auditLog: DatabaseAuditLog;

  constructor() {
    this.accessControl = new EvidenceAccessControlService();
    this.auditLog = new DatabaseAuditLog();
  }

  /**
   * Request evidence redaction
   */
  async requestRedaction(request: RedactionRequest): Promise<RedactionEntry> {
    try {
      // Check access permission
      const accessCheck = await this.accessControl.checkAccess({
        evidence_id: request.evidence_id,
        actor_id: request.redacted_by,
        tenant_id: request.tenant_id,
        access_type: "REDACT",
        reason: request.reason,
      });

      if (!accessCheck.allowed && !accessCheck.requires_approval) {
        throw new Error(`Access denied: ${accessCheck.reason}`);
      }

      // Get current evidence content
      const evidence = await db.evidence.findUnique({
        where: { id: request.evidence_id },
        select: {
          contentRaw: true,
          contentNormalized: true,
          tenantId: true,
        },
      });

      if (!evidence) {
        throw new Error("Evidence not found");
      }

      if (evidence.tenantId !== request.tenant_id) {
        throw new Error("Tenant mismatch");
      }

      // Apply redaction to content
      const beforeContent = evidence.contentRaw || evidence.contentNormalized || "";
      const afterContent = this.applyRedaction(beforeContent, request.redaction_map);

      // Create redaction record
      const redaction = await db.evidenceRedaction.create({
        data: {
          evidenceId: request.evidence_id,
          tenantId: request.tenant_id,
          redactedBy: request.redacted_by,
          beforeContent: beforeContent || undefined,
          afterContent: afterContent,
          redactionMap: request.redaction_map as any,
          reason: request.reason || undefined,
          status: accessCheck.requires_approval ? "PENDING" : "APPROVED",
          metadata: (request.metadata as any) || undefined,
          approvedAt: accessCheck.requires_approval ? undefined : new Date(),
          approvedBy: accessCheck.requires_approval ? undefined : request.redacted_by,
        },
      });

      // If auto-approved, apply immediately
      if (!accessCheck.requires_approval) {
        await this.applyRedactionToEvidence(redaction.id);
      }

      // Audit log
      await this.auditLog.append({
        audit_id: randomUUID(),
        tenant_id: request.tenant_id,
        actor_id: request.redacted_by,
        type: "event",
        timestamp: new Date().toISOString(),
        correlation_id: randomUUID(),
        data: {
          event_id: randomUUID(),
          tenant_id: request.tenant_id,
          actor_id: request.redacted_by,
          type: "evidence.redaction_requested",
          occurred_at: new Date().toISOString(),
          correlation_id: randomUUID(),
          schema_version: "1.0",
          evidence_refs: [request.evidence_id],
          payload: {
            redaction_id: redaction.id,
            evidence_id: request.evidence_id,
            status: redaction.status,
            requires_approval: accessCheck.requires_approval,
          },
          signatures: [],
        } as any,
        evidence_refs: [request.evidence_id],
      });

      logger.info("Evidence redaction requested", {
        redaction_id: redaction.id,
        evidence_id: request.evidence_id,
        redacted_by: request.redacted_by,
        status: redaction.status,
      });

      return this.mapToRedactionEntry(redaction);
    } catch (error) {
      logger.error("Failed to request evidence redaction", {
        error: error instanceof Error ? error.message : String(error),
        evidence_id: request.evidence_id,
        redacted_by: request.redacted_by,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Approve redaction
   */
  async approveRedaction(
    redactionId: string,
    approverId: string,
    tenantId: string
  ): Promise<RedactionEntry> {
    try {
      const redaction = await db.evidenceRedaction.findUnique({
        where: { id: redactionId },
      });

      if (!redaction) {
        throw new Error("Redaction not found");
      }

      if (redaction.tenantId !== tenantId) {
        throw new Error("Tenant mismatch");
      }

      if (redaction.status !== "PENDING") {
        throw new Error(`Redaction is not pending (status: ${redaction.status})`);
      }

      // Update redaction status
      const updated = await db.evidenceRedaction.update({
        where: { id: redactionId },
        data: {
          status: "APPROVED",
          approvedBy: approverId,
          approvedAt: new Date(),
        },
      });

      // Apply redaction to evidence
      await this.applyRedactionToEvidence(redactionId);

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
          type: "evidence.redaction_approved",
          occurred_at: new Date().toISOString(),
          correlation_id: randomUUID(),
          schema_version: "1.0",
          evidence_refs: [redaction.evidenceId],
          payload: {
            redaction_id: redactionId,
            evidence_id: redaction.evidenceId,
          },
          signatures: [],
        } as any,
        evidence_refs: [redaction.evidenceId],
      });

      logger.info("Evidence redaction approved", {
        redaction_id: redactionId,
        evidence_id: redaction.evidenceId,
        approver_id: approverId,
      });

      return this.mapToRedactionEntry(updated);
    } catch (error) {
      logger.error("Failed to approve evidence redaction", {
        error: error instanceof Error ? error.message : String(error),
        redaction_id: redactionId,
        approver_id: approverId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Reject redaction
   */
  async rejectRedaction(
    redactionId: string,
    rejectorId: string,
    tenantId: string,
    reason?: string
  ): Promise<RedactionEntry> {
    try {
      const redaction = await db.evidenceRedaction.findUnique({
        where: { id: redactionId },
      });

      if (!redaction) {
        throw new Error("Redaction not found");
      }

      if (redaction.tenantId !== tenantId) {
        throw new Error("Tenant mismatch");
      }

      if (redaction.status !== "PENDING") {
        throw new Error(`Redaction is not pending (status: ${redaction.status})`);
      }

      // Update redaction status
      const updated = await db.evidenceRedaction.update({
        where: { id: redactionId },
        data: {
          status: "REJECTED",
          approvedBy: rejectorId,
          approvedAt: new Date(),
          metadata: {
            ...((redaction.metadata as Record<string, unknown>) || {}),
            rejection_reason: reason,
          } as any,
        },
      });

      // Audit log
      await this.auditLog.append({
        audit_id: randomUUID(),
        tenant_id: tenantId,
        actor_id: rejectorId,
        type: "event",
        timestamp: new Date().toISOString(),
        correlation_id: randomUUID(),
        data: {
          event_id: randomUUID(),
          tenant_id: tenantId,
          actor_id: rejectorId,
          type: "evidence.redaction_rejected",
          occurred_at: new Date().toISOString(),
          correlation_id: randomUUID(),
          schema_version: "1.0",
          evidence_refs: [redaction.evidenceId],
          payload: {
            redaction_id: redactionId,
            evidence_id: redaction.evidenceId,
            reason,
          },
          signatures: [],
        } as any,
        evidence_refs: [redaction.evidenceId],
      });

      logger.info("Evidence redaction rejected", {
        redaction_id: redactionId,
        evidence_id: redaction.evidenceId,
        rejector_id: rejectorId,
        reason,
      });

      return this.mapToRedactionEntry(updated);
    } catch (error) {
      logger.error("Failed to reject evidence redaction", {
        error: error instanceof Error ? error.message : String(error),
        redaction_id: redactionId,
        rejector_id: rejectorId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Apply redaction to evidence
   */
  private async applyRedactionToEvidence(redactionId: string): Promise<void> {
    try {
      const redaction = await db.evidenceRedaction.findUnique({
        where: { id: redactionId },
      });

      if (!redaction || redaction.status !== "APPROVED") {
        return;
      }

      // Update evidence with redacted content
      await db.evidence.update({
        where: { id: redaction.evidenceId },
        data: {
          contentRaw: redaction.afterContent || undefined,
          contentNormalized: redaction.afterContent || undefined,
          piiRedacted: true,
          piiRedactionMap: redaction.redactionMap as any,
        },
      });

      // Update redaction status
      await db.evidenceRedaction.update({
        where: { id: redactionId },
        data: {
          status: "APPLIED",
        },
      });

      logger.info("Evidence redaction applied", {
        redaction_id: redactionId,
        evidence_id: redaction.evidenceId,
      });
    } catch (error) {
      logger.error("Failed to apply evidence redaction", {
        error: error instanceof Error ? error.message : String(error),
        redaction_id: redactionId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Get redaction history for evidence
   */
  async getRedactionHistory(evidenceId: string): Promise<RedactionEntry[]> {
    const redactions = await db.evidenceRedaction.findMany({
      where: { evidenceId },
      orderBy: { createdAt: "desc" },
    });

    return redactions.map((r) => this.mapToRedactionEntry(r));
  }

  /**
   * Get redaction by ID
   */
  async getRedaction(redactionId: string): Promise<RedactionEntry | null> {
    const redaction = await db.evidenceRedaction.findUnique({
      where: { id: redactionId },
    });

    if (!redaction) {
      return null;
    }

    return this.mapToRedactionEntry(redaction);
  }

  /**
   * Apply redaction map to content
   */
  private applyRedaction(content: string, redactionMap: Record<string, string>): string {
    let redacted = content;

    for (const [original, replacement] of Object.entries(redactionMap)) {
      // Use global replace with case-insensitive matching
      const regex = new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      redacted = redacted.replace(regex, replacement);
    }

    return redacted;
  }

  /**
   * Map database record to RedactionEntry
   */
  private mapToRedactionEntry(redaction: any): RedactionEntry {
    return {
      id: redaction.id,
      evidence_id: redaction.evidenceId,
      tenant_id: redaction.tenantId,
      redacted_by: redaction.redactedBy,
      approved_by: redaction.approvedBy || undefined,
      before_content: redaction.beforeContent || undefined,
      after_content: redaction.afterContent || undefined,
      redaction_map: (redaction.redactionMap as Record<string, string>) || {},
      reason: redaction.reason || undefined,
      status: redaction.status as RedactionStatus,
      created_at: redaction.createdAt.toISOString(),
      approved_at: redaction.approvedAt?.toISOString() || undefined,
      metadata: (redaction.metadata as Record<string, unknown>) || undefined,
    };
  }
}
