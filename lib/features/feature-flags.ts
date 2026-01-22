/**
 * Feature Flags
 * 
 * Toggle features per tenant/user with gradual rollout
 */

import { getCache, setCache } from "@/lib/cache/redis";

export interface FeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  rollout_percentage: number; // 0-100
  target_tenants?: string[];
  target_users?: string[];
  conditions?: Record<string, unknown>; // Additional conditions
}

export interface FeatureFlagEvaluation {
  flag_id: string;
  enabled: boolean;
  reason: string;
}

/**
 * Feature Flag Service
 */
export class FeatureFlagService {
  private flags = new Map<string, FeatureFlag>();

  /**
   * Register feature flag
   */
  registerFlag(flag: FeatureFlag): void {
    this.flags.set(flag.id, flag);
  }

  /**
   * Evaluate feature flag for user/tenant
   */
  async evaluateFlag(
    flagId: string,
    tenantId: string,
    userId?: string
  ): Promise<FeatureFlagEvaluation> {
    const flag = this.flags.get(flagId);
    if (!flag) {
      return {
        flag_id: flagId,
        enabled: false,
        reason: "Flag not found",
      };
    }

    // Check cache
    const cacheKey = `feature_flag:${flagId}:${tenantId}:${userId || "anonymous"}`;
    const cached = await getCache<FeatureFlagEvaluation>(cacheKey);
    if (cached) {
      return cached;
    }

    let enabled = flag.enabled;

    // Check tenant targeting
    if (flag.target_tenants && flag.target_tenants.length > 0) {
      if (!flag.target_tenants.includes(tenantId)) {
        enabled = false;
      }
    }

    // Check user targeting
    if (enabled && flag.target_users && flag.target_users.length > 0 && userId) {
      if (!flag.target_users.includes(userId)) {
        enabled = false;
      }
    }

    // Check rollout percentage
    if (enabled && flag.rollout_percentage < 100) {
      // Deterministic rollout based on tenant/user ID
      const hash = this.hashString(`${flagId}:${tenantId}:${userId || ""}`);
      const percentage = (hash % 100) + 1;
      enabled = percentage <= flag.rollout_percentage;
    }

    // Check additional conditions
    if (enabled && flag.conditions) {
      enabled = this.evaluateConditions(flag.conditions, { tenantId, userId });
    }

    const evaluation: FeatureFlagEvaluation = {
      flag_id: flagId,
      enabled,
      reason: enabled ? "Flag enabled" : "Flag disabled by configuration",
    };

    // Cache evaluation (short TTL)
    await setCache(cacheKey, evaluation, { ttl: 60 }); // 1 minute

    return evaluation;
  }

  /**
   * Check if feature is enabled
   */
  async isEnabled(
    flagId: string,
    tenantId: string,
    userId?: string
  ): Promise<boolean> {
    const evaluation = await this.evaluateFlag(flagId, tenantId, userId);
    return evaluation.enabled;
  }

  /**
   * Hash string to number (0-99)
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Evaluate conditions
   */
  private evaluateConditions(
    conditions: Record<string, unknown>,
    context: { tenantId: string; userId?: string }
  ): boolean {
    // Simple condition evaluation
    // In production, would support more complex conditions
    for (const [key, value] of Object.entries(conditions)) {
      if (key === "tenant_id" && value !== context.tenantId) {
        return false;
      }
      if (key === "user_id" && value !== context.userId) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get all flags
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }
}

export const featureFlags = new FeatureFlagService();

// Register default feature flags
featureFlags.registerFlag({
  id: "advanced-ai-orchestration",
  name: "Advanced AI Orchestration",
  enabled: true,
  rollout_percentage: 100,
});

featureFlags.registerFlag({
  id: "multimodal-detection",
  name: "Multimodal Detection (SAFF, CM-GAN, DINO v2)",
  enabled: true,
  rollout_percentage: 100,
});

featureFlags.registerFlag({
  id: "graph-rag-enhanced",
  name: "Enhanced GraphRAG with NER",
  enabled: true,
  rollout_percentage: 100,
});
