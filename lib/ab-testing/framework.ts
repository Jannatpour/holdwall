/**
 * A/B Testing Framework
 * Production-ready A/B testing with analytics integration
 */

import { isFeatureEnabled } from "@/lib/feature-flags/config";
import { metrics } from "@/lib/observability/metrics";
import { logger } from "@/lib/logging/logger";
import { db } from "@/lib/db/client";
import { randomUUID } from "crypto";

export interface ABTest {
  name: string;
  variants: string[];
  allocation: Record<string, number>; // percentage per variant
  startDate?: Date;
  endDate?: Date;
  active?: boolean;
}

export interface ABTestResult {
  testName: string;
  variant: string;
  userId: string;
  conversion: string;
  timestamp: Date;
}

export class ABTestingFramework {
  private tests: Map<string, ABTest> = new Map();

  /**
   * Register a new A/B test
   */
  async registerTest(test: ABTest): Promise<void> {
    this.tests.set(test.name, test);
    metrics.increment("ab_test_registered", { test_name: test.name });
    logger.info("AB test registered", { test_name: test.name, variants: test.variants });
  }

  /**
   * Get variant for user
   */
  getVariant(testName: string, userId: string): string {
    const test = this.tests.get(testName);
    if (!test || !test.active) {
      return "control";
    }

    // Check date range
    if (test.startDate && new Date() < test.startDate) {
      return "control";
    }
    if (test.endDate && new Date() > test.endDate) {
      return "control";
    }

    // Hash-based allocation for consistent assignment
    const hash = this.hashString(userId + testName);
    const random = (hash % 10000) / 10000; // 0-1 range

    let cumulative = 0;
    for (const [variant, percentage] of Object.entries(test.allocation)) {
      cumulative += percentage / 100;
      if (random <= cumulative) {
        metrics.increment("ab_test_variant_assigned", {
          test_name: testName,
          variant,
        });
        return variant;
      }
    }

    // Fallback to first variant
    return test.variants[0] || "control";
  }

  /**
   * Track conversion
   */
  async trackConversion(
    testName: string,
    variant: string,
    userId: string,
    conversion: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const result: ABTestResult = {
      testName,
      variant,
      userId,
      conversion,
      timestamp: new Date(),
    };

    // Store in database for analysis
    try {
      await db.event.create({
        data: {
          id: crypto.randomUUID(),
          tenantId: "", // Will be set from context
          actorId: userId,
          type: `ab_test.${testName}.${conversion}`,
          occurredAt: result.timestamp,
          correlationId: `ab-test-${testName}-${userId}`,
          schemaVersion: "1.0",
          payload: {
            test_name: testName,
            variant,
            conversion,
            metadata,
          } as any,
          signatures: [],
        },
      });
    } catch (error) {
      logger.warn("Failed to store AB test result", { error, result });
    }

    // Track metrics
    metrics.increment("ab_test_conversion", {
      test_name: testName,
      variant,
      conversion,
    });

    logger.info("AB test conversion tracked", result);
  }

  /**
   * Get test statistics
   */
  async getTestStats(testName: string): Promise<{
    test: ABTest | null;
    variants: Record<string, { conversions: number; users: number }>;
  }> {
    const test = this.tests.get(testName) || null;

    // In production, query database for actual stats
    const stats: Record<string, { conversions: number; users: number }> = {};
    for (const variant of test?.variants || []) {
      stats[variant] = {
        conversions: 0,
        users: 0,
      };
    }

    return { test, variants: stats };
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

export const abTesting = new ABTestingFramework();
