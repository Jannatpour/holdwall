/**
 * Model Context Protocol (MCP) Integration
 * 
 * Standardize tool access: ingestion tools, evidence query, graph query, publish portal, eval runner.
 * Orchestrator chooses tools/models based on policies, costs, and evaluation outcomes.
 */

export interface MCPTool {
  /** Tool identifier */
  name: string;
  /** Tool version */
  version?: string;
  /** Tool description */
  description: string;
  /** Input schema (JSON Schema) */
  inputSchema: Record<string, unknown>;
  /** Output schema (JSON Schema) */
  outputSchema?: Record<string, unknown>;
  /** Cost per invocation */
  cost?: {
    tokens?: number;
    credits?: number;
    currency?: string;
  };
  /** Policy requirements */
  requires_approval?: boolean;
  /** Evidence requirements */
  requires_evidence?: boolean;
}

export interface MCPToolCall {
  /** Unique call ID */
  call_id: string;
  /** Tool name */
  tool_name: string;
  /** Tool version */
  tool_version?: string;
  /** Input parameters */
  parameters: Record<string, unknown>;
  /** Context (correlation_id, evidence_refs, etc.) */
  context?: {
    correlation_id: string;
    evidence_refs?: string[];
    actor_id?: string;
  };
}

export interface MCPToolResult {
  /** Call ID */
  call_id: string;
  /** Success flag */
  success: boolean;
  /** Result data */
  result?: unknown;
  /** Error (if failed) */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  /** Cost incurred */
  cost?: {
    tokens?: number;
    credits?: number;
    currency?: string;
  };
  /** Evidence references generated */
  evidence_refs?: string[];
}

/**
 * MCP Tool Registry
 */
export interface MCPToolRegistry {
  register(tool: MCPTool): void;
  get(name: string, version?: string): MCPTool | null;
  list(): MCPTool[];
  call(call: MCPToolCall): Promise<MCPToolResult>;
}

/**
 * MCP Orchestrator
 * 
 * Chooses tools/models based on:
 * - Policies
 * - Costs
 * - Evaluation outcomes
 * - Availability
 */
export interface MCPOrchestrator {
  selectTool(
    task: {
      type: string;
      requirements?: {
        cost_limit?: number;
        approval_required?: boolean;
        evidence_required?: boolean;
      };
    }
  ): Promise<MCPTool | null>;

  execute(
    tool_call: MCPToolCall,
    options?: {
      require_approval?: boolean;
      track_cost?: boolean;
    }
  ): Promise<MCPToolResult>;
}

/**
 * Built-in MCP Tools
 */
export const BUILTIN_MCP_TOOLS: MCPTool[] = [
  {
    name: "ingest_signal",
    description: "Ingest a signal from a source",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string" },
        content: { type: "string" },
        metadata: { type: "object" },
      },
      required: ["source", "content"],
    },
  },
  {
    name: "query_evidence",
    description: "Query the evidence vault",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        filters: { type: "object" },
      },
      required: ["query"],
    },
  },
  {
    name: "query_graph",
    description: "Query the belief graph",
    inputSchema: {
      type: "object",
      properties: {
        node_id: { type: "string" },
        path_depth: { type: "number" },
      },
    },
  },
  {
    name: "publish_artifact",
    description: "Publish an AAAL artifact to PADL",
    inputSchema: {
      type: "object",
      properties: {
        artifact_id: { type: "string" },
        target_url: { type: "string" },
      },
      required: ["artifact_id"],
    },
    requires_approval: true,
  },
  {
    name: "run_evaluation",
    description: "Run AI Answer Evaluation Harness",
    inputSchema: {
      type: "object",
      properties: {
        prompt_id: { type: "string" },
        model: { type: "string" },
      },
      required: ["prompt_id", "model"],
    },
  },
];
