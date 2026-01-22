/**
 * Metrics Collection
 * Production-ready metrics with Prometheus-compatible format
 */

import { logger } from "@/lib/logging/logger";

export interface Metric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: number;
}

export type MetricType = "counter" | "gauge" | "histogram" | "summary";

export class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  /**
   * Increment a counter
   */
  increment(name: string, labels?: Record<string, string>, value: number = 1): void {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);

    this.record({
      name,
      value: current + value,
      labels,
      timestamp: Date.now(),
    });
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);

    this.record({
      name,
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  /**
   * Set a gauge value (alias for setGauge)
   */
  gauge(name: string, value: number, labels?: Record<string, string>): void {
    this.setGauge(name, value, labels);
  }

  /**
   * Record a histogram value
   */
  observe(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);

    this.record({
      name,
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  /**
   * Record a histogram value (alias for observe)
   */
  histogram(name: string, value: number, labels?: Record<string, string>): void {
    this.observe(name, value, labels);
  }

  /**
   * Record a metric
   */
  private record(metric: Metric): void {
    const key = metric.name;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    const metrics = this.metrics.get(key)!;
    metrics.push(metric);

    // Keep only last 1000 metrics per name
    if (metrics.length > 1000) {
      metrics.shift();
    }

    // Log to structured logger
    logger.info("metric", {
      name: metric.name,
      value: metric.value,
      labels: metric.labels,
      timestamp: metric.timestamp,
    });
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusFormat(): string {
    const lines: string[] = [];

    // Counters
    for (const [key, value] of this.counters.entries()) {
      const { name, labels } = this.parseKey(key);
      const labelStr = labels
        ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",")}}`
        : "";
      lines.push(`${name}_total${labelStr} ${value}`);
    }

    // Gauges
    for (const [key, value] of this.gauges.entries()) {
      const { name, labels } = this.parseKey(key);
      const labelStr = labels
        ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",")}}`
        : "";
      lines.push(`${name}${labelStr} ${value}`);
    }

    // Histograms (summary)
    for (const [key, values] of this.histograms.entries()) {
      const { name, labels } = this.parseKey(key);
      const labelStr = labels
        ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",")}}`
        : "";
      const sorted = [...values].sort((a, b) => a - b);
      const count = sorted.length;
      const sum = sorted.reduce((a, b) => a + b, 0);
      const avg = count > 0 ? sum / count : 0;
      const p50 = sorted[Math.floor(count * 0.5)] || 0;
      const p95 = sorted[Math.floor(count * 0.95)] || 0;
      const p99 = sorted[Math.floor(count * 0.99)] || 0;

      lines.push(`${name}_count${labelStr} ${count}`);
      lines.push(`${name}_sum${labelStr} ${sum}`);
      lines.push(`${name}_avg${labelStr} ${avg}`);
      lines.push(`${name}_p50${labelStr} ${p50}`);
      lines.push(`${name}_p95${labelStr} ${p95}`);
      lines.push(`${name}_p99${labelStr} ${p99}`);
    }

    return lines.join("\n");
  }

  /**
   * Get metrics summary
   */
  getSummary(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, { count: number; avg: number; p95: number }>;
  } {
    const counters: Record<string, number> = {};
    for (const [key, value] of this.counters.entries()) {
      counters[key] = value;
    }

    const gauges: Record<string, number> = {};
    for (const [key, value] of this.gauges.entries()) {
      gauges[key] = value;
    }

    const histograms: Record<string, { count: number; avg: number; p95: number }> = {};
    for (const [key, values] of this.histograms.entries()) {
      const sorted = [...values].sort((a, b) => a - b);
      const count = sorted.length;
      const sum = sorted.reduce((a, b) => a + b, 0);
      const avg = count > 0 ? sum / count : 0;
      const p95 = sorted[Math.floor(count * 0.95)] || 0;
      histograms[key] = { count, avg, p95 };
    }

    return { counters, gauges, histograms };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    return `${name}{${labelStr}}`;
  }

  private parseKey(key: string): { name: string; labels?: Record<string, string> } {
    const match = key.match(/^(.+?)(\{(.+)\})?$/);
    if (!match) {
      return { name: key };
    }

    const name = match[1];
    const labelStr = match[3];
    if (!labelStr) {
      return { name };
    }

    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",")) {
      const [k, v] = pair.split("=");
      if (k && v) {
        labels[k] = v.replace(/"/g, "");
      }
    }

    return { name, labels };
  }
}

export const metrics = new MetricsCollector();

/**
 * Metric decorator for functions
 */
export function trackMetrics(
  name: string,
  labels?: (args: any[], result?: any) => Record<string, string>
) {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      let success = false;

      try {
        const result = await method.apply(this, args);
        success = true;
        const duration = Date.now() - startTime;

        metrics.increment(`${name}_total`, labels?.(args, result), 1);
        metrics.increment(`${name}_success`, labels?.(args, result), 1);
        metrics.observe(`${name}_duration_ms`, duration, labels?.(args, result));

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        metrics.increment(`${name}_total`, labels?.(args), 1);
        metrics.increment(`${name}_error`, labels?.(args), 1);
        metrics.observe(`${name}_duration_ms`, duration, labels?.(args));

        throw error;
      }
    };

    return descriptor;
  };
}
