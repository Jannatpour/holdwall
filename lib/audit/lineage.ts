/**
 * Audit-first message/event lineage
 * 
 * Tracks full audit trail of:
 * - ACP messages (agent communications)
 * - Events (domain events)
 * - Evidence references
 * - Policy checks
 * - Approvals
 */

import type { ACPMessageEnvelope } from "@/lib/acp/types";
import type { EventEnvelope } from "@/lib/events/types";

export interface AuditEntry {
  /** Unique audit entry ID */
  audit_id: string;
  /** Timestamp */
  timestamp: string;
  /** Entry type */
  type: "acp_message" | "event" | "policy_check" | "approval" | "evidence_access" | "mcp_tool_execution";
  /** Tenant ID */
  tenant_id: string;
  /** Actor ID */
  actor_id: string;
  /** Correlation ID */
  correlation_id: string;
  /** Causation ID */
  causation_id?: string;
  /** Entry data */
  data: ACPMessageEnvelope | EventEnvelope | PolicyCheckEntry | ApprovalEntry | EvidenceAccessEntry;
  /** Evidence references */
  evidence_refs: string[];
}

export interface PolicyCheckEntry {
  check_id: string;
  policy_type: string;
  resource: {
    type: string;
    id: string;
  };
  action: string;
  result: "allowed" | "denied";
  reason?: string;
}

export interface ApprovalEntry {
  approval_id: string;
  resource_type: string;
  resource_id: string;
  action: string;
  decision: "approved" | "rejected";
  approver_id: string;
  reason?: string;
}

export interface EvidenceAccessEntry {
  evidence_id: string;
  access_type: "read" | "write" | "delete";
  actor_id: string;
}

/**
 * Audit Log interface
 */
export interface AuditLog {
  append(entry: AuditEntry): Promise<void>;
  get(audit_id: string): Promise<AuditEntry | null>;
  query(filters: {
    tenant_id?: string;
    type?: string;
    correlation_id?: string;
    actor_id?: string;
    timestamp_after?: string;
    timestamp_before?: string;
  }): Promise<AuditEntry[]>;
  getLineage(correlation_id: string): Promise<AuditEntry[]>;
}

/**
 * Lineage builder: reconstruct full chain of events/messages
 */
export class LineageBuilder {
  constructor(private auditLog: AuditLog) {}

  async buildLineage(correlation_id: string): Promise<LineageChain> {
    const entries = await this.auditLog.getLineage(correlation_id);
    
    // Build tree structure
    const rootEntries = entries.filter((e) => !e.causation_id);
    const childMap = new Map<string, AuditEntry[]>();
    
    for (const entry of entries) {
      if (entry.causation_id) {
        if (!childMap.has(entry.causation_id)) {
          childMap.set(entry.causation_id, []);
        }
        childMap.get(entry.causation_id)!.push(entry);
      }
    }

    return {
      correlation_id,
      root_entries: rootEntries,
      child_map: Object.fromEntries(childMap),
      all_entries: entries,
      evidence_refs: Array.from(
        new Set(entries.flatMap((e) => e.evidence_refs))
      ),
    };
  }
}

export interface LineageChain {
  correlation_id: string;
  root_entries: AuditEntry[];
  child_map: Record<string, AuditEntry[]>;
  all_entries: AuditEntry[];
  evidence_refs: string[];
}
