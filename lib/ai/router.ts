/**
 * AI Model Router
 * 
 * Intelligent model routing with task-based selection, automatic fallbacks,
 * circuit breakers, and cost tracking for production-grade AI orchestration.
 */

import { LLMProvider, type LLMRequest, type LLMResponse } from "@/lib/llm/providers";
import { CircuitBreaker } from "@/lib/resilience/circuit-breaker";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import type { MeteringService } from "@/lib/metering/service";
import type { CostTracker } from "./cost-tracker";

export type AITaskType = "extract" | "cluster" | "judge" | "eval" | "generate" | "summarize";

export interface ModelRoutingConfig {
  tenantId: string;
  taskType: AITaskType;
  latencyConstraint?: number; // p95 latency in ms
  costConstraint?: number; // max cost per request
  qualityConstraint?: number; // min quality score (0-1)
  citationFaithfulness?: number; // min citation faithfulness (0-1)
  meteringService?: MeteringService;
}

export interface ModelCandidate {
  model: string;
  provider: "openai" | "anthropic" | "generic";
  taskTypes: AITaskType[];
  latencyP95: number; // ms
  costPer1kTokens: number; // USD
  qualityScore: number; // 0-1
  citationFaithfulness: number; // 0-1
  priority: number; // 1-10, higher = better for this task
}

export interface RoutingResult {
  model: string;
  provider: "openai" | "anthropic" | "generic";
  response: LLMResponse;
  fallbackUsed: boolean;
  cost: number;
  latency: number;
  metadata: {
    primaryModel?: string;
    fallbackChain?: string[];
    circuitBreakerState?: string;
  };
}

export interface StreamingRoutingResult {
  model: string;
  provider: "openai" | "anthropic" | "generic";
  response: LLMResponse;
  fallbackUsed: boolean;
  cost: number;
  latency: number;
  metadata: {
    primaryModel?: string;
    fallbackChain?: string[];
    circuitBreakerState?: string;
  };
}

/**
 * Model Router with intelligent task-based routing
 */
export class ModelRouter {
  private llmProvider: LLMProvider;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private modelCandidates: ModelCandidate[] = [];
  private costTracker?: CostTracker;
  private meteringService?: MeteringService;

  constructor(costTrackerOrMetering?: CostTracker | MeteringService) {
    this.llmProvider = new LLMProvider();
    // CostTracker has meteringService, so accept either
    if (costTrackerOrMetering && 'recordCost' in costTrackerOrMetering) {
      this.costTracker = costTrackerOrMetering as CostTracker;
      this.meteringService = undefined;
    } else {
      this.meteringService = costTrackerOrMetering as MeteringService | undefined;
      this.costTracker = undefined;
    }
    this.initializeModelCandidates();
  }

  private estimateCostMicro(model: ModelCandidate, request: LLMRequest): number {
    // Keep consistent with estimateCost: assume 1000 tokens total.
    const estimatedTokens = 1000;
    const usd = (estimatedTokens / 1000) * model.costPer1kTokens;
    // micro-USD integer (ceil to avoid undercounting).
    return Math.ceil(usd * 1_000_000);
  }

