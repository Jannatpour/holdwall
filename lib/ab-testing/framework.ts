/**
 * A/B Testing Framework
 * Production-ready A/B testing with statistical significance analysis, database integration, and comprehensive analytics
 * 
 * Canonical implementation for all A/B testing needs across the platform.
 */

import { metrics } from "@/lib/observability/metrics";
import { logger } from "@/lib/logging/logger";
import { db } from "@/lib/db/client";
import { createHash } from "crypto";

export interface ABTestVariant {
  id: string;
  name?: string;
  content?: string;
  weight?: number; // 0-1, relative weight for allocation
  metadata?: Record<string, unknown>;
}

export interface ABTest {
  id: string;
  name: string;
  description?: string;
  variants: ABTestVariant[];
  platform?: string;
  allocation?: Record<string, number>; // percentage per variant (legacy support)
  startDate?: Date | string;
  endDate?: Date | string;
  active?: boolean;
  status?: "running" | "completed" | "paused";
  minSampleSize?: number;
  confidenceLevel?: number;
}

export interface ABTestAssignment {
  testId: string;
  userId: string;
  variantId: string;
  assignedAt: Date;
}

export interface ABTestConversion {
  testId: string;
  variantId: string;
  userId: string;
  conversion: string;
  converted: boolean;
  convertedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ABTestResults {
  testId: string;
  variants: Array<{
    variantId: string;
    participants: number;
    conversions: number;
    impressions?: number;
    engagements?: number;
    conversionRate: number;
    engagementRate?: number;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
    statisticalSignificance?: number; // p-value
    winner?: boolean;
    lift?: number; // Percentage improvement over baseline
  }>;
}

export class ABTestingFramework {
  private tests: Map<string, ABTest> = new Map();
  private variantPerformance: Map<string, {
    impressions: number;
    engagements: number;
    conversions: number;
    participants: Set<string>;
  }> = new Map();

  /**
   * Create A/B test
   */
  createTest(
    name: string,
    variants: Array<{ id?: string; content?: string; metadata?: Record<string, unknown> }>,
    platform?: string
  ): ABTest {
    if (variants.length < 2) {
      throw new Error("A/B test requires at least 2 variants");
    }

    const test: ABTest = {
      id: crypto.randomUUID(),
      name,
      variants: variants.map((v, idx) => ({
        id: v.id || `variant-${idx + 1}`,
        content: v.content,
        weight: 1 / variants.length, // Equal weight by default
        metadata: v.metadata,
      })),
      platform: platform || "web",
      startDate: new Date(),
      status: "running",
      active: true,
    };

    this.tests.set(test.id, test);

    // Initialize performance tracking
    for (const variant of test.variants) {
      this.variantPerformance.set(variant.id, {
        impressions: 0,
        engagements: 0,
        conversions: 0,
        participants: new Set(),
      });
    }

    // Store test in database
    this.storeTest(test).catch((error) => {
      logger.warn("Failed to store AB test in database", { error, testId: test.id });
    });

    metrics.increment("ab_test_created", { test_name: name, platform: test.platform || "web" });
    logger.info("AB test created", { testId: test.id, name, variants: test.variants.length });

    return test;
  }

  /**
   * Store test in database
   */
  private async storeTest(test: ABTest): Promise<void> {
    try {
      await db.event.create({
        data: {
          id: `ab-test-${test.id}`,
          tenantId: "system", // Will be set from context in production
          actorId: "system",
          type: "ab_test.created",
          occurredAt: new Date(),
          correlationId: `ab-test-${test.id}`,
          schemaVersion: "1.0",
          payload: {
            test_id: test.id,
            name: test.name,
            description: test.description,
            variants: test.variants,
            platform: test.platform,
            startDate: test.startDate instanceof Date ? test.startDate.toISOString() : test.startDate,
            endDate: test.endDate instanceof Date ? test.endDate.toISOString() : test.endDate,
            active: test.active,
            minSampleSize: test.minSampleSize,
            confidenceLevel: test.confidenceLevel,
          } as any,
          signatures: [],
          metadata: {
            testId: test.id,
            name: test.name,
          } as any,
        },
      });
    } catch (error) {
      logger.warn("Failed to store AB test in database", {
        error: error instanceof Error ? error.message : String(error),
        testId: test.id,
      });
    }
  }

