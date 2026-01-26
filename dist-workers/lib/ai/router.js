"use strict";
/**
 * AI Model Router
 *
 * Intelligent model routing with task-based selection, automatic fallbacks,
 * circuit breakers, and cost tracking for production-grade AI orchestration.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelRouter = void 0;
const providers_1 = require("@/lib/llm/providers");
const circuit_breaker_1 = require("@/lib/resilience/circuit-breaker");
const logger_1 = require("@/lib/logging/logger");
const metrics_1 = require("@/lib/observability/metrics");
/**
 * Model Router with intelligent task-based routing
 */
class ModelRouter {
    constructor(costTrackerOrMetering) {
        this.circuitBreakers = new Map();
        this.modelCandidates = [];
        this.llmProvider = new providers_1.LLMProvider();
        // CostTracker has meteringService, so accept either
        if (costTrackerOrMetering && 'recordCost' in costTrackerOrMetering) {
            this.costTracker = costTrackerOrMetering;
            this.meteringService = undefined;
        }
        else {
            this.meteringService = costTrackerOrMetering;
            this.costTracker = undefined;
        }
        this.initializeModelCandidates();
    }
    estimateCostMicro(model, request) {
        // Keep consistent with estimateCost: assume 1000 tokens total.
        const estimatedTokens = 1000;
        const usd = (estimatedTokens / 1000) * model.costPer1kTokens;
        // micro-USD integer (ceil to avoid undercounting).
        return Math.ceil(usd * 1000000);
    }
    /**
     * Initialize model candidates with performance characteristics
     */
    initializeModelCandidates() {
        this.modelCandidates = [
            // OpenAI (configured via OPENAI_API_KEY). Keep models aligned with /v1/models.
            {
                model: "gpt-4o",
                provider: "openai",
                taskTypes: ["judge", "eval", "generate"],
                latencyP95: 3000,
                costPer1kTokens: 0.00625,
                qualityScore: 0.95,
                citationFaithfulness: 0.92,
                priority: 10,
            },
            {
                model: "gpt-4.1",
                provider: "openai",
                taskTypes: ["judge", "eval", "generate"],
                latencyP95: 3200,
                costPer1kTokens: 0.008,
                qualityScore: 0.96,
                citationFaithfulness: 0.93,
                priority: 9,
            },
            {
                model: "gpt-5-mini",
                provider: "openai",
                taskTypes: ["judge", "eval", "generate"],
                latencyP95: 3500,
                costPer1kTokens: 0.012,
                qualityScore: 0.97,
                citationFaithfulness: 0.94,
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
            // Extract/Cluster tasks - Fast, cost-effective
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
                model: "gpt-4.1-mini",
                provider: "openai",
                taskTypes: ["extract", "cluster", "summarize", "generate"],
                latencyP95: 1700,
                costPer1kTokens: 0.0002,
                qualityScore: 0.88,
                citationFaithfulness: 0.84,
                priority: 8,
            },
            // Anthropic (only used when ANTHROPIC_API_KEY is configured)
            {
                model: "claude-3-haiku-20240307",
                provider: "anthropic",
                taskTypes: ["extract", "cluster", "summarize"],
                latencyP95: 1800,
                costPer1kTokens: 0.00025,
                qualityScore: 0.88,
                citationFaithfulness: 0.82,
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
                priority: 8,
            },
            {
                model: "claude-3-sonnet-20240229",
                provider: "anthropic",
                taskTypes: ["judge", "eval", "generate"],
                latencyP95: 2500,
                costPer1kTokens: 0.009,
                qualityScore: 0.93,
                citationFaithfulness: 0.90,
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
    async route(request, config) {
        const startTime = Date.now();
        const fallbackChain = [];
        // Try learned routing if enabled (check environment variable)
        const useLearnedRouting = process.env.ENABLE_ROUTE_LLM === "true";
        if (useLearnedRouting) {
            try {
                const { RouteLLM } = await Promise.resolve().then(() => __importStar(require("./route-llm")));
                const routeLLM = new RouteLLM();
                const decision = await routeLLM.route(request, {
                    tenantId: config.tenantId,
                    taskType: config.taskType,
                    useLearnedRouting: true,
                });
                if (decision.confidence > 0.7) {
                    // Use learned routing decision
                    const modelCandidate = this.modelCandidates.find((m) => m.model === decision.model && m.provider === decision.provider);
                    if (modelCandidate) {
                        return await this.executeWithModel(request, config, modelCandidate, decision.fallback_model);
                    }
                }
            }
            catch (error) {
                // Fall back to rule-based routing
                logger_1.logger.warn("RouteLLM failed, using rule-based routing", { error });
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
            circuitBreaker = new circuit_breaker_1.CircuitBreaker({
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
                throw new Error(`Cost limit exceeded for tenant ${config.tenantId}. ${budgetCheck.reason || ''}. Current: ${budgetCheck.currentDaily}, Daily Budget: ${budgetCheck.dailyBudget}`);
            }
        }
        else if (this.meteringService) {
            const costEstimateMicro = this.estimateCostMicro(primaryModel, request);
            const costCheck = await this.meteringService.increment(config.tenantId, "ai_cost_micro_usd_day", costEstimateMicro);
            if (!costCheck.allowed) {
                throw new Error(`Cost limit exceeded for tenant ${config.tenantId}. Current: ${costCheck.current_usage}, Limit: ${costCheck.limit}`);
            }
        }
        // Execute with selected model
        return await this.executeWithModel(request, config, primaryModel);
    }
    /**
     * Execute request with specific model
     */
    async executeWithModel(request, config, model, fallbackModel) {
        const startTime = Date.now();
        const fallbackChain = [model.model];
        // Get or create circuit breaker for provider
        const circuitBreakerKey = `${model.provider}:${model.model}`;
        let circuitBreaker = this.circuitBreakers.get(circuitBreakerKey);
        if (!circuitBreaker) {
            circuitBreaker = new circuit_breaker_1.CircuitBreaker({
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
                throw new Error(`Cost limit exceeded for tenant ${config.tenantId}. ${budgetCheck.reason || ''}. Current: ${budgetCheck.currentDaily}, Daily Budget: ${budgetCheck.dailyBudget}`);
            }
        }
        else if (this.meteringService) {
            const costEstimateMicro = this.estimateCostMicro(model, request);
            const costCheck = await this.meteringService.increment(config.tenantId, "ai_cost_micro_usd_day", costEstimateMicro);
            if (!costCheck.allowed) {
                throw new Error(`Cost limit exceeded for tenant ${config.tenantId}. Current: ${costCheck.current_usage}, Limit: ${costCheck.limit}`);
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
            metrics_1.metrics.increment("ai_router_requests_total", {
                task_type: config.taskType,
                model: model.model,
                provider: model.provider,
                fallback_used: "false",
            });
            metrics_1.metrics.histogram("ai_router_latency_ms", latency, {
                task_type: config.taskType,
                model: model.model,
            });
            metrics_1.metrics.histogram("ai_router_cost_usd", cost * 1000, {
                task_type: config.taskType,
                model: model.model,
            });
            logger_1.logger.info("Model router: model succeeded", {
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
        }
        catch (error) {
            logger_1.logger.warn("Model router: model failed, trying fallback", {
                taskType: config.taskType,
                model: model.model,
                error: error instanceof Error ? error.message : String(error),
            });
            // Try fallback
            const fallbackResponse = await this.tryFallback(request, config, model, fallbackChain);
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
            metrics_1.metrics.increment("ai_router_requests_total", {
                task_type: config.taskType,
                model: fallbackResponse.model,
                provider: fallbackResponse.provider,
                fallback_used: "true",
            });
            metrics_1.metrics.histogram("ai_router_latency_ms", latency, {
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
    async routeStream(request, config, opts) {
        const startTime = Date.now();
        const fallbackChain = [];
        const primaryModel = this.selectModel(config);
        if (!primaryModel) {
            throw new Error(`No suitable model found for task type: ${config.taskType}`);
        }
        fallbackChain.push(primaryModel.model);
        const circuitBreakerKey = `${primaryModel.provider}:${primaryModel.model}`;
        let circuitBreaker = this.circuitBreakers.get(circuitBreakerKey);
        if (!circuitBreaker) {
            circuitBreaker = new circuit_breaker_1.CircuitBreaker({
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
                throw new Error(`Cost limit exceeded for tenant ${config.tenantId}. ${budgetCheck.reason || ""}. Current: ${budgetCheck.currentDaily}, Daily Budget: ${budgetCheck.dailyBudget}`);
            }
        }
        else if (this.meteringService) {
            const costEstimateMicro = this.estimateCostMicro(primaryModel, request);
            const costCheck = await this.meteringService.increment(config.tenantId, "ai_cost_micro_usd_day", costEstimateMicro);
            if (!costCheck.allowed) {
                throw new Error(`Cost limit exceeded for tenant ${config.tenantId}. Current: ${costCheck.current_usage}, Limit: ${costCheck.limit}`);
            }
        }
        try {
            const response = await circuitBreaker.execute(async () => {
                return await this.llmProvider.callStream({ ...request, model: primaryModel.model }, { onDelta: opts.onDelta, signal: opts.signal });
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
            metrics_1.metrics.increment("ai_router_requests_total", {
                task_type: config.taskType,
                model: primaryModel.model,
                provider: primaryModel.provider,
                fallback_used: "false",
            });
            metrics_1.metrics.histogram("ai_router_latency_ms", latency, {
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
        }
        catch (error) {
            logger_1.logger.warn("Model router (stream): primary model failed, trying fallback", {
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
            metrics_1.metrics.increment("ai_router_requests_total", {
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
    selectModel(config) {
        // Filter candidates by task type
        let candidates = this.modelCandidates.filter((c) => c.taskTypes.includes(config.taskType));
        // Filter by provider availability (keys configured). Generic providers are not supported in this repo yet.
        candidates = candidates.filter((c) => this.isProviderConfigured(c.provider));
        // Filter by latency constraint
        if (config.latencyConstraint) {
            candidates = candidates.filter((c) => c.latencyP95 <= config.latencyConstraint);
        }
        // Filter by cost constraint
        if (config.costConstraint) {
            candidates = candidates.filter((c) => c.costPer1kTokens <= config.costConstraint);
        }
        // Filter by quality constraint
        if (config.qualityConstraint) {
            candidates = candidates.filter((c) => c.qualityScore >= config.qualityConstraint);
        }
        // Filter by citation faithfulness
        if (config.citationFaithfulness) {
            candidates = candidates.filter((c) => c.citationFaithfulness >= config.citationFaithfulness);
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
    isProviderConfigured(provider) {
        if (provider === "openai")
            return Boolean(process.env.OPENAI_API_KEY);
        if (provider === "anthropic")
            return Boolean(process.env.ANTHROPIC_API_KEY);
        return false;
    }
    /**
     * Try fallback models
     */
    async tryFallback(request, config, failedModel, fallbackChain) {
        // Get fallback candidates (exclude failed model)
        const fallbackCandidates = this.modelCandidates
            .filter((c) => c.taskTypes.includes(config.taskType) && c.model !== failedModel.model)
            .filter((c) => this.isProviderConfigured(c.provider));
        // Prefer different provider first, then priority.
        fallbackCandidates.sort((a, b) => {
            const aDiff = a.provider === failedModel.provider ? 0 : 1;
            const bDiff = b.provider === failedModel.provider ? 0 : 1;
            if (aDiff !== bDiff)
                return bDiff - aDiff;
            return b.priority - a.priority;
        });
        // Try each fallback candidate
        let lastError;
        for (const candidate of fallbackCandidates) {
            fallbackChain.push(candidate.model);
            const circuitBreakerKey = `${candidate.provider}:${candidate.model}`;
            let circuitBreaker = this.circuitBreakers.get(circuitBreakerKey);
            if (!circuitBreaker) {
                circuitBreaker = new circuit_breaker_1.CircuitBreaker({
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
                logger_1.logger.info("Model router: fallback model succeeded", {
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
            }
            catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
                logger_1.logger.warn("Model router: fallback model failed", {
                    taskType: config.taskType,
                    model: candidate.model,
                    error: lastError,
                });
                // Continue to next fallback
            }
        }
        // All fallbacks failed
        throw new Error(`All models failed for task type ${config.taskType}. Tried: ${fallbackChain.join(", ")}${lastError ? `. Last error: ${lastError}` : ""}`);
    }
    async tryFallbackStream(request, config, failedModel, fallbackChain, opts) {
        const fallbackCandidates = this.modelCandidates
            .filter((c) => c.taskTypes.includes(config.taskType) && c.model !== failedModel.model)
            .filter((c) => this.isProviderConfigured(c.provider));
        fallbackCandidates.sort((a, b) => {
            const aDiff = a.provider === failedModel.provider ? 0 : 1;
            const bDiff = b.provider === failedModel.provider ? 0 : 1;
            if (aDiff !== bDiff)
                return bDiff - aDiff;
            return b.priority - a.priority;
        });
        let lastError;
        for (const candidate of fallbackCandidates) {
            fallbackChain.push(candidate.model);
            const circuitBreakerKey = `${candidate.provider}:${candidate.model}`;
            let circuitBreaker = this.circuitBreakers.get(circuitBreakerKey);
            if (!circuitBreaker) {
                circuitBreaker = new circuit_breaker_1.CircuitBreaker({
                    failureThreshold: 5,
                    successThreshold: 2,
                    timeout: 60000,
                });
                this.circuitBreakers.set(circuitBreakerKey, circuitBreaker);
            }
            try {
                const response = await circuitBreaker.execute(async () => {
                    return await this.llmProvider.callStream({ ...request, model: candidate.model }, { onDelta: opts.onDelta, signal: opts.signal });
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
            }
            catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
                logger_1.logger.warn("Model router (stream): fallback model failed", {
                    taskType: config.taskType,
                    model: candidate.model,
                    error: lastError,
                });
            }
        }
        throw new Error(`All models failed for task type ${config.taskType} (stream). Tried: ${fallbackChain.join(", ")}${lastError ? `. Last error: ${lastError}` : ""}`);
    }
    /**
     * Estimate cost for request
     */
    estimateCost(model, request) {
        // Rough estimate: assume 1000 tokens for prompt + response
        const estimatedTokens = 1000;
        return (estimatedTokens / 1000) * model.costPer1kTokens;
    }
    /**
     * Get router health status
     */
    getHealthStatus() {
        const states = {};
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
exports.ModelRouter = ModelRouter;
