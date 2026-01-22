/**
 * AI Orchestrator
 * Coordinates RAG, KAG, and LLM calls with MCP tool integration
 * Now uses ModelRouter for intelligent model selection with fallbacks
 */

import { RAGPipeline } from "./rag";
import { KAGPipeline } from "./kag";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { ModelRouter, type AITaskType } from "./router";
import { getCostTracker } from "./cost-tracker";
import type { MCPToolCall, MCPToolResult } from "@/lib/mcp/types";

export interface AIOrchestrationRequest {
  query: string;
  tenant_id: string;
  use_rag?: boolean;
  use_kag?: boolean;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface AIOrchestrationResponse {
  response: string;
  context: {
    rag?: {
      evidence_count: number;
      evidence_ids: string[];
    };
    kag?: {
      nodes_count: number;
      edges_count: number;
    };
  };
  citations: string[];
  metadata: {
    model_used: string;
    tokens_used?: number;
    cost?: number;
    latency_ms: number;
    fallback_used?: boolean;
    primaryModel?: string;
    fallbackChain?: string[];
    circuitBreakerState?: string;
  };
}

export class AIOrchestrator {
  private ragPipeline: RAGPipeline;
  private kagPipeline: KAGPipeline;
  private modelRouter: ModelRouter;
  private costTracker = getCostTracker();

  constructor(evidenceVault: DatabaseEvidenceVault) {
    this.ragPipeline = new RAGPipeline(evidenceVault);
    this.kagPipeline = new KAGPipeline();
    this.modelRouter = new ModelRouter(this.costTracker);
  }

  /**
   * Orchestrate AI response with RAG/KAG augmentation
   */
  async orchestrate(
    request: AIOrchestrationRequest
  ): Promise<AIOrchestrationResponse> {
    const startTime = Date.now();
    const citations: string[] = [];
    const context: AIOrchestrationResponse["context"] = {};

    // Step 1: RAG retrieval (if enabled)
    let ragContext = null;
    if (request.use_rag !== false) {
      ragContext = await this.ragPipeline.buildContext(
        request.query,
        request.tenant_id
      );
      citations.push(...ragContext.evidence.map((e) => e.evidence_id));
      context.rag = {
        evidence_count: ragContext.evidence.length,
        evidence_ids: ragContext.evidence.map((e) => e.evidence_id),
      };
    }

    // Step 2: KAG retrieval (if enabled)
    let kagContext = null;
    if (request.use_kag !== false) {
      kagContext = await this.kagPipeline.retrieve(
        request.query,
        request.tenant_id
      );
      context.kag = {
        nodes_count: kagContext.nodes.length,
        edges_count: kagContext.edges.length,
      };
    }

    // Step 3: Build augmented prompt
    const augmentedPrompt = this.buildAugmentedPrompt(
      request.query,
      ragContext,
      kagContext
    );

    // Step 4: Determine task type and route to optimal model
    const taskType: AITaskType = this.determineTaskType(request.query, request.use_rag, request.use_kag);
    
    // Use ModelRouter for intelligent model selection with fallbacks
    const routingResult = await this.modelRouter.route(
      {
        model: request.model || "gpt-4o", // Will be overridden by router
        prompt: this.buildAugmentedPrompt(request.query, ragContext, kagContext),
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 2000,
        system_prompt: "You are a helpful assistant that provides accurate, evidence-based responses. Always cite evidence IDs when referencing specific evidence.",
      },
      {
        tenantId: request.tenant_id,
        taskType,
        latencyConstraint: 5000, // 5s max for generate
        citationFaithfulness: 0.9, // Require high citation faithfulness
      }
    );

    // Record cost
    await this.costTracker.recordCost({
      tenantId: request.tenant_id,
      model: routingResult.model,
      provider: routingResult.provider,
      taskType,
      cost: routingResult.cost,
      tokens: routingResult.response.tokens_used,
      timestamp: new Date(),
    });

    return {
      response: routingResult.response.text,
      context,
      citations,
      metadata: {
        model_used: routingResult.model,
        tokens_used: routingResult.response.tokens_used,
        cost: routingResult.cost,
        latency_ms: routingResult.latency,
        fallback_used: routingResult.fallbackUsed,
        primaryModel: routingResult.metadata.primaryModel,
        fallbackChain: routingResult.metadata.fallbackChain,
        circuitBreakerState: routingResult.metadata.circuitBreakerState,
      },
    };
  }