  /**
   * Get test from database or memory
   */
  private async getTest(testId: string): Promise<ABTest | null> {
    // Check memory first
    const memoryTest = this.tests.get(testId);
    if (memoryTest) {
      return memoryTest;
    }

    // Try to load from database
    try {
      const testEvent = await db.event.findFirst({
        where: {
          type: "ab_test.created",
          correlationId: `ab-test-${testId}`,
        },
        orderBy: { occurredAt: "desc" },
      });

      if (testEvent && testEvent.payload) {
        const payload = testEvent.payload as any;
        const test: ABTest = {
          id: testId,
          name: payload.name || testId,
          description: payload.description,
          variants: payload.variants || [],
          platform: payload.platform,
          startDate: payload.startDate ? new Date(payload.startDate) : new Date(),
          endDate: payload.endDate ? new Date(payload.endDate) : undefined,
          active: payload.active !== false && (!payload.endDate || new Date(payload.endDate) > new Date()),
          status: payload.status || (payload.active !== false ? "running" : "paused"),
          minSampleSize: payload.minSampleSize,
          confidenceLevel: payload.confidenceLevel,
        };
        this.tests.set(testId, test);
        return test;
      }
    } catch (error) {
      logger.warn("Failed to load AB test from database", {
        error: error instanceof Error ? error.message : String(error),
        testId,
      });
    }

    return null;
  }

  /**
   * Assign user to variant (deterministic, consistent assignment)
   */
  async assignVariant(testId: string, userId: string, tenantId?: string): Promise<string> {
    // Check if already assigned (from database)
    try {
      const existingAssignment = await db.event.findFirst({
        where: {
          type: "ab_test.assignment",
          correlationId: `ab-test-${testId}`,
          actorId: userId,
        },
        orderBy: { occurredAt: "desc" },
      });

      if (existingAssignment && existingAssignment.payload) {
        const payload = existingAssignment.payload as any;
        if (payload.variant_id) {
          return payload.variant_id;
        }
      }
    } catch (error) {
      logger.warn("Failed to check existing assignment", { error, testId, userId });
    }

    // Get test
    const test = await this.getTest(testId);
    if (!test || !test.active) {
      throw new Error("Test not found or inactive");
    }

    // Check date range
    const now = new Date();
    if (test.startDate) {
      const startDate = test.startDate instanceof Date ? test.startDate : new Date(test.startDate);
      if (now < startDate) {
        return test.variants[0]?.id || "control";
      }
    }
    if (test.endDate) {
      const endDate = test.endDate instanceof Date ? test.endDate : new Date(test.endDate);
      if (now > endDate) {
        return test.variants[0]?.id || "control";
      }
    }

    // Deterministic assignment based on user ID (consistent assignment)
    const hash = createHash("sha256");
    hash.update(`${testId}:${userId}`);
    const hashValue = parseInt(hash.digest("hex").substring(0, 8), 16);
    const random = (hashValue % 10000) / 10000; // 0-1

    // Weighted random assignment
    let cumulative = 0;
    let selectedVariant = test.variants[0]?.id || "control";

    // Use allocation if provided (legacy), otherwise use variant weights
    if (test.allocation) {
      for (const [variantId, percentage] of Object.entries(test.allocation)) {
        cumulative += percentage / 100;
        if (random <= cumulative) {
          selectedVariant = variantId;
          break;
        }
      }
    } else {
      // Use variant weights
      for (const variant of test.variants) {
        cumulative += variant.weight || (1 / test.variants.length);
        if (random <= cumulative) {
          selectedVariant = variant.id;
          break;
        }
      }
    }

    // Track participant
    const performance = this.variantPerformance.get(selectedVariant);
    if (performance) {
      performance.participants.add(userId);
    }

    // Store assignment in database
    try {
      await db.event.create({
        data: {
          id: `ab-assignment-${testId}-${userId}`,
          tenantId: tenantId || "system",
          actorId: userId,
          type: "ab_test.assignment",
          occurredAt: new Date(),
          correlationId: `ab-test-${testId}`,
          schemaVersion: "1.0",
          payload: {
            test_id: testId,
            user_id: userId,
            variant_id: selectedVariant,
            assigned_at: new Date().toISOString(),
          } as any,
          signatures: [],
          metadata: {
            testId,
            variantId: selectedVariant,
            userId,
          } as any,
        },
      });
    } catch (error) {
      logger.warn("Failed to store AB test assignment", { error, testId, userId });
    }

    metrics.increment("ab_test_variant_assigned", {
      test_id: testId,
      variant: selectedVariant,
    });

    return selectedVariant;
  }

