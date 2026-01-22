/**
 * MCP Tool Registry Implementation
 */

import type {
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPToolRegistry,
} from "@/lib/mcp/types";
import { BUILTIN_MCP_TOOLS } from "@/lib/mcp/types";
import { SignalIngestionService } from "@/lib/signals/ingestion";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { DatabaseBeliefGraphService } from "@/lib/graph/belief-implementation";
import { DomainPublisher } from "@/lib/publishing/domain-publisher";
import { AIAnswerEvaluationHarness } from "@/lib/evaluation/harness";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { db } from "@/lib/db/client";

export class InMemoryMCPToolRegistry implements MCPToolRegistry {
  private tools = new Map<string, MCPTool>();
  private signalIngestion: SignalIngestionService;
  private evidenceVault: DatabaseEvidenceVault;
  private beliefGraph: DatabaseBeliefGraphService;
  private domainPublisher: DomainPublisher;
  private evaluationHarness: AIAnswerEvaluationHarness;

  constructor() {
    // Register built-in tools
    for (const tool of BUILTIN_MCP_TOOLS) {
      this.register(tool);
    }

    // Initialize services
    this.evidenceVault = new DatabaseEvidenceVault();
    const eventStore = new DatabaseEventStore();
    this.signalIngestion = new SignalIngestionService(this.evidenceVault, eventStore);
    this.beliefGraph = new DatabaseBeliefGraphService();
    this.domainPublisher = new DomainPublisher();
    this.evaluationHarness = new AIAnswerEvaluationHarness();
  }

  register(tool: MCPTool): void {
    const key = this.getKey(tool.name, tool.version);
    this.tools.set(key, tool);
  }

  get(name: string, version?: string): MCPTool | null {
    const key = this.getKey(name, version);
    return this.tools.get(key) || null;
  }

  list(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  async call(call: MCPToolCall): Promise<MCPToolResult> {
    const tool = this.get(call.tool_name, call.tool_version);
    if (!tool) {
      return {
        call_id: call.call_id,
        success: false,
        error: {
          code: "TOOL_NOT_FOUND",
          message: `Tool ${call.tool_name} not found`,
        },
      };
    }

    // Validate input schema
    const validationError = this.validateInput(call.parameters, tool.inputSchema);
    if (validationError) {
      return {
        call_id: call.call_id,
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: validationError,
        },
      };
    }

    // Check evidence requirements
    if (tool.requires_evidence) {
      const evidenceRefs = call.context?.evidence_refs || [];
      if (evidenceRefs.length === 0) {
        return {
          call_id: call.call_id,
          success: false,
          error: {
            code: "EVIDENCE_REQUIRED",
            message: `Tool ${call.tool_name} requires evidence references`,
          },
        };
      }
    }

    const startTime = Date.now();
    let tokensUsed = 0;

    try {
      // Execute tool based on name
      let result: unknown;
      let evidenceRefs: string[] = call.context?.evidence_refs || [];

      switch (call.tool_name) {
        case "ingest_signal":
          result = await this.executeIngestSignal(call.parameters);
          break;

        case "query_evidence":
          result = await this.executeQueryEvidence(call.parameters);
          break;

        case "query_graph":
          result = await this.executeQueryGraph(call.parameters);
          break;

        case "publish_artifact":
          result = await this.executePublishArtifact(call.parameters);
          break;

        case "run_evaluation":
          result = await this.executeRunEvaluation(call.parameters);
          break;

        default:
          return {
            call_id: call.call_id,
            success: false,
            error: {
              code: "TOOL_NOT_IMPLEMENTED",
              message: `Tool ${call.tool_name} is not implemented`,
            },
          };
      }

      // Calculate cost
      const executionTime = Date.now() - startTime;
      const cost = tool.cost
        ? {
            tokens: tokensUsed || tool.cost.tokens || 0,
            credits: tool.cost.credits || 0,
            currency: tool.cost.currency || "USD",
          }
        : undefined;

      return {
        call_id: call.call_id,
        success: true,
        result,
        evidence_refs: evidenceRefs,
        cost,
      };
    } catch (error) {
      return {
        call_id: call.call_id,
        success: false,
        error: {
          code: "EXECUTION_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
          details: error,
        },
      };
    }
  }

