"use strict";
/**
 * Metrics Collection
 * Production-ready metrics with Prometheus-compatible format
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = exports.MetricsCollector = void 0;
exports.trackMetrics = trackMetrics;
const logger_1 = require("@/lib/logging/logger");
class MetricsCollector {
    constructor() {
        this.metrics = new Map();
        this.counters = new Map();
        this.gauges = new Map();
        this.histograms = new Map();
    }
    /**
     * Increment a counter
     */
    increment(name, labels, value = 1) {
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
    setGauge(name, value, labels) {
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
    gauge(name, value, labels) {
        this.setGauge(name, value, labels);
    }
    /**
     * Record a histogram value
     */
    observe(name, value, labels) {
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
    histogram(name, value, labels) {
        this.observe(name, value, labels);
    }
    /**
     * Record a metric
     */
    record(metric) {
        const key = metric.name;
        if (!this.metrics.has(key)) {
            this.metrics.set(key, []);
        }
        const metrics = this.metrics.get(key);
        metrics.push(metric);
        // Keep only last 1000 metrics per name
        if (metrics.length > 1000) {
            metrics.shift();
        }
        // Log to structured logger
        logger_1.logger.info("metric", {
            name: metric.name,
            value: metric.value,
            labels: metric.labels,
            timestamp: metric.timestamp,
        });
    }
    /**
     * Get metrics in Prometheus format
     */
    getPrometheusFormat() {
        const lines = [];
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
    getSummary() {
        const counters = {};
        for (const [key, value] of this.counters.entries()) {
            counters[key] = value;
        }
        const gauges = {};
        for (const [key, value] of this.gauges.entries()) {
            gauges[key] = value;
        }
        const histograms = {};
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
    reset() {
        this.metrics.clear();
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
    }
    getKey(name, labels) {
        if (!labels) {
            return name;
        }
        const labelStr = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(",");
        return `${name}{${labelStr}}`;
    }
    parseKey(key) {
        const match = key.match(/^(.+?)(\{(.+)\})?$/);
        if (!match) {
            return { name: key };
        }
        const name = match[1];
        const labelStr = match[3];
        if (!labelStr) {
            return { name };
        }
        const labels = {};
        for (const pair of labelStr.split(",")) {
            const [k, v] = pair.split("=");
            if (k && v) {
                labels[k] = v.replace(/"/g, "");
            }
        }
        return { name, labels };
    }
}
exports.MetricsCollector = MetricsCollector;
exports.metrics = new MetricsCollector();
/**
 * Metric decorator for functions
 */
function trackMetrics(name, labels) {
    return (target, propertyName, descriptor) => {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            const startTime = Date.now();
            let success = false;
            try {
                const result = await method.apply(this, args);
                success = true;
                const duration = Date.now() - startTime;
                exports.metrics.increment(`${name}_total`, labels?.(args, result), 1);
                exports.metrics.increment(`${name}_success`, labels?.(args, result), 1);
                exports.metrics.observe(`${name}_duration_ms`, duration, labels?.(args, result));
                return result;
            }
            catch (error) {
                const duration = Date.now() - startTime;
                exports.metrics.increment(`${name}_total`, labels?.(args), 1);
                exports.metrics.increment(`${name}_error`, labels?.(args), 1);
                exports.metrics.observe(`${name}_duration_ms`, duration, labels?.(args));
                throw error;
            }
        };
        return descriptor;
    };
}