  /**
   * Record impression for variant
   */
  recordImpression(testId: string, variantId: string, userId?: string): void {
    const performance = this.variantPerformance.get(variantId);
    if (performance) {
      performance.impressions++;
      if (userId) {
        performance.participants.add(userId);
      }
    }

    metrics.increment("ab_test_impression", {
      test_id: testId,
      variant: variantId,
    });
  }

  /**
   * Record engagement for variant
   */
  recordEngagement(testId: string, variantId: string, engagement: number = 1, userId?: string): void {
    const performance = this.variantPerformance.get(variantId);
    if (performance) {
      performance.engagements += engagement;
      if (userId) {
        performance.participants.add(userId);
      }
    }

    metrics.increment("ab_test_engagement", {
      test_id: testId,
      variant: variantId,
      engagement: String(engagement),
    });
  }

  /**
   * Track conversion
   */
  async trackConversion(
    testId: string,
    variantId: string,
    userId: string,
    conversion: string = "conversion",
    metadata?: Record<string, unknown>,
    tenantId?: string
  ): Promise<void> {
    const performance = this.variantPerformance.get(variantId);
    if (performance) {
      performance.conversions++;
      performance.participants.add(userId);
    }

    // Store conversion in database
    try {
      await db.event.create({
        data: {
          id: `ab-conversion-${testId}-${userId}-${Date.now()}`,
          tenantId: tenantId || "system",
          actorId: userId,
          type: "ab_test.conversion",
          occurredAt: new Date(),
          correlationId: `ab-test-${testId}`,
          schemaVersion: "1.0",
          payload: {
            test_id: testId,
            variant_id: variantId,
            user_id: userId,
            conversion,
            converted: true,
            converted_at: new Date().toISOString(),
            metadata,
          } as any,
          signatures: [],
          metadata: {
            testId,
            variantId,
            userId,
            conversion,
            ...metadata,
          } as any,
        },
      });
    } catch (error) {
      logger.warn("Failed to store AB test conversion", {
        error: error instanceof Error ? error.message : String(error),
        testId,
        variantId,
        userId,
      });
    }

    metrics.increment("ab_test_conversion", {
      test_id: testId,
      variant: variantId,
      conversion,
    });

    logger.info("AB test conversion tracked", {
      testId,
      variantId,
      userId,
      conversion,
    });
  }

