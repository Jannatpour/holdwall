/**
 * Shadow Evaluation
 * 
 * Runs new models alongside production without affecting users,
 * comparing outputs and tracking metrics over time.
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { getGoldenSetManager } from "./golden-sets";
import { JudgeFramework } from "@/lib/ai/judge-framework";
import { getCitationMetricsTracker } from "./citation-metrics";
import type { ModelRouter, RoutingResult } from "@/lib/ai/router";

export interface ShadowEvalConfig {
  shadowModel: string;
  productionModel: string;
  tenantId: string;
  sampleRate: number; // 0-1, fraction of requests to shadow
  comparisonMetrics: string[]; // Metrics to compare
}

export interface ShadowEvalResult {
  requestId: string;
  productionResult: RoutingResult;
  shadowResult: RoutingResult;
  comparison: {
    latencyDiff: number; // ms
    costDiff: number; // USD
    qualityDiff?: number; // 0-1
    citationFaithfulnessDiff?: number; // 0-1
  };
  recommendation: "promote" | "reject" | "continue";
}

/**
 * Shadow Evaluator
 */
export class ShadowEvaluator {
  private activeShadows: Map<string, ShadowEvalConfig> = new Map();
  private results: ShadowEvalResult[] = [];
  private judgeFramework: JudgeFramework;
  private citationTracker: ReturnType<typeof getCitationMetricsTracker>;

  constructor() {
    this.judgeFramework = new JudgeFramework();
    this.citationTracker = getCitationMetricsTracker();
  }

  /**
   * Start shadow evaluation
   */
  startShadow(config: ShadowEvalConfig): void {
    const key = `${config.tenantId}:${config.shadowModel}`;
    this.activeShadows.set(key, config);
    logger.info("Shadow evaluation started", config);
  }

  /**
   * Stop shadow evaluation
   */
  stopShadow(tenantId: string, shadowModel: string): void {
    const key = `${tenantId}:${shadowModel}`;
    this.activeShadows.delete(key);
    logger.info("Shadow evaluation stopped", { tenantId, shadowModel });
  }

  /**
   * Check if request should be shadowed
   */
  shouldShadow(tenantId: string, model: string): boolean {
    for (const [key, config] of this.activeShadows.entries()) {
      if (config.tenantId === tenantId && config.shadowModel === model) {
        return Math.random() < config.sampleRate;
      }
    }
    return false;
  }

  /**
   * Evaluate shadow result
   */
  async evaluateShadow(
    requestId: string,
    productionResult: RoutingResult,
    shadowResult: RoutingResult,
    config: ShadowEvalConfig
  ): Promise<ShadowEvalResult> {
    // Calculate differences
    const latencyDiff = shadowResult.latency - productionResult.latency;
    const costDiff = shadowResult.cost - productionResult.cost;

    // Quality comparison (would use evaluation framework)
    const qualityDiff = await this.compareQuality(
      productionResult.response.text,
      shadowResult.response.text
    );

    // Citation faithfulness comparison
    const citationFaithfulnessDiff = await this.compareCitationFaithfulness(
      productionResult.response.text,
      shadowResult.response.text
    );

    const comparison = {
      latencyDiff,
      costDiff,
      qualityDiff,
      citationFaithfulnessDiff,
    };

    // Make recommendation
    const recommendation = this.makeRecommendation(comparison, config);

    const result: ShadowEvalResult = {
      requestId,
      productionResult,
      shadowResult,
      comparison,
      recommendation,
    };

    this.results.push(result);

    // Record metrics
    metrics.histogram("shadow_eval_latency_diff_ms", latencyDiff);
    metrics.histogram("shadow_eval_cost_diff_usd", costDiff * 1000);
    if (qualityDiff !== undefined) {
      metrics.histogram("shadow_eval_quality_diff", qualityDiff);
    }
    if (citationFaithfulnessDiff !== undefined) {
      metrics.histogram("shadow_eval_citation_faithfulness_diff", citationFaithfulnessDiff);
    }

    logger.info("Shadow evaluation completed", {
      requestId,
      recommendation,
      comparison,
    });

    return result;
  }

  /**
   * Compare quality of outputs using Judge Framework
   */
  private async compareQuality(
    productionOutput: string,
    shadowOutput: string
  ): Promise<number | undefined> {
    try {
      // Use Judge Framework to evaluate both outputs
      // We'll use a synthetic query for comparison
      const query = "Compare the quality of these two responses";
      
      const [productionEval, shadowEval] = await Promise.all([
        this.judgeFramework.evaluate(query, productionOutput, productionOutput).catch(() => null),
        this.judgeFramework.evaluate(query, shadowOutput, shadowOutput).catch(() => null),
      ]);

      if (!productionEval || !shadowEval) {
        logger.warn("Judge framework evaluation failed, quality comparison unavailable");
        return undefined;
      }

      // Calculate quality difference (shadow - production)
      // Positive means shadow is better
      const qualityDiff = shadowEval.consensus.score - productionEval.consensus.score;

      return qualityDiff;
    } catch (error) {
      logger.warn("Quality comparison failed", { error: error instanceof Error ? error.message : String(error) });
      return undefined;
    }
  }