  /**
   * Validate input parameters against JSON Schema
   */
  private validateInput(
    parameters: Record<string, unknown>,
    schema: Record<string, unknown>
  ): string | null {
    // Use Zod for validation if available, otherwise use JSON Schema validation
    try {
      // Try to use ajv if available
      const Ajv = require("ajv");
      const ajv = new Ajv({ allErrors: true });
      const validate = ajv.compile(schema);
      const valid = validate(parameters);
      
      if (!valid) {
        const errors = validate.errors?.map((e: any) => `${e.instancePath} ${e.message}`).join(", ");
        return `Validation failed: ${errors}`;
      }
      
      return null;
    } catch {
      // Fallback to manual validation if ajv not available
      if (schema.type !== "object") {
        return "Schema type must be object";
      }

      const properties = schema.properties as Record<string, any> | undefined;
      const required = schema.required as string[] | undefined;

      if (!properties) {
        return null;
      }

      // Check required fields
      if (required) {
        for (const field of required) {
          if (!(field in parameters)) {
            return `Missing required field: ${field}`;
          }
        }
      }

      // Check property types with enhanced validation
      for (const [key, value] of Object.entries(parameters)) {
        const propSchema = properties[key];
        if (!propSchema) {
          if (schema.additionalProperties === false) {
            return `Unknown property: ${key}`;
          }
          continue;
        }

        const expectedType = propSchema.type;
        const actualType = Array.isArray(value) ? "array" : typeof value;

        if (expectedType === "string" && actualType !== "string") {
          return `Field ${key} must be a string`;
        }
        if (expectedType === "number" && actualType !== "number") {
          return `Field ${key} must be a number`;
        }
        if (expectedType === "boolean" && actualType !== "boolean") {
          return `Field ${key} must be a boolean`;
        }
        if (expectedType === "object" && (actualType !== "object" || Array.isArray(value))) {
          return `Field ${key} must be an object`;
        }
        if (expectedType === "array" && actualType !== "array") {
          return `Field ${key} must be an array`;
        }
      }

      return null;
    }
  }

  private async executeIngestSignal(params: Record<string, unknown>): Promise<unknown> {
    const source = params.source as string;
    const content = params.content as string;
    const metadata = params.metadata as Record<string, unknown> || {};
    const tenantId = metadata.tenant_id as string || "";

    // Create a simple connector
    const connector = {
      name: "mcp-ingest-tool",
      ingest: async () => [],
    };

    const signal = {
      tenant_id: tenantId,
      source: {
        type: source,
        id: metadata.source_id as string || `source-${Date.now()}`,
        url: metadata.url as string || "",
      },
      content: {
        raw: content,
        normalized: content,
        language: "en",
        pii_redacted: false,
      },
      compliance: {
        source_allowed: true,
        collection_method: "api",
        retention_policy: "90 days",
      },
      metadata,
    };

    const evidence_id = await this.signalIngestion.ingestSignal(signal, connector);

    return {
      signal_id: evidence_id,
      evidence_id,
      status: "ingested",
    };
  }

  private async executeQueryEvidence(params: Record<string, unknown>): Promise<unknown> {
    const query = params.query as string;
    const filters = params.filters as Record<string, unknown> || {};
    const tenantId = filters.tenant_id as string || "";

    // Use semantic search if query provided, otherwise use query method
    if (query) {
      const evidence = await this.evidenceVault.search(query, tenantId, {
        limit: (filters.limit as number) || 10,
        min_relevance: (filters.min_relevance as number) || 0.3,
      });
      return {
        evidence,
        count: evidence.length,
        query,
      };
    }

    const evidence = await this.evidenceVault.query({
      tenant_id: tenantId,
      type: filters.type as string,
      source_type: filters.source_type as string,
      created_after: filters.created_after as string,
      created_before: filters.created_before as string,
    });

    return {
      evidence,
      count: evidence.length,
    };
  }

