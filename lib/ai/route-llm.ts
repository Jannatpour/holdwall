/**
 * RouteLLM: Learned Routing with Preference Data
 * 
 * Trains routers on preference data to choose a cheaper vs stronger model per request.
 * Based on: https://huggingface.co/papers/2406.18665
 * 
 * POS usage: router predicts if the "fast model" is sufficient; otherwise escalate.
 */

import type { LLMRequest, LLMResponse } from "@/lib/llm/providers";
import { LLMProvider } from "@/lib/llm/providers";
import type { AITaskType } from "./router";
import { logger } from "@/lib/logging/logger";
import { db } from "@/lib/db/client";

export interface RouteLLMConfig {
  tenantId: string;
  taskType: AITaskType;
  /** Model preference data (from training/evaluation) */
  preferenceData?: ModelPreference[];
  /** Whether to use learned routing or fallback to rule-based */
  useLearnedRouting?: boolean;
}

export interface ModelPreference {
  /** Request characteristics */
  request_hash: string;
  task_type: AITaskType;
  prompt_length: number;
  expected_output_length: number;
  complexity_estimate: number; // 0-1
  
  /** Model choices and outcomes */
  chosen_model: string;
  fallback_used: boolean;
  quality_score: number; // 0-1
  latency_ms: number;
  cost_usd: number;
  
  /** Preference label */
  preferred: boolean; // true if this was the best choice
}

export interface RouteLLMDecision {
  model: string;
  provider: "openai" | "anthropic" | "generic";
  confidence: number; // 0-1
  reasoning: string;
  fallback_model?: string;
}

/**
 * RouteLLM: Learned model router
 */
export class RouteLLM {
  private llmProvider: LLMProvider;
  private preferenceCache: Map<string, ModelPreference[]> = new Map();

  constructor() {
    this.llmProvider = new LLMProvider();
  }

  /**
   * Route request using learned preferences
   */
  async route(
    request: LLMRequest,
    config: RouteLLMConfig
  ): Promise<RouteLLMDecision> {
    if (!config.useLearnedRouting) {
      // Fallback to rule-based routing
      return this.ruleBasedRoute(request, config);
    }

    // Load preference data for this tenant/task
    const preferences = await this.loadPreferences(config.tenantId, config.taskType);
    
    if (preferences.length === 0) {
      // No training data yet, use rule-based
      return this.ruleBasedRoute(request, config);
    }

    // Extract request features
    const features = this.extractFeatures(request, config);

    // Find similar requests in preference data
    const similar = this.findSimilarRequests(features, preferences);

    if (similar.length === 0) {
      return this.ruleBasedRoute(request, config);
    }

    // Predict best model based on similar requests
    const prediction = this.predictModel(similar, features);

    return {
      model: prediction.model,
      provider: prediction.provider,
      confidence: prediction.confidence,
      reasoning: prediction.reasoning,
      fallback_model: prediction.fallback_model,
    };
  }

  /**
   * Extract features from request for matching
   */
  private extractFeatures(
    request: LLMRequest,
    config: RouteLLMConfig
  ): RequestFeatures {
    const promptLength = (request.prompt?.length || 0) + (request.system_prompt?.length || 0);
    const expectedOutputLength = request.max_tokens || 1000;
    
    // Estimate complexity (simple heuristic: longer prompts + more tokens = more complex)
    const complexity = Math.min(1, (promptLength / 5000) * 0.5 + (expectedOutputLength / 2000) * 0.5);

    return {
      task_type: config.taskType,
      prompt_length: promptLength,
      expected_output_length: expectedOutputLength,
      complexity_estimate: complexity,
    };
  }

  /**
   * Find similar requests in preference data
   */
  private findSimilarRequests(
    features: RequestFeatures,
    preferences: ModelPreference[]
  ): ModelPreference[] {
    // Simple similarity: find requests with similar task type and complexity
    return preferences
      .filter((p) => {
        const taskMatch = p.task_type === features.task_type;
        const complexityDiff = Math.abs(p.complexity_estimate - features.complexity_estimate);
        const lengthDiff = Math.abs(p.prompt_length - features.prompt_length) / Math.max(features.prompt_length, 1);
        
        return taskMatch && complexityDiff < 0.3 && lengthDiff < 0.5;
      })
      .sort((a, b) => {
        // Prefer requests that were marked as preferred
        if (a.preferred !== b.preferred) {
          return a.preferred ? -1 : 1;
        }
        // Then by quality score
        return b.quality_score - a.quality_score;
      })
      .slice(0, 10); // Top 10 similar
  }

