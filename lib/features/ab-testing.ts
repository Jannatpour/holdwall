/**
 * A/B Testing Framework
 * 
 * Variant assignment, statistical significance, conversion tracking
 */

import { db } from "@/lib/db/client";
import { createHash } from "crypto";

export interface ABTest {
  id: string;
  name: string;
  variants: Array<{
    id: string;
    name: string;
    weight: number; // 0-1, relative weight
  }>;
  startDate: string;
  endDate?: string;
  active: boolean;
}

export interface ABTestAssignment {
  test_id: string;
  user_id: string;
  variant_id: string;
  assigned_at: string;
}

export interface ABTestConversion {
  test_id: string;
  variant_id: string;
  user_id: string;
  converted: boolean;
  converted_at: string;
  metadata?: Record<string, unknown>;
}

export interface ABTestResults {
  test_id: string;
  variants: Array<{
    variant_id: string;
    participants: number;
    conversions: number;
    conversion_rate: number;
    confidence_interval: {
      lower: number;
      upper: number;
    };
    statistical_significance?: number; // p-value
    winner?: boolean;
  }>;
}

/**
 * A/B Testing Service
 */
export class ABTestingService {
  /**
   * Assign user to variant
   */
  async assignVariant(
    testId: string,
    userId: string
  ): Promise<string> {
    // Check if already assigned
    const existing = await db.$queryRawUnsafe(
      `SELECT variant_id FROM "ABTestAssignment" WHERE test_id = $1 AND user_id = $2 LIMIT 1`,
      testId,
      userId
    ).catch(() => null);

    if (existing && Array.isArray(existing) && existing.length > 0) {
      return (existing[0] as any).variant_id;
    }

    // Get test
    const test = await this.getTest(testId);
    if (!test || !test.active) {
      throw new Error("Test not found or inactive");
    }

    // Deterministic assignment based on user ID (consistent assignment)
    const hash = createHash("sha256");
    hash.update(`${testId}:${userId}`);
    const hashValue = parseInt(hash.digest("hex").substring(0, 8), 16);
    const random = (hashValue % 10000) / 10000; // 0-1

    // Weighted random assignment
    let cumulative = 0;
    let selectedVariant = test.variants[0].id;

    for (const variant of test.variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        selectedVariant = variant.id;
        break;
      }
    }

    // Store assignment in Event table
    try {
      await db.event.create({
        data: {
          id: `ab-assignment-${testId}-${userId}`,
          tenantId: "",
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
      // Non-critical - log but don't fail
      console.warn(`[AB Test] Failed to store assignment: ${error}`);
    }

    return selectedVariant;
  }

  /**
   * Track conversion
   */
  async trackConversion(
    testId: string,
    variantId: string,
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    // Store conversion in Event table
    try {
      await db.event.create({
        data: {
          id: `ab-conversion-${testId}-${userId}-${Date.now()}`,
          tenantId: "",
          actorId: userId,
          type: "ab_test.conversion",
          occurredAt: new Date(),
          correlationId: `ab-test-${testId}`,
          schemaVersion: "1.0",
          payload: {
            test_id: testId,
            variant_id: variantId,
            user_id: userId,
            converted: true,
            converted_at: new Date().toISOString(),
            metadata,
          } as any,
          signatures: [],
          metadata: {
            testId,
            variantId,
            userId,
            ...metadata,
          } as any,
        },
      });
    } catch (error) {
      console.warn(`[AB Test] Failed to store conversion: ${error}`);
    }
  }

  /**
   * Get test results from database
   */
  async getResults(testId: string): Promise<ABTestResults> {
    const { db } = await import("@/lib/db/client");
    const test = await this.getTest(testId);
    if (!test) {
      throw new Error("Test not found");
    }

    // Query assignments and conversions from Event table
    const assignmentEvents = await db.event.findMany({
      where: {
        type: "ab_test.assignment",
        correlationId: `ab-test-${testId}`,
      },
    });

    const conversionEvents = await db.event.findMany({
      where: {
        type: "ab_test.conversion",
        correlationId: `ab-test-${testId}`,
      },
    });

    // Calculate results per variant
    const variants = test.variants.map(variant => {
      const assignments = assignmentEvents.filter(e => {
        const payload = e.payload as any;
        return payload?.variant_id === variant.id;
      });
      const conversions = conversionEvents.filter(e => {
        const payload = e.payload as any;
        return payload?.variant_id === variant.id && payload?.converted === true;
      });

      const participants = assignments.length;
      const conversionCount = conversions.length;
      const conversionRate = participants > 0 ? conversionCount / participants : 0;

      // Calculate confidence interval (Wilson score interval)
      const z = 1.96; // 95% confidence
      const n = participants;
      const p = conversionRate;
      const denominator = 1 + (z * z) / n;
      const center = (p + (z * z) / (2 * n)) / denominator;
      const margin = (z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / denominator;

      return {
        variant_id: variant.id,
        participants,
        conversions: conversionCount,
        conversion_rate: conversionRate,
        confidence_interval: {
          lower: Math.max(0, center - margin),
          upper: Math.min(1, center + margin),
        },
        winner: false,
      };
    });

    // Determine winner (highest conversion rate with statistical significance)
    if (variants.length >= 2) {
      const sorted = [...variants].sort((a, b) => b.conversion_rate - a.conversion_rate);
      const pValue = this.calculateStatisticalSignificance(sorted[1], sorted[0]);
      if (pValue < 0.05) {
        sorted[0].winner = true;
      }
    }

    return {
      test_id: testId,
      variants,
    };
  }

  /**
   * Calculate statistical significance
   */
  calculateStatisticalSignificance(
    variantA: { participants: number; conversions: number },
    variantB: { participants: number; conversions: number }
  ): number {
    // Simplified chi-square test
    const rateA = variantA.conversions / variantA.participants;
    const rateB = variantB.conversions / variantB.participants;

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
    // Two-tailed p-value (simplified)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));

    return pValue;
  }

  /**
   * Normal CDF approximation
   */
  private normalCDF(x: number): number {
    // Approximation using error function
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
   * Get test from Event table or configuration
   */
  private async getTest(testId: string): Promise<ABTest | null> {
    const { db } = await import("@/lib/db/client");
    
    // Try to find test configuration in Event table (type: "ab_test.created")
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
        return {
          id: testId,
          name: payload.name || testId,
          variants: payload.variants || [],
          startDate: payload.startDate || testEvent.occurredAt.toISOString(),
          endDate: payload.endDate,
          active: payload.active !== false && (!payload.endDate || new Date(payload.endDate) > new Date()),
        };
      }
    } catch (error) {
      console.warn(`[AB Test] Failed to query test: ${error}`);
    }

    // Fallback: check environment variable for test configuration
    const testConfig = process.env[`AB_TEST_${testId.toUpperCase()}`];
    if (testConfig) {
      try {
        const config = JSON.parse(testConfig);
        return {
          id: testId,
          name: config.name || testId,
          variants: config.variants || [],
          startDate: config.startDate || new Date().toISOString(),
          endDate: config.endDate,
          active: config.active !== false,
        };
      } catch {
        // Invalid JSON
      }
    }

    return null;
  }
}

export const abTesting = new ABTestingService();