  /**
   * Orchestrate with true token streaming for AG-UI.
   *
   * This streams only the LLM generation step; retrieval steps are emitted as structured events by callers.
   */
  async orchestrateStream(
    request: AIOrchestrationRequest,
    opts: {
      onDelta: (delta: string) => void;
      signal?: AbortSignal;
      onStage?: (stage: { name: string; status: "start" | "end"; metadata?: Record<string, unknown> }) => void;
    }
  ): Promise<AIOrchestrationResponse> {
    const startTime = Date.now();
    const citations: string[] = [];
    const context: AIOrchestrationResponse["context"] = {};

    // Step 1: RAG retrieval (if enabled)
    let ragContext = null;
    if (request.use_rag !== false) {
      opts.onStage?.({ name: "rag.buildContext", status: "start" });
      ragContext = await this.ragPipeline.buildContext(request.query, request.tenant_id);
      opts.onStage?.({
        name: "rag.buildContext",
        status: "end",
        metadata: { evidence_count: ragContext.evidence.length },
      });
      citations.push(...ragContext.evidence.map((e) => e.evidence_id));
      context.rag = {
        evidence_count: ragContext.evidence.length,
        evidence_ids: ragContext.evidence.map((e) => e.evidence_id),
      };
    }

    // Step 2: KAG retrieval (if enabled)
    let kagContext = null;
    if (request.use_kag !== false) {
      opts.onStage?.({ name: "kag.retrieve", status: "start" });
      kagContext = await this.kagPipeline.retrieve(request.query, request.tenant_id);
      opts.onStage?.({
        name: "kag.retrieve",
        status: "end",
        metadata: { nodes_count: kagContext.nodes.length, edges_count: kagContext.edges.length },
      });
      context.kag = {
        nodes_count: kagContext.nodes.length,
        edges_count: kagContext.edges.length,
      };
    }

    // Step 3: Determine task type and route
    const taskType: AITaskType = this.determineTaskType(request.query, request.use_rag, request.use_kag);
    const augmentedPrompt = this.buildAugmentedPrompt(request.query, ragContext, kagContext);

    opts.onStage?.({ name: "llm.generate", status: "start" });
    const routingResult = await this.modelRouter.routeStream(
      {
        model: request.model || "gpt-4o",
        prompt: augmentedPrompt,
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 2000,
        system_prompt:
          "You are a helpful assistant that provides accurate, evidence-based responses. Always cite evidence IDs when referencing specific evidence.",
      },
      {
        tenantId: request.tenant_id,
        taskType,
        latencyConstraint: 5000,
        citationFaithfulness: 0.9,
      },
      { onDelta: opts.onDelta, signal: opts.signal }
    );
    opts.onStage?.({ name: "llm.generate", status: "end" });

    return {
      response: routingResult.response.text,
      context,
      citations,
      metadata: {
        model_used: routingResult.model,
        tokens_used: routingResult.response.tokens_used,
        cost: routingResult.cost,
        latency_ms: Date.now() - startTime,
        fallback_used: routingResult.fallbackUsed,
        primaryModel: routingResult.metadata.primaryModel,
        fallbackChain: routingResult.metadata.fallbackChain,
        circuitBreakerState: routingResult.metadata.circuitBreakerState,
      },
    };
  }

  /**
   * Determine task type from query and context
   */
  private determineTaskType(
    query: string,
    useRag?: boolean,
    useKag?: boolean
  ): AITaskType {
    const lowerQuery = query.toLowerCase();
    
    // Extract/cluster tasks
    if (lowerQuery.includes("extract") || lowerQuery.includes("cluster")) {
      return "extract";
    }
    
    // Judge/eval tasks
    if (lowerQuery.includes("judge") || lowerQuery.includes("evaluate") || lowerQuery.includes("verify")) {
      return "judge";
    }
    
    // Summarize tasks
    if (lowerQuery.includes("summarize") || lowerQuery.includes("summary")) {
      return "summarize";
    }
    
    // Default to generate for general queries
    return "generate";
  }

  private buildAugmentedPrompt(
    query: string,
    ragContext: any,
    kagContext: any
  ): string {
    let prompt = `Query: ${query}\n\n`;

    if (ragContext) {
      prompt += `Evidence Context:\n${ragContext.context}\n\n`;
    }

    if (kagContext) {
      prompt += `Knowledge Graph Context:\n${kagContext.context}\n\n`;
    }

    prompt += `Please provide a comprehensive answer based on the evidence and knowledge graph context above. Cite evidence IDs when referencing specific evidence.`;

    return prompt;
  }
}
