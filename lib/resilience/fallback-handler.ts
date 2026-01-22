/**
 * Fallback Handler
 * 
 * Graceful degradation with fallback mechanisms
 * Provides cached responses, default values, and degraded modes
 */

import { getCache } from "@/lib/cache/redis";
import { logger } from "@/lib/logging/logger";

export interface FallbackOptions<T> {
  cacheKey?: string;
  cacheTTL?: number;
  defaultValue?: T;
  degradedMode?: boolean;
}

/**
 * Execute with fallback
 */
export async function executeWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  options?: FallbackOptions<T>
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    logger.warn("Primary execution failed, using fallback", {
      error: error instanceof Error ? error.message : String(error),
      cacheKey: options?.cacheKey,
    });

    // Try cache if available
    if (options?.cacheKey) {
      const cached = await getCache<T>(options.cacheKey);
      if (cached) {
        logger.info("Using cached fallback", { cacheKey: options.cacheKey });
        return cached;
      }
    }

    // Try fallback function
    try {
      return await fallback();
    } catch (fallbackError) {
      logger.error("Fallback also failed", {
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        originalError: error instanceof Error ? error.message : String(error),
      });

      // Return default value if provided
      if (options?.defaultValue !== undefined) {
        logger.info("Using default value as final fallback");
        return options.defaultValue;
      }

      throw fallbackError;
    }
  }
}

/**
 * Degraded mode handler
 * Provides reduced functionality when services are unavailable
 */
export class DegradedModeHandler {
  private degradedServices = new Set<string>();

  /**
   * Mark service as degraded
   */
  markDegraded(service: string): void {
    this.degradedServices.add(service);
  }

  /**
   * Mark service as recovered
   */
  markRecovered(service: string): void {
    this.degradedServices.delete(service);
  }

  /**
   * Check if service is degraded
   */
  isDegraded(service: string): boolean {
    return this.degradedServices.has(service);
  }

  /**
   * Get all degraded services
   */
  getDegradedServices(): string[] {
    return Array.from(this.degradedServices);
  }

  /**
   * Execute with degraded mode support
   */
  async execute<T>(
    service: string,
    primary: () => Promise<T>,
    degraded: () => Promise<T>
  ): Promise<T> {
    if (this.isDegraded(service)) {
      logger.warn("Service is in degraded mode", { service });
      return degraded();
    }

    try {
      return await primary();
    } catch (error) {
      logger.warn("Service failed, entering degraded mode", {
        service,
        error: error instanceof Error ? error.message : String(error),
      });
      this.markDegraded(service);
      return degraded();
    }
  }
}

export const degradedMode = new DegradedModeHandler();
