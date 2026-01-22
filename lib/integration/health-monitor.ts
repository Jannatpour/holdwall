/**
 * Health Monitor
 * Comprehensive system health monitoring
 */

import { checkHealth, type HealthStatus } from "@/lib/monitoring/health";
import { metrics } from "@/lib/observability/metrics";
import { logger } from "@/lib/logging/logger";

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: number;
  checks: HealthStatus["checks"];
  uptime: number;
  version: string;
}

export class HealthMonitor {
  private startTime: number = Date.now();
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Start periodic health checks
   */
  start(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, intervalMs);

    // Perform initial check
    this.performHealthCheck();
  }

  /**
   * Stop health checks
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<SystemHealth> {
    const health = await checkHealth();
    const uptime = Date.now() - this.startTime;

    // Determine overall status
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (health.checks.database === "error") {
      status = "unhealthy";
    } else if (health.checks.cache === "error" || health.checks.memory?.status === "warning") {
      status = "degraded";
    }

    const systemHealth: SystemHealth = {
      status,
      timestamp: Date.now(),
      checks: health.checks,
      uptime,
      version: process.env.npm_package_version || "0.1.0",
    };

    // Record metrics
    metrics.setGauge("system_health_status", status === "healthy" ? 1 : status === "degraded" ? 0.5 : 0);
    metrics.setGauge("system_uptime_seconds", Math.floor(uptime / 1000));

    // Log if unhealthy
    if (status !== "healthy") {
      logger.warn("System health check", systemHealth);
    }

    return systemHealth;
  }

  /**
   * Get current health status
   */
  async getHealth(): Promise<SystemHealth> {
    return this.performHealthCheck();
  }
}

export const healthMonitor = new HealthMonitor();

// Start health monitoring in production
if (process.env.NODE_ENV === "production") {
  healthMonitor.start();
}
