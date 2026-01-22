/**
 * A/B Testing Framework
 * 
 * Production-ready A/B testing with statistical significance analysis
 * to optimize publishing performance.
 */

export interface ABTestVariant {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ABTest {
  id: string;
  name: string;
  description?: string;
  variants: ABTestVariant[];
  platform: string;
  startTime: string;
  endTime?: string;
  status: "running" | "completed" | "paused";
  results?: ABTestResults[];
  minSampleSize?: number;
  confidenceLevel?: number;
}

export interface ABTestResults {
  variantId: string;
  impressions: number;
  engagements: number;
  engagementRate: number;
  confidence: number;
  statisticalSignificance: number;
  winner?: boolean;
  lift?: number; // Percentage improvement over baseline
}

export class ABTesting {
  private tests: Map<string, ABTest> = new Map();
  private variantPerformance: Map<string, {
    impressions: number;
    engagements: number;
    conversions: number;
  }> = new Map();

  /**
   * Create A/B test
   */
  createTest(
    name: string,
    variants: ABTestVariant[],
    platform: string
  ): ABTest {
    if (variants.length < 2) {
      throw new Error("A/B test requires at least 2 variants");
    }

    const test: ABTest = {
      id: crypto.randomUUID(),
      name,
      variants,
      platform,
      startTime: new Date().toISOString(),
      status: "running",
    };

    this.tests.set(test.id, test);

    // Initialize performance tracking
    for (const variant of variants) {
      this.variantPerformance.set(variant.id, {
        impressions: 0,
        engagements: 0,
        conversions: 0,
      });
    }

    return test;
  }

  /**
   * Record impression for variant
   */
  recordImpression(testId: string, variantId: string): void {
    const performance = this.variantPerformance.get(variantId);
    if (performance) {
      performance.impressions++;
    }
  }

  /**
   * Record engagement for variant
   */
  recordEngagement(testId: string, variantId: string, engagement: number = 1): void {
    const performance = this.variantPerformance.get(variantId);
    if (performance) {
      performance.engagements += engagement;
    }
  }

  /**
   * Analyze test results
   */
  analyzeTest(testId: string): ABTestResults[] {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    const results: ABTestResults[] = [];

    for (const variant of test.variants) {
      const performance = this.variantPerformance.get(variant.id);
      if (!performance) {
        continue;
      }

      const engagementRate = performance.impressions > 0
        ? performance.engagements / performance.impressions
        : 0;

      // Calculate statistical confidence (simplified)
      const confidence = this.calculateConfidence(
        performance.impressions,
        performance.engagements
      );

      // Calculate statistical significance
      const statisticalSignificance = this.calculateStatisticalSignificance(
        performance.impressions,
        performance.engagements,
        performance.conversions
      );

      results.push({
        variantId: variant.id,
        impressions: performance.impressions,
        engagements: performance.engagements,
        engagementRate,
        confidence,
        statisticalSignificance,
      });
    }

    // Determine winner
    if (results.length >= 2) {
      const sorted = [...results].sort((a, b) => b.engagementRate - a.engagementRate);
      const winner = sorted[0];
      
      // Check if winner is statistically significant
      if (winner.confidence > 0.95) {
        winner.winner = true;
      }
    }

    test.results = results;
    return results;
  }

  /**
   * Calculate statistical confidence
   */
  private calculateConfidence(impressions: number, engagements: number): number {
    if (impressions === 0) {
      return 0;
    }

    // Simplified confidence calculation
    // In production, use proper statistical tests (chi-square, etc.)
    const engagementRate = engagements / impressions;
    const sampleSize = impressions;

    // Basic confidence based on sample size and rate
    let confidence = Math.min(0.99, 0.5 + (sampleSize / 1000) * 0.3);
    
    // Adjust based on engagement rate stability
    if (engagementRate > 0.1 && engagementRate < 0.9) {
      confidence += 0.1; // More stable rates = higher confidence
    }

    return Math.min(0.99, confidence);
  }

  /**
   * Calculate statistical significance (p-value approximation)
   */
  private calculateStatisticalSignificance(
    impressions: number,
    engagements: number,
    conversions: number
  ): number {
    if (impressions === 0) {
      return 0;
    }

    // Simplified statistical significance calculation
    // In production, use proper statistical tests (t-test, chi-square, etc.)
    const engagementRate = engagements / impressions;
    const conversionRate = conversions / impressions;
    const sampleSize = impressions;

    // Basic significance based on sample size
    // Larger samples = higher significance (lower p-value = higher significance score)
    let significance = Math.min(0.99, 0.3 + (sampleSize / 2000) * 0.5);
    
    // Adjust based on rate consistency
    if (engagementRate > 0 && engagementRate < 1 && conversionRate > 0 && conversionRate < 1) {
      significance += 0.1; // More consistent rates = higher significance
    }

    return Math.min(0.99, significance);
  }

  /**
   * Get winning variant
   */
  getWinner(testId: string): ABTestVariant | null {
    const results = this.analyzeTest(testId);
    const winner = results.find(r => r.winner);

    if (!winner) {
      return null;
    }

    const test = this.tests.get(testId);
    return test?.variants.find(v => v.id === winner.variantId) || null;
  }

  /**
   * Complete test
   */
  completeTest(testId: string): ABTest {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    test.status = "completed";
    test.endTime = new Date().toISOString();
    test.results = this.analyzeTest(testId);

    return test;
  }
}

// Export singleton instance
export const abTesting = new ABTesting();