  /**
   * Analyze test results with statistical significance
   */
  async analyzeTest(testId: string): Promise<ABTestResults> {
    const test = await this.getTest(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    // Query assignments and conversions from database
    const [assignmentEvents, conversionEvents] = await Promise.all([
      db.event.findMany({
        where: {
          type: "ab_test.assignment",
          correlationId: `ab-test-${testId}`,
        },
      }),
      db.event.findMany({
        where: {
          type: "ab_test.conversion",
          correlationId: `ab-test-${testId}`,
        },
      }),
    ]);

    // Calculate results per variant
    const variantResults: ABTestResults['variants'] = test.variants.map(variant => {
      const assignments = assignmentEvents.filter(e => {
        const payload = e.payload as any;
        return payload?.variant_id === variant.id;
      });
      const conversions = conversionEvents.filter(e => {
        const payload = e.payload as any;
        return payload?.variant_id === variant.id && payload?.converted === true;
      });

      const participants = new Set(assignments.map(e => e.actorId)).size;
      const conversionCount = conversions.length;
      const conversionRate = participants > 0 ? conversionCount / participants : 0;

      // Get in-memory performance data
      const performance = this.variantPerformance.get(variant.id);
      const impressions = performance?.impressions || 0;
      const engagements = performance?.engagements || 0;
      const engagementRate = impressions > 0 ? engagements / impressions : 0;

      // Calculate confidence interval (Wilson score interval)
      const z = 1.96; // 95% confidence
      const n = participants;
      const p = conversionRate;
      const denominator = 1 + (z * z) / n;
      const center = n > 0 ? (p + (z * z) / (2 * n)) / denominator : 0;
      const margin = n > 0 ? (z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / denominator : 0;

      return {
        variantId: variant.id,
        participants,
        conversions: conversionCount,
        impressions,
        engagements,
        conversionRate,
        engagementRate,
        confidenceInterval: {
          lower: Math.max(0, center - margin),
          upper: Math.min(1, center + margin),
        },
        winner: false,
        statisticalSignificance: undefined,
        lift: undefined,
      };
    });

    // Calculate statistical significance and determine winner
    if (variantResults.length >= 2) {
      const sorted = [...variantResults].sort((a, b) => b.conversionRate - a.conversionRate);
      
      // Calculate p-value between top two variants
      if (sorted.length >= 2 && sorted[0].participants >= 30 && sorted[1].participants >= 30) {
        const pValue = this.calculateStatisticalSignificance(sorted[1], sorted[0]);
        sorted[0].statisticalSignificance = pValue;
        
        if (pValue < 0.05) {
          sorted[0].winner = true;
          // Calculate lift
          if (sorted[1].conversionRate > 0) {
            sorted[0].lift = ((sorted[0].conversionRate - sorted[1].conversionRate) / sorted[1].conversionRate) * 100;
          }
        }
      }
    }

    return {
      testId,
      variants: variantResults,
    };
  }

  /**
   * Calculate statistical significance (p-value) between two variants
   */
  private calculateStatisticalSignificance(
    variantA: { participants: number; conversions: number },
    variantB: { participants: number; conversions: number }
  ): number {
    const rateA = variantA.participants > 0 ? variantA.conversions / variantA.participants : 0;
    const rateB = variantB.participants > 0 ? variantB.conversions / variantB.participants : 0;

    if (variantA.participants < 30 || variantB.participants < 30) {
      return 1.0; // Not enough data
    }

    // Z-test for proportions
    const pooledRate = (variantA.conversions + variantB.conversions) / (variantA.participants + variantB.participants);
    const se = Math.sqrt(
      pooledRate * (1 - pooledRate) * (1 / variantA.participants + 1 / variantB.participants)
    );

    if (se === 0) {
      return 1.0;
    }

    const z = (rateA - rateB) / se;
    // Two-tailed p-value
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));

    return pValue;
  }

  /**
   * Normal CDF approximation
   */
  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  /**
   * Error function approximation
   */
  private erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  /**
   * Get test by ID
   */
  async getTestById(testId: string): Promise<ABTest | null> {
    return await this.getTest(testId);
  }

  /**
   * List all tests
   */
  async listTests(): Promise<ABTest[]> {
    // Load from database
    try {
      const testEvents = await db.event.findMany({
        where: {
          type: "ab_test.created",
        },
        orderBy: { occurredAt: "desc" },
        take: 100,
      });

      const tests: ABTest[] = [];
      for (const event of testEvents) {
        if (event.payload) {
          const payload = event.payload as any;
          const testId = payload.test_id || event.correlationId?.replace("ab-test-", "");
          if (testId) {
            const test = await this.getTest(testId);
            if (test) {
              tests.push(test);
            }
          }
        }
      }

      return tests;
    } catch (error) {
      logger.warn("Failed to list AB tests from database", {
        error: error instanceof Error ? error.message : String(error),
      });
      return Array.from(this.tests.values());
    }
  }
}

// Singleton instance - canonical A/B testing framework
export const abTesting = new ABTestingFramework();
