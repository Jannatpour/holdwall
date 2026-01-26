"use strict";
/**
 * Provider Health Monitoring
 *
 * Monitors AI provider health and availability for intelligent routing decisions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderHealthMonitor = void 0;
exports.getProviderHealthMonitor = getProviderHealthMonitor;
const logger_1 = require("@/lib/logging/logger");
const metrics_1 = require("@/lib/observability/metrics");
const circuit_breaker_1 = require("@/lib/resilience/circuit-breaker");
const providers_1 = require("@/lib/llm/providers");
/**
 * Provider Health Monitor
 */
class ProviderHealthMonitor {
    constructor() {
        this.healthStatus = new Map();
        this.circuitBreakers = new Map();
        this.checkInterval = null;
        this.checkIntervalMs = 60000; // 1 minute
        this.llmProvider = new providers_1.LLMProvider();
        this.initializeProviders();
    }
    /**
     * Initialize provider health tracking
     */
    initializeProviders() {
        const providers = ["openai", "anthropic"];
        for (const provider of providers) {
            this.healthStatus.set(provider, {
                provider,
                status: "healthy",
                latency: 0,
                errorRate: 0,
                lastCheck: new Date(),
                consecutiveFailures: 0,
                circuitBreakerState: "closed",
            });
            const circuitBreaker = new circuit_breaker_1.CircuitBreaker({
                failureThreshold: 3,
                successThreshold: 2,
                timeout: 120000, // 2 minutes
            });
            this.circuitBreakers.set(provider, circuitBreaker);
        }
    }
    /**
     * Start health monitoring
     */
    start() {
        if (this.checkInterval) {
            return; // Already started
        }
        // Initial check
        this.checkAllProviders();
        // Periodic checks
        this.checkInterval = setInterval(() => {
            this.checkAllProviders();
        }, this.checkIntervalMs);
        logger_1.logger.info("Provider health monitoring started");
    }
    /**
     * Stop health monitoring
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        logger_1.logger.info("Provider health monitoring stopped");
    }
    /**
     * Check all providers
     */
    async checkAllProviders() {
        const providers = ["openai", "anthropic"];
        const checks = providers.map((provider) => this.checkProvider(provider));
        await Promise.allSettled(checks);
    }
    /**
     * Check single provider health
     */
    async checkProvider(provider) {
        const startTime = Date.now();
        const circuitBreaker = this.circuitBreakers.get(provider);
        if (!circuitBreaker) {
            return {
                provider,
                healthy: false,
                latency: 0,
                error: "Circuit breaker not initialized",
            };
        }
        try {
            // Use a lightweight test request
            const testRequest = {
                model: provider === "openai" ? "gpt-4o-mini" : "claude-3-haiku-20240307",
                prompt: "test",
                max_tokens: 5,
            };
            await circuitBreaker.execute(async () => {
                await this.llmProvider.call(testRequest);
            });
            const latency = Date.now() - startTime;
            const health = this.healthStatus.get(provider);
            const stats = circuitBreaker.getStats();
            // Update health status
            this.healthStatus.set(provider, {
                ...health,
                status: stats.state === "closed" ? "healthy" : "degraded",
                latency: latency,
                errorRate: 0,
                lastCheck: new Date(),
                consecutiveFailures: 0,
                circuitBreakerState: stats.state,
            });
            metrics_1.metrics.gauge(`provider_health_latency_ms{provider="${provider}"}`, latency);
            metrics_1.metrics.gauge(`provider_health_status{provider="${provider}"}`, stats.state === "closed" ? 1 : 0);
            logger_1.logger.debug("Provider health check succeeded", { provider, latency });
            return {
                provider,
                healthy: true,
                latency,
            };
        }
        catch (error) {
            const latency = Date.now() - startTime;
            const health = this.healthStatus.get(provider);
            const stats = circuitBreaker.getStats();
            const consecutiveFailures = health.consecutiveFailures + 1;
            const errorRate = Math.min(consecutiveFailures / 10, 1); // Cap at 1.0
            // Update health status
            this.healthStatus.set(provider, {
                ...health,
                status: consecutiveFailures >= 3 ? "unhealthy" : "degraded",
                latency: latency,
                errorRate,
                lastCheck: new Date(),
                consecutiveFailures,
                circuitBreakerState: stats.state,
            });
            metrics_1.metrics.increment(`provider_health_checks_failed_total{provider="${provider}"}`);
            logger_1.logger.warn("Provider health check failed", {
                provider,
                latency,
                error: error instanceof Error ? error.message : String(error),
                consecutiveFailures,
            });
            return {
                provider,
                healthy: false,
                latency,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    /**
     * Get provider health status
     */
    getProviderHealth(provider) {
        return this.healthStatus.get(provider) || null;
    }
    /**
     * Get all provider health statuses
     */
    getAllProviderHealth() {
        return new Map(this.healthStatus);
    }
    /**
     * Check if provider is healthy
     */
    isProviderHealthy(provider) {
        const health = this.healthStatus.get(provider);
        if (!health) {
            return false;
        }
        return health.status === "healthy" && health.circuitBreakerState === "closed";
    }
    /**
     * Get recommended provider (healthiest)
     */
    getRecommendedProvider() {
        let bestProvider = null;
        let bestScore = -1;
        for (const [provider, health] of this.healthStatus.entries()) {
            if (health.status !== "healthy") {
                continue;
            }
            // Score: lower latency + lower error rate = better
            const score = 1 / (1 + health.latency / 1000) * (1 - health.errorRate);
            if (score > bestScore) {
                bestScore = score;
                bestProvider = provider;
            }
        }
        return bestProvider;
    }
}
exports.ProviderHealthMonitor = ProviderHealthMonitor;
// Singleton instance
let healthMonitorInstance = null;
function getProviderHealthMonitor() {
    if (!healthMonitorInstance) {
        healthMonitorInstance = new ProviderHealthMonitor();
        if (process.env.NODE_ENV === "production") {
            healthMonitorInstance.start();
        }
    }
    return healthMonitorInstance;
}
