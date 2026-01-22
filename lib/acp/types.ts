/**
 * Agent Communication Protocol (ACP)
 * 
 * Purpose: Reliable, auditable agent-to-agent and UI-to-agent messaging.
 * Guarantees: Idempotency, retries, ordering within correlation, signed envelopes, full audit trail.
 */

export type ACPMessageType =
  | "task.request"
  | "task.update"
  | "task.result"
  | "tool.call"
  | "tool.result"
  | "policy.check"
  | "approval.request"
  | "approval.decision"
  | "event.emit";

export interface ACPMessageEnvelope {
  /** Unique message ID (UUID v4) */
  message_id: string;
  /** Tenant/organization ID */
  tenant_id: string;
  /** Actor ID (user, agent, system) */
  actor_id: string;
  /** Message type */
  type: ACPMessageType;
  /** Timestamp (ISO 8601) */
  timestamp: string;
  /** Correlation ID for grouping related messages */
  correlation_id: string;
  /** Causation ID (parent message that triggered this) */
  causation_id?: string;
  /** Schema version for forward compatibility */
  schema_version: string;
  /** Message payload (type-specific) */
  payload: ACPMessagePayload;
  /** Digital signatures for integrity */
  signatures: ACPSignature[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export type ACPMessagePayload =
  | TaskRequestPayload
  | TaskUpdatePayload
  | TaskResultPayload
  | ToolCallPayload
  | ToolResultPayload
  | PolicyCheckPayload
  | ApprovalRequestPayload
  | ApprovalDecisionPayload
  | EventEmitPayload;

export interface TaskRequestPayload {
  task_id: string;
  task_type: string;
  parameters: Record<string, unknown>;
  priority?: number;
  deadline?: string;
  required_approvals?: string[];
}

export interface TaskUpdatePayload {
  task_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress?: number;
  message?: string;
}

export interface TaskResultPayload {
  task_id: string;
  status: "completed" | "failed";
  result?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  evidence_refs?: string[];
}

export interface ToolCallPayload {
  call_id: string;
  tool_name: string;
  tool_version?: string;
  parameters: Record<string, unknown>;
  context?: {
    correlation_id: string;
    evidence_refs?: string[];
  };
}

export interface ToolResultPayload {
  call_id: string;
  success: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
  cost?: {
    tokens?: number;
    credits?: number;
    currency?: string;
  };
}

export interface PolicyCheckPayload {
  check_id: string;
  policy_type: string;
  resource: {
    type: string;
    id: string;
  };
  action: string;
  context?: Record<string, unknown>;
}

export interface ApprovalRequestPayload {
  approval_id: string;
  resource_type: string;
  resource_id: string;
  action: string;
  requester_id: string;
  approvers: string[];
  evidence_refs?: string[];
  metadata?: Record<string, unknown>;
}

export interface ApprovalDecisionPayload {
  approval_id: string;
  decision: "approved" | "rejected";
  approver_id: string;
  reason?: string;
  timestamp: string;
}

export interface EventEmitPayload {
  event_type: string;
  event_data: Record<string, unknown>;
  evidence_refs?: string[];
}

export interface ACPSignature {
  signer_id: string;
  algorithm: string;
  signature: string;
  timestamp: string;
}

/**
 * Transport strategy: HTTP(S)/WebSocket for online; optional mesh fallback
 */
export interface ACPTransport {
  send(envelope: ACPMessageEnvelope): Promise<void>;
  receive(
    handler: (envelope: ACPMessageEnvelope) => Promise<void>
  ): Promise<void>;
  close(): Promise<void>;
}

/**
 * ACP Client for sending/receiving messages
 */
export interface ACPClient {
  send(
    type: ACPMessageType,
    payload: ACPMessagePayload,
    options?: {
      correlation_id?: string;
      causation_id?: string;
    }
  ): Promise<string>; // Returns message_id

  on(
    type: ACPMessageType,
    handler: (envelope: ACPMessageEnvelope) => Promise<void>
  ): void;

  off(type: ACPMessageType, handler: (envelope: ACPMessageEnvelope) => Promise<void>): void;
}
