/**
 * Dashboard Builder
 * 
 * Dynamic dashboard generation for observability
 * Creates real-time metrics views and historical trends
 */

import { metrics } from "./metrics";
import { advancedMetrics } from "./metrics-collector";
import { alerting } from "./alerting";

export interface DashboardWidget {
  id: string;
  type: "metric" | "chart" | "alert" | "table";
  title: string;
  data: unknown;
  config?: Record<string, unknown>;
}

export interface Dashboard {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  created_at: string;
  updated_at: string;
}

/**
 * Build observability dashboard
 */
export class DashboardBuilder {
  /**
   * Build default system dashboard
   */
  async buildSystemDashboard(): Promise<Dashboard> {
    const summary = metrics.getSummary();
    const aggregated = await advancedMetrics.getAggregatedMetrics();
    const activeAlerts = alerting.getActiveAlerts();

    const widgets: DashboardWidget[] = [
      {
        id: "request-latency",
        type: "chart",
        title: "Request Latency",
        data: {
          p50: aggregated.request_latency.p50,
          p95: aggregated.request_latency.p95,
          p99: aggregated.request_latency.p99,
          avg: aggregated.request_latency.avg,
        },
        config: {
          chart_type: "line",
          unit: "ms",
        },
      },
      {
        id: "error-rate",
        type: "metric",
        title: "Error Rate",
        data: {
          value: aggregated.error_rates.total,
          unit: "%",
        },
        config: {
          threshold: 0.05, // 5%
          severity: aggregated.error_rates.total > 0.05 ? "critical" : "ok",
        },
      },
      {
        id: "cache-hit-rates",
        type: "chart",
        title: "Cache Hit Rates",
        data: {
          embedding: aggregated.cache_hit_rates.embedding,
          reranking: aggregated.cache_hit_rates.reranking,
          query: aggregated.cache_hit_rates.query,
        },
        config: {
          chart_type: "bar",
          unit: "%",
        },
      },
      {
        id: "ai-model-costs",
        type: "metric",
        title: "AI Model Costs",
        data: {
          total: aggregated.ai_model_costs.total,
          by_model: aggregated.ai_model_costs.by_model,
        },
        config: {
          unit: "$",
        },
      },
      {
        id: "active-alerts",
        type: "alert",
        title: "Active Alerts",
        data: {
          alerts: activeAlerts,
          count: activeAlerts.length,
        },
      },
      {
        id: "top-endpoints",
        type: "table",
        title: "Top Endpoints by Request Count",
        data: {
          rows: this.getTopEndpoints(summary.counters),
        },
      },
    ];

    return {
      id: "system-dashboard",
      name: "System Dashboard",
      widgets,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Build custom dashboard
   */
  async buildCustomDashboard(
    name: string,
    widgetConfigs: Array<{
      type: DashboardWidget["type"];
      metric?: string;
      title: string;
      config?: Record<string, unknown>;
    }>
  ): Promise<Dashboard> {
    const summary = metrics.getSummary();
    const widgets: DashboardWidget[] = [];

    for (const config of widgetConfigs) {
      let data: unknown;

      switch (config.type) {
        case "metric":
          if (config.metric) {
            data = {
              value: summary.counters[config.metric] || summary.gauges[config.metric] || 0,
            };
          }
          break;
        case "chart":
          if (config.metric) {
            const histogram = summary.histograms[config.metric];
            data = histogram ? {
              count: histogram.count,
              avg: histogram.avg,
              p95: histogram.p95,
            } : {};
          }
          break;
        case "table":
          data = { rows: [] };
          break;
        case "alert":
          data = { alerts: alerting.getActiveAlerts() };
          break;
      }

      widgets.push({
        id: `widget-${Date.now()}-${widgets.length}`,
        type: config.type,
        title: config.title,
        data,
        config: config.config,
      });
    }

    return {
      id: `dashboard-${Date.now()}`,
      name,
      widgets,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Get top endpoints by request count
   */
  private getTopEndpoints(counters: Record<string, number>): Array<{
    endpoint: string;
    requests: number;
    errors: number;
  }> {
    const endpoints: Record<string, { requests: number; errors: number }> = {};

    for (const [key, value] of Object.entries(counters)) {
      if (key.includes("endpoint")) {
        const match = key.match(/endpoint="([^"]+)"/);
        if (match) {
          const endpoint = match[1];
          if (!endpoints[endpoint]) {
            endpoints[endpoint] = { requests: 0, errors: 0 };
          }
          
          if (key.includes("_total")) {
            endpoints[endpoint].requests += value;
          } else if (key.includes("_error")) {
            endpoints[endpoint].errors += value;
          }
        }
      }
    }

    return Object.entries(endpoints)
      .map(([endpoint, data]) => ({
        endpoint,
        requests: data.requests,
        errors: data.errors,
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
  }
}

export const dashboardBuilder = new DashboardBuilder();
