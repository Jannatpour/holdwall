/**
 * Health Monitor
 * 
 * Continuous health monitoring with auto-recovery
 * Monitors services and automatically recovers when possible
 */

import { checkHealth, type SystemHealth } from "@/lib/monitoring/health";
import { degradedMode } from "./fallback-handler";
import { CircuitBreaker } from "./circuit-breaker";

export interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  lastCheck: string;
  consecutiveFailures: number;
  circuitBreaker?: CircuitBreaker;
}

export class HealthMonitor {
  private services = new Map<string, ServiceHealth>();
  private checkInterval: NodeJS.Timeout | null = null;
  private recoveryInterval: NodeJS.Timeout | null = null;

  /**
   * Register service for monitoring
   */
  registerService(
    name: string,
    healthCheck: () => Promise<boolean>,
    circuitBreaker?: CircuitBreaker
  ): void {
    this.services.set(name, {
      name,
      status: "healthy",
      lastCheck: new Date().toISOString(),
      consecutiveFailures: 0,
      circuitBreaker,
    });

    // Start monitoring if not already started
    if (!this.checkInterval) {
      this.startMonitoring();
    }
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(async () => {
      await this.checkAllServices();
    }, intervalMs);

    // Start recovery attempts
    this.recoveryInterval = setInterval(async () => {
      await this.attemptRecovery();
    }, 60000); // Check recovery every minute
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }
  }

  /**
   * Check all services
   */
  private async checkAllServices(): Promise<void> {
    const systemHealth = await checkHealth();

    // Update service health based on system health
    if (systemHealth.checks.database === "error") {
      this.updateServiceHealth("database", false);
    } else {
      this.updateServiceHealth("database", true);
    }

    if (systemHealth.checks.cache === "error") {
      this.updateServiceHealth("cache", false);
    } else {
      this.updateServiceHealth("cache", true);
    }
  }

  /**
   * Update service health status
   */
  private updateServiceHealth(name: string, isHealthy: boolean): void {
    const service = this.services.get(name);
    if (!service) {
      return;
    }

    service.lastCheck = new Date().toISOString();

    if (isHealthy) {
      service.consecutiveFailures = 0;
      if (service.status !== "healthy") {
        service.status = "healthy";
        degradedMode.markRecovered(name);
        if (service.circuitBreaker) {
          service.circuitBreaker.reset();
        }
      }
    } else {
      service.consecutiveFailures++;
      
      if (service.consecutiveFailures >= 3) {
        service.status = "unhealthy";
        degradedMode.markDegraded(name);
      } else if (service.consecutiveFailures >= 1) {
        service.status = "degraded";
      }
    }
  }

  /**
   * Attempt recovery for unhealthy services
   */
  private async attemptRecovery(): Promise<void> {
    for (const service of this.services.values()) {
      if (service.status === "unhealthy" || service.status === "degraded") {
        // Try to recover by checking health
        const systemHealth = await checkHealth();
        
        let isHealthy = false;
        if (service.name === "database") {
          isHealthy = systemHealth.checks.database === "ok";
        } else if (service.name === "cache") {
          isHealthy = systemHealth.checks.cache === "ok";
        }

        if (isHealthy) {
          service.status = "healthy";
          service.consecutiveFailures = 0;
          degradedMode.markRecovered(service.name);
          if (service.circuitBreaker) {
            service.circuitBreaker.reset();
          }
        }
      }
    }
  }

  /**
   * Get service health
   */
  getServiceHealth(name: string): ServiceHealth | undefined {
    return this.services.get(name);
  }

  /**
   * Get all service health statuses
   */
  getAllServiceHealth(): ServiceHealth[] {
    return Array.from(this.services.values());
  }

  /**
   * Get overall system health
   */
  async getOverallHealth(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    services: ServiceHealth[];
    degradedServices: string[];
  }> {
    const services = this.getAllServiceHealth();
    const degradedServices = degradedMode.getDegradedServices();

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (services.some(s => s.status === "unhealthy")) {
      status = "unhealthy";
    } else if (services.some(s => s.status === "degraded") || degradedServices.length > 0) {
      status = "degraded";
    }

    return {
      status,
      services,
      degradedServices,
    };
  }
}

export const healthMonitor = new HealthMonitor();

// Initialize monitoring for core services
const dbCircuitBreaker = new CircuitBreaker({ failureThreshold: 5, timeout: 60000 });
const cacheCircuitBreaker = new CircuitBreaker({ failureThreshold: 5, timeout: 60000 });

healthMonitor.registerService("database", async () => {
  try {
    const { db } = await import("@/lib/db/client");
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}, dbCircuitBreaker);

healthMonitor.registerService("cache", async () => {
  try {
    const { getRedisPool } = await import("@/lib/performance/connection-pool");
    const redis = getRedisPool();
    if (!redis) {
      return true; // Cache is optional
    }
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}, cacheCircuitBreaker);

// Start monitoring
healthMonitor.startMonitoring();