  /**
   * Initialize model candidates with performance characteristics
   * Updated with latest 2026 models: o1, o3, GPT-5.2, Claude Opus 4.5, Gemini 3 Pro
   */
  private initializeModelCandidates(): void {
    this.modelCandidates = [
      // OpenAI Reasoning Models (2026) - Best for complex reasoning tasks
      {
        model: "o1-preview",
        provider: "openai",
        taskTypes: ["judge", "eval", "generate"],
        latencyP95: 8000,
        costPer1kTokens: 0.015,
        qualityScore: 0.99,
        citationFaithfulness: 0.97,
        priority: 10,
      },
      {
        model: "o1-mini",
        provider: "openai",
        taskTypes: ["judge", "eval", "generate"],
        latencyP95: 5000,
        costPer1kTokens: 0.006,
        qualityScore: 0.98,
        citationFaithfulness: 0.96,
        priority: 9,
      },
      {
        model: "o3",
        provider: "openai",
        taskTypes: ["judge", "eval", "generate"],
        latencyP95: 10000,
        costPer1kTokens: 0.025,
        qualityScore: 0.995,
        citationFaithfulness: 0.98,
        priority: 10,
      },
      {
        model: "o3-mini",
        provider: "openai",
        taskTypes: ["judge", "eval", "generate"],
        latencyP95: 6000,
        costPer1kTokens: 0.012,
        qualityScore: 0.985,
        citationFaithfulness: 0.965,
        priority: 9,
      },

      // OpenAI GPT-5 Series (2026) - Latest generation models
      {
        model: "gpt-5.2",
        provider: "openai",
        taskTypes: ["judge", "eval", "generate"],
        latencyP95: 4000,
        costPer1kTokens: 0.018,
        qualityScore: 0.98,
        citationFaithfulness: 0.96,
        priority: 9,
      },
      {
        model: "gpt-5.2-turbo",
        provider: "openai",
        taskTypes: ["judge", "eval", "generate"],
        latencyP95: 3000,
        costPer1kTokens: 0.012,
        qualityScore: 0.97,
        citationFaithfulness: 0.95,
        priority: 8,
      },
      {
        model: "gpt-5-mini",
        provider: "openai",
        taskTypes: ["extract", "cluster", "summarize", "generate"],
        latencyP95: 2000,
        costPer1kTokens: 0.003,
        qualityScore: 0.92,
        citationFaithfulness: 0.88,
        priority: 8,
      },
      {
        model: "gpt-5",
        provider: "openai",
        taskTypes: ["judge", "eval", "generate"],
        latencyP95: 4500,
        costPer1kTokens: 0.02,
        qualityScore: 0.98,
        citationFaithfulness: 0.95,
        priority: 7,
      },

      // OpenAI GPT-4o Series - Production workhorses
      {
        model: "gpt-4o",
        provider: "openai",
        taskTypes: ["judge", "eval", "generate"],
        latencyP95: 3000,
        costPer1kTokens: 0.00625,
        qualityScore: 0.95,
        citationFaithfulness: 0.92,
        priority: 8,
      },
      {
        model: "gpt-4o-mini",
        provider: "openai",
        taskTypes: ["extract", "cluster", "summarize", "generate"],
        latencyP95: 1500,
        costPer1kTokens: 0.00015,
        qualityScore: 0.85,
        citationFaithfulness: 0.80,
        priority: 9,
      },
      {
        model: "gpt-4.1",
        provider: "openai",
        taskTypes: ["judge", "eval", "generate"],
        latencyP95: 3200,
        costPer1kTokens: 0.008,
        qualityScore: 0.96,
        citationFaithfulness: 0.93,
        priority: 7,
      },
      {
        model: "gpt-4.1-mini",
        provider: "openai",
        taskTypes: ["extract", "cluster", "summarize", "generate"],
        latencyP95: 1700,
        costPer1kTokens: 0.0002,
        qualityScore: 0.88,
        citationFaithfulness: 0.84,
        priority: 8,
      },

      // Anthropic Claude (2026) - Latest models
      {
        model: "claude-opus-4.5",
        provider: "anthropic",
        taskTypes: ["judge", "eval", "generate"],
        latencyP95: 4500,
        costPer1kTokens: 0.05,
        qualityScore: 0.98,
        citationFaithfulness: 0.96,
        priority: 9,
      },
      {
        model: "claude-sonnet-4.5",
        provider: "anthropic",
        taskTypes: ["judge", "eval", "generate"],
        latencyP95: 2800,
        costPer1kTokens: 0.012,
        qualityScore: 0.95,
        citationFaithfulness: 0.93,
        priority: 8,
      },
      {
        model: "claude-haiku-4.5",
        provider: "anthropic",
        taskTypes: ["extract", "cluster", "summarize"],
        latencyP95: 1600,
        costPer1kTokens: 0.0003,
        qualityScore: 0.90,
        citationFaithfulness: 0.85,
        priority: 8,
      },
      {
        model: "claude-3-opus-20240229",
        provider: "anthropic",
        taskTypes: ["judge", "eval", "generate"],
        latencyP95: 4000,
        costPer1kTokens: 0.045,
        qualityScore: 0.96,
        citationFaithfulness: 0.94,
        priority: 7,
      },
      {
        model: "claude-3-sonnet-20240229",
        provider: "anthropic",
        taskTypes: ["judge", "eval", "generate"],
        latencyP95: 2500,
        costPer1kTokens: 0.009,
        qualityScore: 0.93,
        citationFaithfulness: 0.90,
        priority: 6,
      },
      {
        model: "claude-3-haiku-20240307",
        provider: "anthropic",
        taskTypes: ["extract", "cluster", "summarize"],
        latencyP95: 1800,
        costPer1kTokens: 0.00025,
        qualityScore: 0.88,
        citationFaithfulness: 0.82,
        priority: 7,
      },

      // Google Gemini (2026) - Latest models
      {
        model: "gemini-3-pro",
        provider: "generic",
        taskTypes: ["judge", "eval", "generate"],
        latencyP95: 3500,
        costPer1kTokens: 0.015,
        qualityScore: 0.97,
        citationFaithfulness: 0.94,
        priority: 8,
      },
      {
        model: "gemini-3-flash",
        provider: "generic",
        taskTypes: ["extract", "cluster", "summarize", "generate"],
        latencyP95: 1800,
        costPer1kTokens: 0.0005,
        qualityScore: 0.91,
        citationFaithfulness: 0.87,
        priority: 8,
      },
      {
        model: "gemini-2.0-flash-exp",
        provider: "generic",
        taskTypes: ["extract", "cluster", "summarize", "generate"],
        latencyP95: 2000,
        costPer1kTokens: 0.0004,
        qualityScore: 0.89,
        citationFaithfulness: 0.85,
        priority: 7,
      },

      // Generate tasks - Balanced
      {
        model: "gpt-4-turbo",
        provider: "openai",
        taskTypes: ["generate", "judge"],
        latencyP95: 3500,
        costPer1kTokens: 0.02,
        qualityScore: 0.94,
        citationFaithfulness: 0.91,
        priority: 6,
      },
      // Fallback models
      {
        model: "gpt-3.5-turbo",
        provider: "openai",
        taskTypes: ["extract", "cluster", "summarize", "generate"],
        latencyP95: 2000,
        costPer1kTokens: 0.001,
        qualityScore: 0.82,
        citationFaithfulness: 0.75,
        priority: 5,
      },
    ];
  }