  /**
   * Predict best model from similar requests
   */
  private predictModel(
    similar: ModelPreference[],
    features: RequestFeatures
  ): {
    model: string;
    provider: "openai" | "anthropic" | "generic";
    confidence: number;
    reasoning: string;
    fallback_model?: string;
  } {
    // Group by model and calculate aggregate metrics
    const modelStats = new Map<string, {
      count: number;
      preferred_count: number;
      avg_quality: number;
      avg_latency: number;
      avg_cost: number;
    }>();

    for (const pref of similar) {
      const existing = modelStats.get(pref.chosen_model) || {
        count: 0,
        preferred_count: 0,
        avg_quality: 0,
        avg_latency: 0,
        avg_cost: 0,
      };

      existing.count++;
      if (pref.preferred) existing.preferred_count++;
      existing.avg_quality = (existing.avg_quality * (existing.count - 1) + pref.quality_score) / existing.count;
      existing.avg_latency = (existing.avg_latency * (existing.count - 1) + pref.latency_ms) / existing.count;
      existing.avg_cost = (existing.avg_cost * (existing.count - 1) + pref.cost_usd) / existing.count;

      modelStats.set(pref.chosen_model, existing);
    }

    // Find best model (prefer models with high preferred_count and quality)
    let bestModel = "";
    let bestScore = -1;
    let bestProvider: "openai" | "anthropic" | "generic" = "openai";

    for (const [model, stats] of modelStats.entries()) {
      // Score = preferred_rate * quality * (1 - normalized_cost) * (1 - normalized_latency)
      const preferredRate = stats.preferred_count / stats.count;
      const normalizedCost = Math.min(1, stats.avg_cost / 0.01); // Normalize to $0.01
      const normalizedLatency = Math.min(1, stats.avg_latency / 5000); // Normalize to 5s
      
      const score = preferredRate * stats.avg_quality * (1 - normalizedCost * 0.3) * (1 - normalizedLatency * 0.2);

      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
        bestProvider = this.inferProvider(model);
      }
    }

    if (!bestModel) {
      // Fallback
      return {
        model: "gpt-4o-mini",
        provider: "openai",
        confidence: 0.5,
        reasoning: "No sufficient preference data, using default",
      };
    }

    const stats = modelStats.get(bestModel)!;
    const confidence = Math.min(1, stats.preferred_count / Math.max(1, stats.count));

    return {
      model: bestModel,
      provider: bestProvider,
      confidence,
      reasoning: `Based on ${similar.length} similar requests: ${stats.preferred_count}/${stats.count} preferred, avg quality ${stats.avg_quality.toFixed(2)}`,
      fallback_model: stats.avg_quality < 0.7 ? "gpt-4o" : undefined,
    };
  }

  /**
   * Rule-based routing fallback
   */
  private ruleBasedRoute(
    request: LLMRequest,
    config: RouteLLMConfig
  ): RouteLLMDecision {
    // Simple rule-based routing
    const promptLength = (request.prompt?.length || 0) + (request.system_prompt?.length || 0);
    
    let model = "gpt-4o-mini";
    let provider: "openai" | "anthropic" | "generic" = "openai";

    if (config.taskType === "judge" || config.taskType === "eval") {
      model = "gpt-4o"; // Use stronger model for judgment tasks
    } else if (promptLength > 10000) {
      model = "gpt-4o"; // Use stronger model for long prompts
    } else if (config.taskType === "extract" || config.taskType === "cluster") {
      model = "gpt-4o-mini"; // Use cheaper model for simple tasks
    }

    return {
      model,
      provider,
      confidence: 0.6,
      reasoning: "Rule-based routing (no preference data available)",
    };
  }

  /**
   * Load preference data from database
   */
  private async loadPreferences(
    tenantId: string,
    taskType: AITaskType
  ): Promise<ModelPreference[]> {
    const cacheKey = `${tenantId}:${taskType}`;
    
    if (this.preferenceCache.has(cacheKey)) {
      return this.preferenceCache.get(cacheKey)!;
    }

    try {
      // Load from database (assuming we have a table for this)
      // For now, return empty array - in production, this would query actual preference data
      const preferences: ModelPreference[] = [];
      
      this.preferenceCache.set(cacheKey, preferences);
      return preferences;
    } catch (error) {
      logger.error("Failed to load RouteLLM preferences", { error, tenantId, taskType });
      return [];
    }
  }

  /**
   * Record preference data (for training)
   */
  async recordPreference(
    tenantId: string,
    preference: ModelPreference
  ): Promise<void> {
    try {
      // In production, this would save to database
      // For now, just update cache
      const cacheKey = `${tenantId}:${preference.task_type}`;
      const existing = this.preferenceCache.get(cacheKey) || [];
      existing.push(preference);
      this.preferenceCache.set(cacheKey, existing.slice(-1000)); // Keep last 1000
    } catch (error) {
      logger.error("Failed to record RouteLLM preference", { error, tenantId });
    }
  }

  /**
   * Infer provider from model name
   */
  private inferProvider(model: string): "openai" | "anthropic" | "generic" {
    if (model.startsWith("gpt-") || model.startsWith("o1-")) {
      return "openai";
    } else if (model.startsWith("claude-")) {
      return "anthropic";
    }
    return "generic";
  }
}

interface RequestFeatures {
  task_type: AITaskType;
  prompt_length: number;
  expected_output_length: number;
  complexity_estimate: number;
}
