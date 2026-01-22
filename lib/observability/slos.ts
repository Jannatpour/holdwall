/**
 * Service Level Objectives (SLOs)
 * Define and monitor SLOs for production reliability
 */

import { db } from "@/lib/db/client";
import { metrics } from "@/lib/observability/metrics";
import { logger } from "@/lib/logging/logger";

export interface SLO {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  target: number; // Target percentage (0-100)
  window: "1h" | "24h" | "7d" | "30d";
  metric: string; // Metric name (e.g., "api_availability", "p95_latency")
  threshold?: number; // Threshold value for the metric
  enabled: boolean;
  currentValue?: number;
  status?: "HEALTHY" | "WARNING" | "BREACH";
  lastChecked?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SLOMeasurement {
  sloId: string;
  timestamp: Date;
  value: number;
  status: "HEALTHY" | "WARNING" | "BREACH";
  metadata?: Record<string, unknown>;
}

/**
 * SLO Monitoring Service
 */
export class SLOService {
  /**
   * Define an SLO
   */
  async define(
    tenantId: string,
    name: string,
    target: number,
    window: SLO["window"],
    metric: string,
    options?: {
      description?: string;
      threshold?: number;
    }
  ): Promise<string> {
    // Store SLO definition (in production, use database)
    // For now, we'll use in-memory storage with metrics tracking
    const sloId = `slo:${tenantId}:${name}`;

    // Track SLO definition
    metrics.setGauge("slo_defined", 1, {
      tenant: tenantId,
      name,
      target: target.toString(),
      window,
    });

    logger.info("SLO defined", {
      tenantId,
      name,
      target,
      window,
      metric,
    });

    return sloId;
  }

  /**
   * Measure SLO compliance
   */
  async measure(
    tenantId: string,
    name: string,
    metric: string,
    window: SLO["window"]
  ): Promise<{
    value: number;
    target: number;
    status: "HEALTHY" | "WARNING" | "BREACH";
    compliance: number; // Percentage
  }> {
    // Get metric value from metrics collector
    const metricValue = this.getMetricValue(metric, window);

    // Define target (in production, load from database)
    const target = 99.9; // Default target

    // Calculate compliance
    const compliance = metricValue >= target ? 100 : (metricValue / target) * 100;
    const status: "HEALTHY" | "WARNING" | "BREACH" =
      compliance >= 100
        ? "HEALTHY"
        : compliance >= 95
        ? "WARNING"
        : "BREACH";

    // Track SLO measurement
    metrics.setGauge("slo_compliance", compliance, {
      tenant: tenantId,
      name,
      status,
    });

    metrics.setGauge("slo_value", metricValue, {
      tenant: tenantId,
      name,
    });

    logger.info("SLO measured", {
      tenantId,
      name,
      value: metricValue,
      target,
      compliance,
      status,
    });

    return {
      value: metricValue,
      target,
      status,
      compliance,
    };
  }

  /**
   * Get metric value for a time window
   */
  private getMetricValue(metric: string, window: SLO["window"]): number {
    // Query metrics from metrics collector
    const summary = metrics.getSummary();

    switch (metric) {
      case "api_availability":
        // Calculate availability from error rate
        const errorRate = summary.counters[`${metric}_errors_total`] || 0;
        const totalRequests = summary.counters[`${metric}_total`] || 1;
        return totalRequests > 0 ? ((totalRequests - errorRate) / totalRequests) * 100 : 100;

      case "p95_latency":
        // Get p95 latency from histograms
        const histogram = summary.histograms[`${metric}_duration_ms`];
        return histogram?.p95 || 0;

      case "error_rate":
        const errors = summary.counters[`${metric}_errors_total`] || 0;
        const requests = summary.counters[`${metric}_total`] || 1;
        return (errors / requests) * 100;

      default:
        // Default to 99.9% for unknown metrics
        return 99.9;
    }
  }

  /**
   * Check all SLOs for a tenant
   */
  async checkAll(tenantId: string): Promise<SLOMeasurement[]> {
    // In production, load SLO definitions from database
    // For now, check common SLOs
    const commonSLOs = [
      { name: "api_availability", metric: "api_availability", window: "24h" as const },
      { name: "p95_latency", metric: "p95_latency", window: "24h" as const },
      { name: "error_rate", metric: "error_rate", window: "24h" as const },
    ];

    const measurements: SLOMeasurement[] = [];

    for (const slo of commonSLOs) {
      const measurement = await this.measure(tenantId, slo.name, slo.metric, slo.window);
      measurements.push({
        sloId: `slo:${tenantId}:${slo.name}`,
        timestamp: new Date(),
        value: measurement.value,
        status: measurement.status,
        metadata: {
          target: measurement.target,
          compliance: measurement.compliance,
        },
      });
    }

    return measurements;
  }

  /**
   * Get SLO status summary
   */
  async getStatus(tenantId: string): Promise<{
    healthy: number;
    warning: number;
    breach: number;
    total: number;
  }> {
    const measurements = await this.checkAll(tenantId);

    const summary = {
      healthy: 0,
      warning: 0,
      breach: 0,
      total: measurements.length,
    };

    for (const measurement of measurements) {
      if (measurement.status === "HEALTHY") {
        summary.healthy++;
      } else if (measurement.status === "WARNING") {
        summary.warning++;
      } else {
        summary.breach++;
      }
    }

    return summary;
  }
}

export const sloService = new SLOService();

/**
 * Predefined SLOs
 */
export const PREDEFINED_SLOS = {
  API_AVAILABILITY: {
    name: "api_availability",
    target: 99.9,
    window: "24h" as const,
    metric: "api_availability",
    description: "API availability should be >= 99.9%",
  },
  P95_LATENCY: {
    name: "p95_latency",
    target: 500, // milliseconds
    window: "24h" as const,
    metric: "p95_latency",
    description: "P95 latency should be <= 500ms",
  },
  ERROR_RATE: {
    name: "error_rate",
    target: 0.1, // percentage
    window: "24h" as const,
    metric: "error_rate",
    description: "Error rate should be <= 0.1%",
  },
};
