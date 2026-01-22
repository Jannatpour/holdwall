/**
 * Adaptive Rate Limiting
 * 
 * Implements intelligent rate limiting with adaptive throttling based on
 * system load, user behavior, and threat detection
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { getRedisClient } from "@/lib/cache/redis";

export interface AdaptiveRateLimitConfig {
  baseLimit: number; // base requests per window
  windowMs: number; // time window in milliseconds
  adaptiveEnabled: boolean;
  loadBasedScaling: boolean;
  threatBasedScaling: boolean;
  minLimit: number; // minimum limit even under load
  maxLimit: number; // maximum limit
  scaleDownFactor: number; // 0-1, how much to reduce under load
  scaleUpFactor: number; // >1, how much to increase when safe
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // seconds
  reason?: string;
}

export class AdaptiveRateLimiter {
  private config: AdaptiveRateLimitConfig;
  private redis?: ReturnType<typeof getRedisClient>;
  private currentSystemLoad: number = 0; // 0-1
  private threatLevel: number = 0; // 0-1

  constructor(config: AdaptiveRateLimitConfig) {
    this.config = config;
    try {
      this.redis = getRedisClient();
    } catch (error) {
      logger.warn("Redis not available for adaptive rate limiting", { error });
    }
  }

  /**
   * Check rate limit with adaptive adjustment
   */
  async checkLimit(
    identifier: string,
    context?: {
      userId?: string;
      ip?: string;
      endpoint?: string;
      userRole?: string;
    }
  ): Promise<RateLimitResult> {
    // Calculate adaptive limit
    const adaptiveLimit = this.calculateAdaptiveLimit(context);

    // Get current count
    const key = `rate_limit:${identifier}`;
    const count = await this.getCount(key);

    // Check if limit exceeded
    const allowed = count < adaptiveLimit;
    const remaining = Math.max(0, adaptiveLimit - count);
    const resetAt = new Date(Date.now() + this.config.windowMs);

    if (!allowed) {
      // Increment violation count
      await this.recordViolation(identifier, context);

      // Calculate retry after
      const retryAfter = Math.ceil(this.config.windowMs / 1000);

      metrics.increment("rate_limit_violations", {
        identifier,
        endpoint: context?.endpoint || "unknown",
      });

      return {
        allowed: false,
        limit: adaptiveLimit,
        remaining: 0,
        resetAt,
        retryAfter,
        reason: "Rate limit exceeded",
      };
    }

    // Increment counter
    await this.incrementCount(key);

    metrics.increment("rate_limit_checks", { allowed: "true" });

    return {
      allowed: true,
      limit: adaptiveLimit,
      remaining: remaining - 1,
      resetAt,
    };
  }

  /**
   * Calculate adaptive limit based on context
   */
  private calculateAdaptiveLimit(context?: {
    userId?: string;
    userRole?: string;
    endpoint?: string;
  }): number {
    let limit = this.config.baseLimit;

    // Role-based limits
    if (context?.userRole) {
      const roleMultipliers: Record<string, number> = {
        ADMIN: 10,
        APPROVER: 5,
        USER: 1,
        VIEWER: 0.5,
      };
      limit *= roleMultipliers[context.userRole] || 1;
    }

    // Adaptive scaling based on system load
    if (this.config.adaptiveEnabled && this.config.loadBasedScaling) {
      const loadFactor = 1 - this.currentSystemLoad * this.config.scaleDownFactor;
      limit = Math.max(
        this.config.minLimit,
        Math.min(this.config.maxLimit, limit * loadFactor)
      );
    }

    // Threat-based scaling
    if (this.config.adaptiveEnabled && this.config.threatBasedScaling) {
      const threatFactor = 1 - this.threatLevel;
      limit = Math.max(
        this.config.minLimit,
        limit * threatFactor
      );
    }

    // Endpoint-based limits (strict for write operations)
    if (context?.endpoint) {
      if (context.endpoint.match(/\/api\/(claims|evidence|aaal|approvals)\//)) {
        limit = Math.floor(limit * 0.5); // Reduce for write operations
      }
    }

    return Math.floor(limit);
  }

  /**
   * Get current count
   */
  private async getCount(key: string): Promise<number> {
    if (this.redis) {
      try {
        const count = await this.redis.get(key);
        return parseInt(count || "0", 10);
      } catch (error) {
        logger.warn("Failed to get rate limit count from Redis", { error });
      }
    }

    return 0;
  }

  /**
   * Increment count
   */
  private async incrementCount(key: string): Promise<void> {
    if (this.redis) {
      try {
        const count = await this.redis.incr(key);
        if (count === 1) {
          await this.redis.expire(key, Math.floor(this.config.windowMs / 1000));
        }
      } catch (error) {
        logger.warn("Failed to increment rate limit count in Redis", { error });
      }
    }
  }

  /**
   * Record violation
   */
  private async recordViolation(
    identifier: string,
    context?: {
      userId?: string;
      ip?: string;
      endpoint?: string;
    }
  ): Promise<void> {
    const violationKey = `rate_limit_violations:${identifier}`;
    const window = 3600000; // 1 hour

    if (this.redis) {
      try {
        const violations = await this.redis.incr(violationKey);
        if (violations === 1) {
          await this.redis.expire(violationKey, Math.floor(window / 1000));
        }

        // Escalate if too many violations
        if (violations > 10) {
          await this.escalateViolations(identifier, context);
        }
      } catch (error) {
        logger.warn("Failed to record rate limit violation", { error });
      }
    }
  }

  /**
   * Escalate violations (temporary ban, etc.)
   */
  private async escalateViolations(
    identifier: string,
    context?: {
      userId?: string;
      ip?: string;
    }
  ): Promise<void> {
    logger.warn("Rate limit violations escalated", { identifier, context });

    // In production, would:
    // - Temporarily ban IP/user
    // - Send alert to security team
    // - Increase monitoring

    metrics.increment("rate_limit_escalations", { identifier });
  }

  /**
   * Update system load
   */
  updateSystemLoad(load: number): void {
    this.currentSystemLoad = Math.max(0, Math.min(1, load));
    metrics.setGauge("adaptive_rate_limit_system_load", this.currentSystemLoad);
  }

  /**
   * Update threat level
   */
  updateThreatLevel(level: number): void {
    this.threatLevel = Math.max(0, Math.min(1, level));
    metrics.setGauge("adaptive_rate_limit_threat_level", this.threatLevel);
  }

  /**
   * Get rate limit statistics
   */
  async getStatistics(identifier: string): Promise<{
    currentLimit: number;
    currentCount: number;
    violations: number;
    systemLoad: number;
    threatLevel: number;
  }> {
    const key = `rate_limit:${identifier}`;
    const violationKey = `rate_limit_violations:${identifier}`;

    const count = await this.getCount(key);
    const violations = this.redis
      ? parseInt((await this.redis.get(violationKey)) || "0", 10)
      : 0;

    const adaptiveLimit = this.calculateAdaptiveLimit();

    return {
      currentLimit: adaptiveLimit,
      currentCount: count,
      violations,
      systemLoad: this.currentSystemLoad,
      threatLevel: this.threatLevel,
    };
  }
}
