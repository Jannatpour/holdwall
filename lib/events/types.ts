/**
 * Immutable Event Envelope (used everywhere)
 * 
 * This is the contract of record. Every event must follow this structure.
 * Evidence Vault references ensure traceability.
 */

export interface EventEnvelope {
  /** Unique event ID (UUID v4) */
  event_id: string;
  /** Tenant/organization ID */
  tenant_id: string;
  /** Actor ID (user, agent, system) */
  actor_id: string;
  /** Event type (domain-specific) */
  type: string;
  /** Timestamp (ISO 8601) */
  occurred_at: string;
  /** Correlation ID for grouping related events */
  correlation_id: string;
  /** Causation ID (parent event that triggered this) */
  causation_id?: string;
  /** Schema version for forward compatibility */
  schema_version: string;
  /** Immutable evidence references */
  evidence_refs: string[];
  /** Event payload (type-specific, JSON-serializable) */
  payload: Record<string, unknown>;
  /** Digital signatures for integrity */
  signatures: EventSignature[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface EventSignature {
  signer_id: string;
  algorithm: string;
  signature: string;
  timestamp: string;
}

/**
 * Event types (domain-specific)
 */
export type EventType =
  | "signal.ingested"
  | "signal.normalized"
  | "claim.extracted"
  | "claim.clustered"
  | "graph.node.created"
  | "graph.edge.created"
  | "forecast.generated"
  | "aaal.drafted"
  | "aaal.published"
  | "approval.requested"
  | "approval.decided"
  | "playbook.executed"
  | "evidence.stored"
  | "policy.checked";

/**
 * Event Store interface
 */
export interface EventStore {
  append(event: EventEnvelope): Promise<void>;
  get(event_id: string): Promise<EventEnvelope | null>;
  query(filters: {
    tenant_id?: string;
    type?: string;
    correlation_id?: string;
    occurred_after?: string;
    occurred_before?: string;
  }): Promise<EventEnvelope[]>;
  stream(
    filters: {
      tenant_id?: string;
      type?: string;
    },
    handler: (event: EventEnvelope) => Promise<void>,
    options?: {
      signal?: AbortSignal; // For cancellation
    }
  ): Promise<void>;
}

/**
 * Event lineage: track event dependencies
 */
export interface EventLineage {
  event_id: string;
  parent_events: string[];
  child_events: string[];
  evidence_refs: string[];
  correlation_id: string;
}