  private async executeQueryGraph(params: Record<string, unknown>): Promise<unknown> {
    const nodeId = params.node_id as string;
    const pathDepth = (params.path_depth as number) || 3;

    if (!nodeId) {
      throw new Error("node_id is required");
    }

    // Get node
    const node = await db.beliefNode.findUnique({
      where: { id: nodeId },
      include: {
        fromEdges: {
          include: { toNode: true },
        },
        toEdges: {
          include: { fromNode: true },
        },
      },
    });

    if (!node) {
      return { error: "Node not found" };
    }

    // Build paths using BFS with proper graph traversal
    const paths: Array<{ nodes: string[]; edges: string[] }> = [];
    const queue: Array<{ nodeId: string; path: string[]; edges: string[]; depth: number }> = [
      { nodeId, path: [nodeId], edges: [], depth: 0 },
    ];
    const visited = new Map<string, number>(); // Track best depth for each node

    while (queue.length > 0 && paths.length < 100) { // Limit paths
      const { nodeId: currentId, path, edges, depth } = queue.shift()!;

      if (depth >= pathDepth) {
        continue;
      }

      // Get current node
      const currentNode = await db.beliefNode.findUnique({
        where: { id: currentId },
        include: {
          fromEdges: { include: { toNode: true } },
          toEdges: { include: { fromNode: true } },
        },
      });

      if (!currentNode) {
        continue;
      }

      // Get all connected edges
      const connectedEdges = [
        ...currentNode.fromEdges.map((e) => ({ ...e, toNodeId: e.toNodeId })),
        ...currentNode.toEdges.map((e) => ({ ...e, fromNodeId: e.fromNodeId })),
      ];

      for (const edge of connectedEdges) {
        const nextNodeId = edge.fromNodeId === currentId ? edge.toNodeId : edge.fromNodeId;
        const nextDepth = depth + 1;

        // Skip if already visited at better depth
        const existingDepth = visited.get(nextNodeId);
        if (existingDepth !== undefined && existingDepth <= nextDepth) {
          continue;
        }

        visited.set(nextNodeId, nextDepth);

        const newPath = [...path, nextNodeId];
        const newEdges = [...edges, edge.id];

        // Add path if it's complete enough
        if (newPath.length >= 2) {
          paths.push({
            nodes: newPath,
            edges: newEdges,
          });
        }

        // Continue traversal
        if (nextDepth < pathDepth) {
          queue.push({
            nodeId: nextNodeId,
            path: newPath,
            edges: newEdges,
            depth: nextDepth,
          });
        }
      }
    }

    return {
      node: {
        id: node.id,
        type: node.type,
        content: node.content,
        trust_score: node.trustScore,
      },
      paths,
      path_count: paths.length,
    };
  }

  private async executePublishArtifact(params: Record<string, unknown>): Promise<unknown> {
    const artifactId = params.artifact_id as string;
    const targetUrl = params.target_url as string;

    if (!artifactId) {
      throw new Error("artifact_id is required");
    }

    // Get artifact
    const artifact = await db.aAALArtifact.findUnique({
      where: { id: artifactId },
    });

    if (!artifact) {
      throw new Error("Artifact not found");
    }

    // Publish
    const publishedUrl = await this.domainPublisher.publish({
      artifactId,
      content: artifact.content as string,
      title: artifact.title,
      url: targetUrl,
      metadata: {},
    });

    return {
      artifact_id: artifactId,
      published_url: publishedUrl,
      status: "published",
    };
  }

  private async executeRunEvaluation(params: Record<string, unknown>): Promise<unknown> {
    const promptId = params.prompt_id as string;
    const model = params.model as string;

    if (!promptId || !model) {
      throw new Error("prompt_id and model are required");
    }

    // Load prompt from database or use promptId as prompt text
    let prompt: string;
    try {
      // Try to load from a prompts table if it exists
      const promptRecord = await db.$queryRawUnsafe(
        `SELECT content FROM "Prompt" WHERE id = $1 LIMIT 1`,
        promptId
      ).catch(() => null);
      
      if (promptRecord && Array.isArray(promptRecord) && promptRecord.length > 0) {
        prompt = (promptRecord[0] as any).content || promptId;
      } else {
        prompt = promptId; // Use promptId as prompt text if not found in DB
      }
    } catch {
      prompt = promptId; // Fallback to using promptId as prompt
    }

    // Generate response using the specified model
    const { LLMProvider } = await import("../llm/providers");
    const llmProvider = new LLMProvider();
    const llmResponse = await llmProvider.call({
      model,
      prompt,
      temperature: 0.7,
      max_tokens: 2000,
    });
    const response = llmResponse.text;

    const evaluation = await this.evaluationHarness.evaluate(
      prompt,
      response,
      [],
      { model }
    );

    return {
      evaluation_id: `eval-${Date.now()}`,
      prompt_id: promptId,
      model,
      scores: {
        citation_capture: evaluation.citation_capture_score,
        narrative_drift: evaluation.narrative_drift_score,
        harmful_resurfacing: evaluation.harmful_resurfacing_score,
        overall: evaluation.overall_score,
      },
      details: evaluation.details,
    };
  }

  private getKey(name: string, version?: string): string {
    return version ? `${name}@${version}` : name;
  }
}
