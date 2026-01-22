/**
 * Advanced Metrics Collector
 * 
 * Collects and aggregates metrics for observability
 * Extends base metrics with aggregation and export capabilities
 */

import { metrics } from "./metrics";
import { getCache, setCache } from "@/lib/cache/redis";

export interface AggregatedMetrics {
  request_latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
  };
  error_rates: {
    total: number;
    by_endpoint: Record<string, number>;
  };
  cache_hit_rates: {
    embedding: number;
    reranking: number;
    query: number;
  };
  ai_model_costs: {
    total: number;
    by_model: Record<string, number>;
  };
  timestamp: string;
}

/**
 * Collect and aggregate metrics
 */
export class AdvancedMetricsCollector {
  /**
   * Get aggregated metrics for dashboard
   */
  async getAggregatedMetrics(tenantId?: string): Promise<AggregatedMetrics> {
    const summary = metrics.getSummary();

    // Calculate request latency from histograms
    const latencyHistogram = summary.histograms["request_duration_ms"] || { count: 0, avg: 0, p95: 0 };
    const requestLatency = {
      p50: latencyHistogram.avg * 0.8, // Approximate
      p95: latencyHistogram.p95,
      p99: latencyHistogram.p95 * 1.2, // Approximate
      avg: latencyHistogram.avg,
    };

    // Calculate error rates
    const totalRequests = summary.counters["api_requests_total"] || 0;
    const totalErrors = summary.counters["api_errors_total"] || 0;
    const errorRates = {
      total: totalRequests > 0 ? totalErrors / totalRequests : 0,
      by_endpoint: this.extractEndpointErrors(summary.counters),
    };

    // Get cache hit rates (from cache metrics if available)
    const cacheHitRates = {
      embedding: summary.gauges["cache_hit_rate_embedding"] || 0,
      reranking: summary.gauges["cache_hit_rate_reranking"] || 0,
      query: summary.gauges["cache_hit_rate_query"] || 0,
    };

    // Calculate AI model costs
    const aiModelCosts = {
      total: summary.counters["ai_model_cost_total"] || 0,
      by_model: this.extractModelCosts(summary.counters),
    };

    return {
      request_latency: requestLatency,
      error_rates: errorRates,
      cache_hit_rates: cacheHitRates,
      ai_model_costs: aiModelCosts,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Extract endpoint-specific error rates
   */
  private extractEndpointErrors(counters: Record<string, number>): Record<string, number> {
    const endpointErrors: Record<string, number> = {};
    
    for (const [key, value] of Object.entries(counters)) {
      if (key.includes("_error") && key.includes("endpoint")) {
        // Parse endpoint from key
        const match = key.match(/endpoint="([^"]+)"/);
        if (match) {
          const endpoint = match[1];
          endpointErrors[endpoint] = value;
        }
      }
    }

    return endpointErrors;
  }

  /**
   * Extract model-specific costs
   */
  private extractModelCosts(counters: Record<string, number>): Record<string, number> {
    const modelCosts: Record<string, number> = {};
    
    for (const [key, value] of Object.entries(counters)) {
      if (key.includes("ai_model_cost") && key.includes("model")) {
        // Parse model from key
        const match = key.match(/model="([^"]+)"/);
        if (match) {
          const model = match[1];
          modelCosts[model] = value;
        }
      }
    }

    return modelCosts;
  }

  /**
   * Export metrics to external systems
   */
  async exportMetrics(format: "prometheus" | "json" = "prometheus"): Promise<string> {
    if (format === "prometheus") {
      return metrics.getPrometheusFormat();
    }

    const summary = metrics.getSummary();
    return JSON.stringify(summary, null, 2);
  }
}

export const advancedMetrics = new AdvancedMetricsCollector();