  /**
   * Compare citation faithfulness using Citation Metrics Tracker
   */
  private async compareCitationFaithfulness(
    productionOutput: string,
    shadowOutput: string
  ): Promise<number | undefined> {
    try {
      // Extract citations from outputs (simple regex-based extraction)
      const citationPattern = /\[(\d+)\]|\(([^)]+)\)/g;
      const productionCitations: string[] = [];
      const shadowCitations: string[] = [];

      let match;
      while ((match = citationPattern.exec(productionOutput)) !== null) {
        productionCitations.push(match[1] || match[2]);
      }
      citationPattern.lastIndex = 0; // Reset regex
      while ((match = citationPattern.exec(shadowOutput)) !== null) {
        shadowCitations.push(match[1] || match[2]);
      }

      // Evaluate citation faithfulness for both outputs
      const [productionMetrics, shadowMetrics] = await Promise.all([
        productionCitations.length > 0
          ? this.citationTracker.evaluateCitationFaithfulness(
              `production-${Date.now()}`,
              productionOutput,
              productionCitations
            ).catch(() => null)
          : Promise.resolve(null),
        shadowCitations.length > 0
          ? this.citationTracker.evaluateCitationFaithfulness(
              `shadow-${Date.now()}`,
              shadowOutput,
              shadowCitations
            ).catch(() => null)
          : Promise.resolve(null),
      ]);

      if (!productionMetrics || !shadowMetrics) {
        logger.warn("Citation faithfulness evaluation failed, comparison unavailable");
        return undefined;
      }

      // Calculate citation faithfulness difference (shadow - production)
      // Positive means shadow has better citation faithfulness
      const citationDiff = shadowMetrics.citationFaithfulness - productionMetrics.citationFaithfulness;

      return citationDiff;
    } catch (error) {
      logger.warn("Citation faithfulness comparison failed", { error: error instanceof Error ? error.message : String(error) });
      return undefined;
    }
  }

  /**
   * Make recommendation based on comparison
   */
  private makeRecommendation(
    comparison: ShadowEvalResult["comparison"],
    config: ShadowEvalConfig
  ): "promote" | "reject" | "continue" {
    // Promote if shadow is better and within acceptable cost/latency
    const qualityBetter =
      comparison.qualityDiff !== undefined && comparison.qualityDiff > 0.05;
    const citationBetter =
      comparison.citationFaithfulnessDiff !== undefined &&
      comparison.citationFaithfulnessDiff > 0.05;
    const costAcceptable = comparison.costDiff < 0.1; // Within $0.10
    const latencyAcceptable = comparison.latencyDiff < 1000; // Within 1s

    if ((qualityBetter || citationBetter) && costAcceptable && latencyAcceptable) {
      return "promote";
    }

    // Reject if significantly worse
    const qualityWorse =
      comparison.qualityDiff !== undefined && comparison.qualityDiff < -0.1;
    const citationWorse =
      comparison.citationFaithfulnessDiff !== undefined &&
      comparison.citationFaithfulnessDiff < -0.1;

    if (qualityWorse || citationWorse) {
      return "reject";
    }

    // Continue shadowing
    return "continue";
  }

  /**
   * Get shadow evaluation results
   */
  getResults(tenantId?: string, shadowModel?: string): ShadowEvalResult[] {
    if (!tenantId && !shadowModel) {
      return this.results;
    }

    return this.results.filter((r) => {
      if (tenantId && r.productionResult.metadata.primaryModel !== tenantId) {
        return false;
      }
      if (shadowModel && r.shadowResult.model !== shadowModel) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get shadow evaluation summary
   */
  getSummary(tenantId: string, shadowModel: string): {
    totalEvaluations: number;
    promoteCount: number;
    rejectCount: number;
    continueCount: number;
    avgLatencyDiff: number;
    avgCostDiff: number;
    avgQualityDiff?: number;
    avgCitationFaithfulnessDiff?: number;
  } {
    const relevantResults = this.getResults(tenantId, shadowModel);

    if (relevantResults.length === 0) {
      return {
        totalEvaluations: 0,
        promoteCount: 0,
        rejectCount: 0,
        continueCount: 0,
        avgLatencyDiff: 0,
        avgCostDiff: 0,
      };
    }

    const promoteCount = relevantResults.filter((r) => r.recommendation === "promote").length;
    const rejectCount = relevantResults.filter((r) => r.recommendation === "reject").length;
    const continueCount = relevantResults.filter((r) => r.recommendation === "continue").length;

    const avgLatencyDiff =
      relevantResults.reduce((sum, r) => sum + r.comparison.latencyDiff, 0) /
      relevantResults.length;
    const avgCostDiff =
      relevantResults.reduce((sum, r) => sum + r.comparison.costDiff, 0) /
      relevantResults.length;

    const qualityResults = relevantResults.filter(
      (r) => r.comparison.qualityDiff !== undefined
    );
    const avgQualityDiff =
      qualityResults.length > 0
        ? qualityResults.reduce(
            (sum, r) => sum + (r.comparison.qualityDiff || 0),
            0
          ) / qualityResults.length
        : undefined;

    const citationResults = relevantResults.filter(
      (r) => r.comparison.citationFaithfulnessDiff !== undefined
    );
    const avgCitationFaithfulnessDiff =
      citationResults.length > 0
        ? citationResults.reduce(
            (sum, r) => sum + (r.comparison.citationFaithfulnessDiff || 0),
            0
          ) / citationResults.length
        : undefined;

    return {
      totalEvaluations: relevantResults.length,
      promoteCount,
      rejectCount,
      continueCount,
      avgLatencyDiff,
      avgCostDiff,
      avgQualityDiff,
      avgCitationFaithfulnessDiff,
    };
  }
}

// Singleton instance
let shadowEvaluatorInstance: ShadowEvaluator | null = null;

export function getShadowEvaluator(): ShadowEvaluator {
  if (!shadowEvaluatorInstance) {
    shadowEvaluatorInstance = new ShadowEvaluator();
  }
  return shadowEvaluatorInstance;
}
