/**
 * Provider Health Monitoring
 * 
 * Monitors AI provider health and availability for intelligent routing decisions.
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { CircuitBreaker } from "@/lib/resilience/circuit-breaker";
import { LLMProvider } from "@/lib/llm/providers";

export type ProviderName = "openai" | "anthropic" | "generic";

export interface ProviderHealth {
  provider: ProviderName;
  status: "healthy" | "degraded" | "unhealthy";
  latency: number; // ms
  errorRate: number; // 0-1
  lastCheck: Date;
  consecutiveFailures: number;
  circuitBreakerState: "closed" | "open" | "half-open";
}

export interface HealthCheckResult {
  provider: ProviderName;
  healthy: boolean;
  latency: number;
  error?: string;
}

/**
 * Provider Health Monitor
 */
export class ProviderHealthMonitor {
  private healthStatus: Map<ProviderName, ProviderHealth> = new Map();
  private circuitBreakers: Map<ProviderName, CircuitBreaker> = new Map();
  private llmProvider: LLMProvider;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs = 60000; // 1 minute

  constructor() {
    this.llmProvider = new LLMProvider();
    this.initializeProviders();
  }

  /**
   * Initialize provider health tracking
   */
  private initializeProviders(): void {
    const providers: ProviderName[] = ["openai", "anthropic"];
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

      const circuitBreaker = new CircuitBreaker({
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
  start(): void {
    if (this.checkInterval) {
      return; // Already started
    }

    // Initial check
    this.checkAllProviders();

    // Periodic checks
    this.checkInterval = setInterval(() => {
      this.checkAllProviders();
    }, this.checkIntervalMs);

    logger.info("Provider health monitoring started");
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info("Provider health monitoring stopped");
  }

  /**
   * Check all providers
   */
  private async checkAllProviders(): Promise<void> {
    const providers: ProviderName[] = ["openai", "anthropic"];
    const checks = providers.map((provider) => this.checkProvider(provider));
    await Promise.allSettled(checks);
  }

  /**
   * Check single provider health
   */
  async checkProvider(provider: ProviderName): Promise<HealthCheckResult> {
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
      const health = this.healthStatus.get(provider)!;
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

      metrics.gauge(`provider_health_latency_ms{provider="${provider}"}`, latency);
      metrics.gauge(`provider_health_status{provider="${provider}"}`, stats.state === "closed" ? 1 : 0);

      logger.debug("Provider health check succeeded", { provider, latency });

      return {
        provider,
        healthy: true,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const health = this.healthStatus.get(provider)!;
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

      metrics.increment(`provider_health_checks_failed_total{provider="${provider}"}`);
      logger.warn("Provider health check failed", {
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
  getProviderHealth(provider: ProviderName): ProviderHealth | null {
    return this.healthStatus.get(provider) || null;
  }

  /**
   * Get all provider health statuses
   */
  getAllProviderHealth(): Map<ProviderName, ProviderHealth> {
    return new Map(this.healthStatus);
  }

  /**
   * Check if provider is healthy
   */
  isProviderHealthy(provider: ProviderName): boolean {
    const health = this.healthStatus.get(provider);
    if (!health) {
      return false;
    }
    return health.status === "healthy" && health.circuitBreakerState === "closed";
  }

  /**
   * Get recommended provider (healthiest)
   */
  getRecommendedProvider(): ProviderName | null {
    let bestProvider: ProviderName | null = null;
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

// Singleton instance
let healthMonitorInstance: ProviderHealthMonitor | null = null;

export function getProviderHealthMonitor(): ProviderHealthMonitor {
  if (!healthMonitorInstance) {
    healthMonitorInstance = new ProviderHealthMonitor();
    if (process.env.NODE_ENV === "production") {
      healthMonitorInstance.start();
    }
  }
  return healthMonitorInstance;
}