  /**
   * Route request to optimal model with fallbacks
   * Supports learned routing via RouteLLM if enabled
   */
  async route(
    request: LLMRequest,
    config: ModelRoutingConfig
  ): Promise<RoutingResult> {
    const startTime = Date.now();
    const fallbackChain: string[] = [];

    // Try learned routing if enabled (check environment variable)
    const useLearnedRouting = process.env.ENABLE_ROUTE_LLM === "true";
    if (useLearnedRouting) {
      try {
        const { RouteLLM } = await import("./route-llm");
        const routeLLM = new RouteLLM();
        const decision = await routeLLM.route(request, {
          tenantId: config.tenantId,
          taskType: config.taskType,
          useLearnedRouting: true,
        });

        if (decision.confidence > 0.7) {
          // Use learned routing decision
          const modelCandidate = this.modelCandidates.find(
            (m) => m.model === decision.model && m.provider === decision.provider
          );

          if (modelCandidate) {
            return await this.executeWithModel(request, config, modelCandidate, decision.fallback_model);
          }
        }
      } catch (error) {
        // Fall back to rule-based routing
        logger.warn("RouteLLM failed, using rule-based routing", { error });
      }
    }

    // Select primary model (rule-based)
    const primaryModel = this.selectModel(config);
    if (!primaryModel) {
      throw new Error(`No suitable model found for task type: ${config.taskType}`);
    }

    fallbackChain.push(primaryModel.model);

    // Get or create circuit breaker for provider
    const circuitBreakerKey = `${primaryModel.provider}:${primaryModel.model}`;
    let circuitBreaker = this.circuitBreakers.get(circuitBreakerKey);
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000, // 1 minute
      });
      this.circuitBreakers.set(circuitBreakerKey, circuitBreaker);
    }

    // Check cost limits
    if (this.costTracker) {
      const costEstimate = this.estimateCost(primaryModel, request);
      const budgetCheck = await this.costTracker.checkBudget(config.tenantId, costEstimate);
      if (!budgetCheck.allowed) {
        throw new Error(
          `Cost limit exceeded for tenant ${config.tenantId}. ${budgetCheck.reason || ''}. Current: ${budgetCheck.currentDaily}, Daily Budget: ${budgetCheck.dailyBudget}`
        );
      }
    } else if (this.meteringService) {
      const costEstimateMicro = this.estimateCostMicro(primaryModel, request);
      const costCheck = await this.meteringService.increment(
        config.tenantId,
        "ai_cost_micro_usd_day",
        costEstimateMicro
      );
      if (!costCheck.allowed) {
        throw new Error(
          `Cost limit exceeded for tenant ${config.tenantId}. Current: ${costCheck.current_usage}, Limit: ${costCheck.limit}`
        );
      }
    }

    // Execute with selected model
    return await this.executeWithModel(request, config, primaryModel);
  }

  /**
   * Execute request with specific model
   */
  private async executeWithModel(
    request: LLMRequest,
    config: ModelRoutingConfig,
    model: ModelCandidate,
    fallbackModel?: string
  ): Promise<RoutingResult> {
    const startTime = Date.now();
    const fallbackChain: string[] = [model.model];

    // Get or create circuit breaker for provider
    const circuitBreakerKey = `${model.provider}:${model.model}`;
    let circuitBreaker = this.circuitBreakers.get(circuitBreakerKey);
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000, // 1 minute
      });
      this.circuitBreakers.set(circuitBreakerKey, circuitBreaker);
    }

    // Check cost limits
    if (this.costTracker) {
      const costEstimate = this.estimateCost(model, request);
      const budgetCheck = await this.costTracker.checkBudget(config.tenantId, costEstimate);
      if (!budgetCheck.allowed) {
        throw new Error(
          `Cost limit exceeded for tenant ${config.tenantId}. ${budgetCheck.reason || ''}. Current: ${budgetCheck.currentDaily}, Daily Budget: ${budgetCheck.dailyBudget}`
        );
      }
    } else if (this.meteringService) {
      const costEstimateMicro = this.estimateCostMicro(model, request);
      const costCheck = await this.meteringService.increment(
        config.tenantId,
        "ai_cost_micro_usd_day",
        costEstimateMicro
      );
      if (!costCheck.allowed) {
        throw new Error(
          `Cost limit exceeded for tenant ${config.tenantId}. Current: ${costCheck.current_usage}, Limit: ${costCheck.limit}`
        );
      }
    }

    // Try model with circuit breaker
    try {
      const response = await circuitBreaker.execute(async () => {
        return await this.llmProvider.call({
          ...request,
          model: model.model,
        });
      });

      const latency = Date.now() - startTime;
      const cost = response.cost;

      // Record cost
      if (this.costTracker) {
        await this.costTracker.recordCost({
          tenantId: config.tenantId,
          model: model.model,
          provider: model.provider,
          taskType: config.taskType,
          cost,
          tokens: response.tokens_used,
          timestamp: new Date(),
        });
      }

      // Record metrics
      metrics.increment("ai_router_requests_total", {
        task_type: config.taskType,
        model: model.model,
        provider: model.provider,
        fallback_used: "false",
      });
      metrics.histogram("ai_router_latency_ms", latency, {
        task_type: config.taskType,
        model: model.model,
      });
      metrics.histogram("ai_router_cost_usd", cost * 1000, {
        task_type: config.taskType,
        model: model.model,
      });

      logger.info("Model router: model succeeded", {
        taskType: config.taskType,
        model: model.model,
        latency,
        cost,
      });

      return {
        model: model.model,
        provider: model.provider,
        response,
        fallbackUsed: false,
        cost,
        latency,
        metadata: {
          primaryModel: model.model,
          fallbackChain,
          circuitBreakerState: circuitBreaker.getStats().state,
        },
      };
    } catch (error) {
      logger.warn("Model router: model failed, trying fallback", {
        taskType: config.taskType,
        model: model.model,
        error: error instanceof Error ? error.message : String(error),
      });

      // Try fallback
      const fallbackResponse = await this.tryFallback(
        request,
        config,
        model,
        fallbackChain
      );

      const latency = Date.now() - startTime;

      // Record cost for fallback
      if (this.costTracker) {
        await this.costTracker.recordCost({
          tenantId: config.tenantId,
          model: fallbackResponse.model,
          provider: fallbackResponse.provider,
          taskType: config.taskType,
          cost: fallbackResponse.cost,
          tokens: fallbackResponse.response.tokens_used,
          timestamp: new Date(),
        });
      }

      metrics.increment("ai_router_requests_total", {
        task_type: config.taskType,
        model: fallbackResponse.model,
        provider: fallbackResponse.provider,
        fallback_used: "true",
      });
      metrics.histogram("ai_router_latency_ms", latency, {
        task_type: config.taskType,
        model: fallbackResponse.model,
      });

      return {
        ...fallbackResponse,
        latency,
        metadata: {
          primaryModel: model.model,
          fallbackChain,
        },
      };
    }
  }

  /**
   * Route request to optimal model with true token streaming.
   *
   * This preserves the same model selection, circuit breakers, and budgets as `route`,
   * but calls provider streaming APIs and emits deltas via `onDelta`.
   */
  async routeStream(
    request: LLMRequest,
    config: ModelRoutingConfig,
    opts: {
      onDelta: (delta: string) => void;
      signal?: AbortSignal;
    }
  ): Promise<StreamingRoutingResult> {
    const startTime = Date.now();
    const fallbackChain: string[] = [];

    const primaryModel = this.selectModel(config);
    if (!primaryModel) {
      throw new Error(`No suitable model found for task type: ${config.taskType}`);
    }
    fallbackChain.push(primaryModel.model);

    const circuitBreakerKey = `${primaryModel.provider}:${primaryModel.model}`;
    let circuitBreaker = this.circuitBreakers.get(circuitBreakerKey);
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000,
      });
      this.circuitBreakers.set(circuitBreakerKey, circuitBreaker);
    }

    // Budgets (same logic as non-streaming)
    if (this.costTracker) {
      const costEstimate = this.estimateCost(primaryModel, request);
      const budgetCheck = await this.costTracker.checkBudget(config.tenantId, costEstimate);
      if (!budgetCheck.allowed) {
        throw new Error(
          `Cost limit exceeded for tenant ${config.tenantId}. ${budgetCheck.reason || ""}. Current: ${budgetCheck.currentDaily}, Daily Budget: ${budgetCheck.dailyBudget}`
        );
      }
    } else if (this.meteringService) {
      const costEstimateMicro = this.estimateCostMicro(primaryModel, request);
      const costCheck = await this.meteringService.increment(config.tenantId, "ai_cost_micro_usd_day", costEstimateMicro);
      if (!costCheck.allowed) {
        throw new Error(
          `Cost limit exceeded for tenant ${config.tenantId}. Current: ${costCheck.current_usage}, Limit: ${costCheck.limit}`
        );
      }
    }

    try {
      const response = await circuitBreaker.execute(async () => {
        return await this.llmProvider.callStream(
          { ...request, model: primaryModel.model },
          { onDelta: opts.onDelta, signal: opts.signal }
        );
      });

      const latency = Date.now() - startTime;
      const cost = response.cost;

      if (this.costTracker) {
        await this.costTracker.recordCost({
          tenantId: config.tenantId,
          model: primaryModel.model,
          provider: primaryModel.provider,
          taskType: config.taskType,
          cost,
          tokens: response.tokens_used,
          timestamp: new Date(),
        });
      }

      metrics.increment("ai_router_requests_total", {
        task_type: config.taskType,
        model: primaryModel.model,
        provider: primaryModel.provider,
        fallback_used: "false",
      });
      metrics.histogram("ai_router_latency_ms", latency, {
        task_type: config.taskType,
        model: primaryModel.model,
      });

      return {
        model: primaryModel.model,
        provider: primaryModel.provider,
        response,
        fallbackUsed: false,
        cost,
        latency,
        metadata: {
          primaryModel: primaryModel.model,
          fallbackChain,
          circuitBreakerState: circuitBreaker.getStats().state,
        },
      };
    } catch (error) {
      logger.warn("Model router (stream): primary model failed, trying fallback", {
        taskType: config.taskType,
        model: primaryModel.model,
        error: error instanceof Error ? error.message : String(error),
      });

      const fallbackResponse = await this.tryFallbackStream(request, config, primaryModel, fallbackChain, opts);
      const latency = Date.now() - startTime;

      if (this.costTracker) {
        await this.costTracker.recordCost({
          tenantId: config.tenantId,
          model: fallbackResponse.model,
          provider: fallbackResponse.provider,
          taskType: config.taskType,
          cost: fallbackResponse.cost,
          tokens: fallbackResponse.response.tokens_used,
          timestamp: new Date(),
        });
      }

      metrics.increment("ai_router_requests_total", {
        task_type: config.taskType,
        model: fallbackResponse.model,
        provider: fallbackResponse.provider,
        fallback_used: "true",
      });

      return {
        ...fallbackResponse,
        latency,
        metadata: {
          primaryModel: primaryModel.model,
          fallbackChain,
        },
      };
    }
  }

  /**
   * Select optimal model for task type
   */
  private selectModel(config: ModelRoutingConfig): ModelCandidate | null {
    // Filter candidates by task type
    let candidates = this.modelCandidates.filter((c) =>
      c.taskTypes.includes(config.taskType)
    );

    // Filter by provider availability (keys configured). Generic providers are not supported in this repo yet.
    candidates = candidates.filter((c) => this.isProviderConfigured(c.provider));

    // Filter by latency constraint
    if (config.latencyConstraint) {
      candidates = candidates.filter(
        (c) => c.latencyP95 <= config.latencyConstraint!
      );
    }

    // Filter by cost constraint
    if (config.costConstraint) {
      candidates = candidates.filter(
        (c) => c.costPer1kTokens <= config.costConstraint!
      );
    }

    // Filter by quality constraint
    if (config.qualityConstraint) {
      candidates = candidates.filter(
        (c) => c.qualityScore >= config.qualityConstraint!
      );
    }

    // Filter by citation faithfulness
    if (config.citationFaithfulness) {
      candidates = candidates.filter(
        (c) => c.citationFaithfulness >= config.citationFaithfulness!
      );
    }

    // Filter by provider health (check circuit breakers)
    candidates = candidates.filter((c) => {
      const circuitBreakerKey = `${c.provider}:${c.model}`;
      const breaker = this.circuitBreakers.get(circuitBreakerKey);
      if (breaker) {
        const stats = breaker.getStats();
        return stats.state !== "open";
      }
      return true; // No circuit breaker = healthy
    });

    if (candidates.length === 0) {
      return null;
    }

    // Sort by priority (higher = better) and select top
    candidates.sort((a, b) => b.priority - a.priority);
    return candidates[0];
  }

  private isProviderConfigured(provider: ModelCandidate["provider"]): boolean {
    if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
    if (provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
    return false;
  }

  /**
   * Try fallback models
   */
  private async tryFallback(
    request: LLMRequest,
    config: ModelRoutingConfig,
    failedModel: ModelCandidate,
    fallbackChain: string[]
  ): Promise<Omit<RoutingResult, "latency">> {
    // Get fallback candidates (exclude failed model)
    const fallbackCandidates = this.modelCandidates
      .filter((c) => c.taskTypes.includes(config.taskType) && c.model !== failedModel.model)
      .filter((c) => this.isProviderConfigured(c.provider));

    // Prefer different provider first, then priority.
    fallbackCandidates.sort((a, b) => {
      const aDiff = a.provider === failedModel.provider ? 0 : 1;
      const bDiff = b.provider === failedModel.provider ? 0 : 1;
      if (aDiff !== bDiff) return bDiff - aDiff;
      return b.priority - a.priority;
    });

    // Try each fallback candidate
    let lastError: string | undefined;
    for (const candidate of fallbackCandidates) {
      fallbackChain.push(candidate.model);

      const circuitBreakerKey = `${candidate.provider}:${candidate.model}`;
      let circuitBreaker = this.circuitBreakers.get(circuitBreakerKey);
      if (!circuitBreaker) {
        circuitBreaker = new CircuitBreaker({
          failureThreshold: 5,
          successThreshold: 2,
          timeout: 60000,
        });
        this.circuitBreakers.set(circuitBreakerKey, circuitBreaker);
      }

      try {
        const response = await circuitBreaker.execute(async () => {
          return await this.llmProvider.call({
            ...request,
            model: candidate.model,
          });
        });

        logger.info("Model router: fallback model succeeded", {
          taskType: config.taskType,
          model: candidate.model,
          provider: candidate.provider,
        });

        return {
          model: candidate.model,
          provider: candidate.provider,
          response,
          fallbackUsed: true,
          cost: response.cost,
          metadata: {
            fallbackChain,
            circuitBreakerState: circuitBreaker.getStats().state,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        logger.warn("Model router: fallback model failed", {
          taskType: config.taskType,
          model: candidate.model,
          error: lastError,
        });
        // Continue to next fallback
      }
    }

    // All fallbacks failed
    throw new Error(
      `All models failed for task type ${config.taskType}. Tried: ${fallbackChain.join(", ")}${
        lastError ? `. Last error: ${lastError}` : ""
      }`
    );
  }

  private async tryFallbackStream(
    request: LLMRequest,
    config: ModelRoutingConfig,
    failedModel: ModelCandidate,
    fallbackChain: string[],
    opts: { onDelta: (delta: string) => void; signal?: AbortSignal }
  ): Promise<Omit<StreamingRoutingResult, "latency">> {
    const fallbackCandidates = this.modelCandidates
      .filter((c) => c.taskTypes.includes(config.taskType) && c.model !== failedModel.model)
      .filter((c) => this.isProviderConfigured(c.provider));

    fallbackCandidates.sort((a, b) => {
      const aDiff = a.provider === failedModel.provider ? 0 : 1;
      const bDiff = b.provider === failedModel.provider ? 0 : 1;
      if (aDiff !== bDiff) return bDiff - aDiff;
      return b.priority - a.priority;
    });

    let lastError: string | undefined;
    for (const candidate of fallbackCandidates) {
      fallbackChain.push(candidate.model);

      const circuitBreakerKey = `${candidate.provider}:${candidate.model}`;
      let circuitBreaker = this.circuitBreakers.get(circuitBreakerKey);
      if (!circuitBreaker) {
        circuitBreaker = new CircuitBreaker({
          failureThreshold: 5,
          successThreshold: 2,
          timeout: 60000,
        });
        this.circuitBreakers.set(circuitBreakerKey, circuitBreaker);
      }

      try {
        const response = await circuitBreaker.execute(async () => {
          return await this.llmProvider.callStream(
            { ...request, model: candidate.model },
            { onDelta: opts.onDelta, signal: opts.signal }
          );
        });

        return {
          model: candidate.model,
          provider: candidate.provider,
          response,
          fallbackUsed: true,
          cost: response.cost,
          metadata: {
            fallbackChain,
            circuitBreakerState: circuitBreaker.getStats().state,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        logger.warn("Model router (stream): fallback model failed", {
          taskType: config.taskType,
          model: candidate.model,
          error: lastError,
        });
      }
    }

    throw new Error(
      `All models failed for task type ${config.taskType} (stream). Tried: ${fallbackChain.join(", ")}${
        lastError ? `. Last error: ${lastError}` : ""
      }`
    );
  }

  /**
   * Estimate cost for request
   */
  private estimateCost(model: ModelCandidate, request: LLMRequest): number {
    // Rough estimate: assume 1000 tokens for prompt + response
    const estimatedTokens = 1000;
    return (estimatedTokens / 1000) * model.costPer1kTokens;
  }

  /**
   * Get router health status
   */
  getHealthStatus(): {
    totalModels: number;
    healthyModels: number;
    circuitBreakerStates: Record<string, string>;
  } {
    const states: Record<string, string> = {};
    let healthyCount = 0;

    for (const [key, breaker] of this.circuitBreakers.entries()) {
      const stats = breaker.getStats();
      states[key] = stats.state;
      if (stats.state === "closed") {
        healthyCount++;
      }
    }

    return {
      totalModels: this.modelCandidates.length,
      healthyModels: healthyCount,
      circuitBreakerStates: states,
    };
  }
}
