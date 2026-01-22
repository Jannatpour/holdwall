/**
 * Enhanced Feature Flags System
 * Gradual rollout, A/B testing, and comprehensive management
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { getRedisClient } from "@/lib/cache/redis";
import { db } from "@/lib/db/client";

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  rollout_percentage?: number;
  target_users?: string[];
  target_tenants?: string[];
  target_roles?: string[];
  conditions?: FeatureFlagCondition[];
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FeatureFlagCondition {
  type: "user_property" | "tenant_property" | "date_range" | "custom";
  property: string;
  operator: "equals" | "contains" | "greater_than" | "less_than" | "in";
  value: unknown;
}

export interface FeatureFlagUsage {
  flagName: string;
  userId?: string;
  tenantId?: string;
  enabled: boolean;
  timestamp: Date;
}

class FeatureFlagManager {
  private flags: Map<string, FeatureFlag> = new Map();
  private redis?: ReturnType<typeof getRedisClient>;
  private usageTracking: Map<string, FeatureFlagUsage[]> = new Map();

  constructor() {
    this.initializeFlags();
    try {
      this.redis = getRedisClient();
    } catch (error) {
      logger.warn("Redis not available for feature flags", { error });
    }
  }

  /**
   * Initialize default feature flags
   */
  private initializeFlags(): void {
    const defaultFlags: FeatureFlag[] = [
      {
        name: "ai-orchestration",
        enabled: true,
        description: "AI orchestration with RAG/KAG pipelines",
        rollout_percentage: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "advanced-graph",
        enabled: true,
        description: "Advanced graph neural network features",
        rollout_percentage: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "real-time-forecasts",
        enabled: false,
        description: "Real-time forecasting capabilities",
        rollout_percentage: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "autopilot-modes",
        enabled: true,
        description: "Autopilot workflow automation",
        rollout_percentage: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "graphql-federation",
        enabled: true,
        description: "Federated GraphQL API",
        rollout_percentage: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "kafka-streaming",
        enabled: true,
        description: "Kafka event streaming",
        rollout_percentage: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "threat-detection",
        enabled: true,
        description: "Advanced threat detection",
        rollout_percentage: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "adaptive-rate-limiting",
        enabled: true,
        description: "Adaptive rate limiting",
        rollout_percentage: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const flag of defaultFlags) {
      this.flags.set(flag.name, flag);
    }
  }

  /**
   * Check if feature is enabled
   */
  async isFeatureEnabled(
    flagName: string,
    context?: {
      userId?: string;
      tenantId?: string;
      userRole?: string;
      userProperties?: Record<string, unknown>;
      tenantProperties?: Record<string, unknown>;
    }
  ): Promise<boolean> {
    // Try Redis cache first
    if (this.redis && context?.userId) {
      const cacheKey = `feature_flag:${flagName}:${context.userId}`;
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached !== null) {
          return cached === "true";
        }
      } catch (error) {
        logger.warn("Failed to get feature flag from cache", { error });
      }
    }

    const flag = this.flags.get(flagName);
    if (!flag) {
      metrics.increment("feature_flag_not_found", { flag_name: flagName });
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    // Check tenant targeting
    if (flag.target_tenants && context?.tenantId) {
      const enabled = flag.target_tenants.includes(context.tenantId);
      await this.trackUsage(flagName, context, enabled);
      return enabled;
    }

    // Check user targeting
    if (flag.target_users && context?.userId) {
      const enabled = flag.target_users.includes(context.userId);
      await this.trackUsage(flagName, context, enabled);
      return enabled;
    }

    // Check role targeting
    if (flag.target_roles && context?.userRole) {
      const enabled = flag.target_roles.includes(context.userRole);
      await this.trackUsage(flagName, context, enabled);
      return enabled;
    }

    // Check conditions
    if (flag.conditions && context) {
      const conditionsMet = flag.conditions.every(condition =>
        this.evaluateCondition(condition, context)
      );
      if (!conditionsMet) {
        await this.trackUsage(flagName, context, false);
        return false;
      }
    }

    // Check rollout percentage
    if (flag.rollout_percentage !== undefined) {
      const enabled = this.checkRollout(flagName, flag.rollout_percentage, context);
      await this.trackUsage(flagName, context, enabled);

      // Cache result
      if (this.redis && context?.userId) {
        const cacheKey = `feature_flag:${flagName}:${context.userId}`;
        try {
          await this.redis.setex(cacheKey, 3600, enabled ? "true" : "false"); // Cache for 1 hour
        } catch (error) {
          logger.warn("Failed to cache feature flag", { error });
        }
      }

      return enabled;
    }

    await this.trackUsage(flagName, context, true);
    return true;
  }

  /**
   * Check rollout percentage
   */
  private checkRollout(
    flagName: string,
    percentage: number,
    context?: {
      userId?: string;
      tenantId?: string;
    }
  ): boolean {
    if (percentage >= 100) return true;
    if (percentage <= 0) return false;

    // Consistent hash-based rollout
    const identifier = context?.userId || context?.tenantId || "anonymous";
    const hash = this.hashString(identifier + flagName);
    return (hash % 100) < percentage;
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(
    condition: FeatureFlagCondition,
    context?: {
      userProperties?: Record<string, unknown>;
      tenantProperties?: Record<string, unknown>;
    }
  ): boolean {
    switch (condition.type) {
      case "user_property":
        if (!context?.userProperties) return false;
        return this.compareValue(
          context.userProperties[condition.property],
          condition.operator,
          condition.value
        );

      case "tenant_property":
        if (!context?.tenantProperties) return false;
        return this.compareValue(
          context.tenantProperties[condition.property],
          condition.operator,
          condition.value
        );

      case "date_range":
        const now = new Date();
        const range = (condition.value || {}) as { start?: string; end?: string };
        const start = range.start ? new Date(range.start) : new Date(0);
        const end = range.end ? new Date(range.end) : new Date("2999-12-31T23:59:59.999Z");
        return now >= start && now <= end;

      default:
        return false;
    }
  }

  /**
   * Compare values
   */
  private compareValue(actual: unknown, operator: string, expected: unknown): boolean {
    switch (operator) {
      case "equals":
        return actual === expected;
      case "contains":
        return String(actual).includes(String(expected));
      case "greater_than":
        return Number(actual) > Number(expected);
      case "less_than":
        return Number(actual) < Number(expected);
      case "in":
        return Array.isArray(expected) && expected.includes(actual);
      default:
        return false;
    }
  }

  /**
   * Track feature flag usage
   */
  private async trackUsage(
    flagName: string,
    context?: {
      userId?: string;
      tenantId?: string;
    },
    enabled?: boolean
  ): Promise<void> {
    const usage: FeatureFlagUsage = {
      flagName,
      userId: context?.userId,
      tenantId: context?.tenantId,
      enabled: enabled ?? false,
      timestamp: new Date(),
    };

    const key = `${flagName}:${context?.userId || context?.tenantId || "anonymous"}`;
    const history = this.usageTracking.get(key) || [];
    history.push(usage);
    this.usageTracking.set(key, history.slice(-100)); // Keep last 100

    metrics.increment("feature_flag_checked", {
      flag_name: flagName,
      enabled: enabled ? "true" : "false",
    });
  }

  /**
   * Get feature flag
   */
  getFlag(flagName: string): FeatureFlag | undefined {
    return this.flags.get(flagName);
  }

  /**
   * Set feature flag
   */
  setFlag(flag: FeatureFlag): void {
    flag.updatedAt = new Date();
    this.flags.set(flag.name, flag);
    logger.info("Feature flag updated", { flagName: flag.name, enabled: flag.enabled });
    metrics.increment("feature_flag_updated", { flag_name: flag.name });
  }

  /**
   * List all feature flags
   */
  listFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Get usage statistics
   */
  getUsageStatistics(flagName: string): {
    totalChecks: number;
    enabledCount: number;
    disabledCount: number;
    enableRate: number;
  } {
    const allUsage = Array.from(this.usageTracking.values()).flat();
    const flagUsage = allUsage.filter(u => u.flagName === flagName);

    const enabledCount = flagUsage.filter(u => u.enabled).length;
    const disabledCount = flagUsage.filter(u => !u.enabled).length;
    const totalChecks = flagUsage.length;
    const enableRate = totalChecks > 0 ? enabledCount / totalChecks : 0;

    return {
      totalChecks,
      enabledCount,
      disabledCount,
      enableRate,
    };
  }

  /**
   * Hash string
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Singleton instance
const featureFlagManager = new FeatureFlagManager();

/**
 * Check if feature is enabled (public API)
 */
export async function isFeatureEnabled(
  flagName: string,
  userId?: string,
  tenantId?: string,
  userRole?: string
): Promise<boolean> {
  return featureFlagManager.isFeatureEnabled(flagName, {
    userId,
    tenantId,
    userRole,
  });
}

/**
 * Get feature flag manager (for admin operations)
 */
export function getFeatureFlagManager(): FeatureFlagManager {
  return featureFlagManager;
}
