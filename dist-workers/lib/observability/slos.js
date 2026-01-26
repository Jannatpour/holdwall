"use strict";
/**
 * Service Level Objectives (SLOs)
 * Define and monitor SLOs for production reliability
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PREDEFINED_SLOS = exports.sloService = exports.SLOService = void 0;
const metrics_1 = require("@/lib/observability/metrics");
const logger_1 = require("@/lib/logging/logger");
/**
 * SLO Monitoring Service
 */
class SLOService {
    /**
     * Define an SLO
     */
    async define(tenantId, name, target, window, metric, options) {
        // Store SLO definition (in production, use database)
        // For now, we'll use in-memory storage with metrics tracking
        const sloId = `slo:${tenantId}:${name}`;
        // Track SLO definition
        metrics_1.metrics.setGauge("slo_defined", 1, {
            tenant: tenantId,
            name,
            target: target.toString(),
            window,
        });
        logger_1.logger.info("SLO defined", {
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
    async measure(tenantId, name, metric, window) {
        // Get metric value from metrics collector
        const metricValue = this.getMetricValue(metric, window);
        // Define target (in production, load from database)
        const target = 99.9; // Default target
        // Calculate compliance
        const compliance = metricValue >= target ? 100 : (metricValue / target) * 100;
        const status = compliance >= 100
            ? "HEALTHY"
            : compliance >= 95
                ? "WARNING"
                : "BREACH";
        // Track SLO measurement
        metrics_1.metrics.setGauge("slo_compliance", compliance, {
            tenant: tenantId,
            name,
            status,
        });
        metrics_1.metrics.setGauge("slo_value", metricValue, {
            tenant: tenantId,
            name,
        });
        logger_1.logger.info("SLO measured", {
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
    getMetricValue(metric, window) {
        // Query metrics from metrics collector
        const summary = metrics_1.metrics.getSummary();
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
    async checkAll(tenantId) {
        // In production, load SLO definitions from database
        // For now, check common SLOs
        const commonSLOs = [
            { name: "api_availability", metric: "api_availability", window: "24h" },
            { name: "p95_latency", metric: "p95_latency", window: "24h" },
            { name: "error_rate", metric: "error_rate", window: "24h" },
        ];
        const measurements = [];
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
    async getStatus(tenantId) {
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
            }
            else if (measurement.status === "WARNING") {
                summary.warning++;
            }
            else {
                summary.breach++;
            }
        }
        return summary;
    }
}
exports.SLOService = SLOService;
exports.sloService = new SLOService();
/**
 * Predefined SLOs
 */
exports.PREDEFINED_SLOS = {
    API_AVAILABILITY: {
        name: "api_availability",
        target: 99.9,
        window: "24h",
        metric: "api_availability",
        description: "API availability should be >= 99.9%",
    },
    P95_LATENCY: {
        name: "p95_latency",
        target: 500, // milliseconds
        window: "24h",
        metric: "p95_latency",
        description: "P95 latency should be <= 500ms",
    },
    ERROR_RATE: {
        name: "error_rate",
        target: 0.1, // percentage
        window: "24h",
        metric: "error_rate",
        description: "Error rate should be <= 0.1%",
    },
};
