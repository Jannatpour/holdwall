/**
 * Production Audit Log Implementation
 * Database-backed audit log
 */

import { db } from "@/lib/db/client";
import type { AuditLog, AuditEntry } from "./lineage";

export class DatabaseAuditLog implements AuditLog {
  async append(entry: AuditEntry): Promise<void> {
    // Store audit entry in database
    // In production, use dedicated audit table or event store
    // For now, we'll use the Event table
    await db.event.create({
      data: {
        id: entry.audit_id,
        tenantId: entry.tenant_id,
        actorId: entry.actor_id,
        type: `audit.${entry.type}`,
        occurredAt: new Date(entry.timestamp),
        correlationId: entry.correlation_id,
        causationId: entry.causation_id,
        schemaVersion: "1.0",
        payload: entry.data as any,
        signatures: [] as any,
        metadata: {
          audit_type: entry.type,
        } as any,
      },
    });
  }

  async get(audit_id: string): Promise<AuditEntry | null> {
    const event = await db.event.findUnique({
      where: { id: audit_id },
    });

    if (!event) {
      return null;
    }

    return {
      audit_id: event.id,
      tenant_id: event.tenantId,
      actor_id: event.actorId,
      type: (event.metadata as any)?.audit_type || "event",
      timestamp: event.occurredAt.toISOString(),
      correlation_id: event.correlationId,
      causation_id: event.causationId || undefined,
      data: event.payload as any,
      evidence_refs: [], // Would need to join with EventEvidence
    };
  }

  async query(filters: {
    tenant_id?: string;
    type?: string;
    correlation_id?: string;
    actor_id?: string;
    timestamp_after?: string;
    timestamp_before?: string;
  }): Promise<AuditEntry[]> {
    const where: any = {};

    if (filters.tenant_id) {
      where.tenantId = filters.tenant_id;
    }
    if (filters.type) {
      where.type = `audit.${filters.type}`;
    }
    if (filters.correlation_id) {
      where.correlationId = filters.correlation_id;
    }
    if (filters.actor_id) {
      where.actorId = filters.actor_id;
    }
    if (filters.timestamp_after || filters.timestamp_before) {
      where.occurredAt = {};
      if (filters.timestamp_after) {
        where.occurredAt.gte = new Date(filters.timestamp_after);
      }
      if (filters.timestamp_before) {
        where.occurredAt.lte = new Date(filters.timestamp_before);
      }
    }

    const events = await db.event.findMany({
      where,
      orderBy: { occurredAt: "desc" },
    });

    return events.map((event) => ({
      audit_id: event.id,
      tenant_id: event.tenantId,
      actor_id: event.actorId,
      type: (event.metadata as any)?.audit_type || "event",
      timestamp: event.occurredAt.toISOString(),
      correlation_id: event.correlationId,
      causation_id: event.causationId || undefined,
      data: event.payload as any,
      evidence_refs: [],
    }));
  }

  async getLineage(correlation_id: string): Promise<AuditEntry[]> {
    return this.query({ correlation_id });
  }
}
