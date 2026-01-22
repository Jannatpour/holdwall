/**
 * Citation Faithfulness Metrics
 * 
 * Tracks citation faithfulness scores and enforces regression budgets.
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { DeepTRACE } from "@/lib/ai/deeptrace";
import { CiteGuard } from "@/lib/ai/citeguard";

export interface CitationMetrics {
  claimId: string;
  citationFaithfulness: number; // 0-1
  citationCount: number;
  validCitations: number;
  invalidCitations: number;
  timestamp: Date;
}

export interface CitationMetricsSummary {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
  totalClaims: number;
  period: "day" | "week" | "month";
  periodStart: Date;
  periodEnd: Date;
}

export interface RegressionBudget {
  p50MaxDrop: number; // Maximum allowed drop in p50
  p95MaxDrop: number; // Maximum allowed drop in p95
  p99MaxDrop: number; // Maximum allowed drop in p99
  alertThreshold: number; // Alert if drop exceeds this
}

/**
 * Citation Metrics Tracker
 */
export class CitationMetricsTracker {
  private metrics: CitationMetrics[] = [];
  private deepTRACE: DeepTRACE;
  private citeGuard: CiteGuard;
  private regressionBudget: RegressionBudget = {
    p50MaxDrop: 0.02,
    p95MaxDrop: 0.05,
    p99MaxDrop: 0.10,
    alertThreshold: 0.03,
  };

  constructor() {
    this.deepTRACE = new DeepTRACE();
    // CiteGuard requires RAGPipeline - create with default vault
    const { RAGPipeline } = require("@/lib/ai/rag");
    const { DatabaseEvidenceVault } = require("@/lib/evidence/vault-db");
    const ragPipeline = new RAGPipeline(new DatabaseEvidenceVault());
    this.citeGuard = new CiteGuard(ragPipeline);
  }

  /**
   * Evaluate citation faithfulness for claim
   */
  async evaluateCitationFaithfulness(
    claimId: string,
    text: string,
    citations: string[]
  ): Promise<CitationMetrics> {
    const startTime = Date.now();

    // Use DeepTRACE for citation audit
    const deepTRACEResult = await this.deepTRACE.audit(text, citations);
    const deepTRACEScore = deepTRACEResult.overallFaithfulness || 0;

    // Use CiteGuard for citation validation
    const citeGuardResult = await this.citeGuard.validate(text, citations, "");
    const citeGuardScore = citeGuardResult.overallAccuracy || 0;

    // Combine scores (weighted average)
    const citationFaithfulness = deepTRACEScore * 0.6 + citeGuardScore * 0.4;

    const validCitations = citeGuardResult.validations?.filter(v => v.valid).length || 0;
    const invalidCitations = citations.length - validCitations;

    const citationMetrics: CitationMetrics = {
      claimId,
      citationFaithfulness,
      citationCount: citations.length,
      validCitations,
      invalidCitations,
      timestamp: new Date(),
    };

    this.metrics.push(citationMetrics);

    // Record metrics
    metrics.histogram("citation_faithfulness_score", citationFaithfulness, {
      claim_id: claimId,
    });
    metrics.gauge("citation_count_total", citations.length, {
      claim_id: claimId,
    });
    metrics.gauge("citation_valid_count", validCitations, {
      claim_id: claimId,
    });

    const latency = Date.now() - startTime;
    metrics.histogram("citation_evaluation_latency_ms", latency);

    logger.debug("Citation faithfulness evaluated", {
      claimId,
      citationFaithfulness,
      citationCount: citations.length,
      latency,
    });

    return citationMetrics;
  }

  /**
   * Get citation metrics summary
   */
  getSummary(period: "day" | "week" | "month" = "day"): CitationMetricsSummary {
    const now = new Date();
    const periodStart =
      period === "day"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : period === "week"
          ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          : new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = now;

    const periodMetrics = this.metrics.filter(
      (m) => m.timestamp >= periodStart && m.timestamp <= periodEnd
    );

    if (periodMetrics.length === 0) {
      return {
        p50: 0,
        p95: 0,
        p99: 0,
        mean: 0,
        min: 0,
        max: 0,
        totalClaims: 0,
        period,
        periodStart,
        periodEnd,
      };
    }

    const scores = periodMetrics
      .map((m) => m.citationFaithfulness)
      .sort((a, b) => a - b);

    const p50 = this.percentile(scores, 0.5);
    const p95 = this.percentile(scores, 0.95);
    const p99 = this.percentile(scores, 0.99);
    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const min = scores[0];
    const max = scores[scores.length - 1];

    return {
      p50,
      p95,
      p99,
      mean,
      min,
      max,
      totalClaims: periodMetrics.length,
      period,
      periodStart,
      periodEnd,
    };
  }

  /**
   * Check for regression against baseline
   */
  checkRegression(
    currentSummary: CitationMetricsSummary,
    baselineSummary: CitationMetricsSummary
  ): {
    hasRegression: boolean;
    regressionDetails: {
      p50Drop: number;
      p95Drop: number;
      p99Drop: number;
      exceedsBudget: boolean;
    };
    recommendation: string;
  } {
    const p50Drop = baselineSummary.p50 - currentSummary.p50;
    const p95Drop = baselineSummary.p95 - currentSummary.p95;
    const p99Drop = baselineSummary.p99 - currentSummary.p99;

    const exceedsBudget =
      p50Drop > this.regressionBudget.p50MaxDrop ||
      p95Drop > this.regressionBudget.p95MaxDrop ||
      p99Drop > this.regressionBudget.p99MaxDrop;

    const hasRegression = exceedsBudget || p95Drop > this.regressionBudget.alertThreshold;

    let recommendation = "No action needed";
    if (hasRegression) {
      if (exceedsBudget) {
        recommendation = "REGRESSION BUDGET EXCEEDED: Block deployment or rollback";
      } else {
        recommendation = "Regression detected: Investigate and fix before deployment";
      }
    }

    logger.warn("Citation faithfulness regression check", {
      hasRegression,
      exceedsBudget,
      p50Drop,
      p95Drop,
      p99Drop,
      recommendation,
    });

    return {
      hasRegression,
      regressionDetails: {
        p50Drop,
        p95Drop,
        p99Drop,
        exceedsBudget,
      },
      recommendation,
    };
  }

  /**
   * Set regression budget
   */
  setRegressionBudget(budget: RegressionBudget): void {
    this.regressionBudget = budget;
    logger.info("Citation faithfulness regression budget updated", budget);
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Get metrics for claim
   */
  getClaimMetrics(claimId: string): CitationMetrics | null {
    return this.metrics.find((m) => m.claimId === claimId) || null;
  }

  /**
   * Clear old metrics (retention)
   */
  clearOldMetrics(olderThanDays: number = 90): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    this.metrics = this.metrics.filter((m) => m.timestamp >= cutoff);
    logger.info("Old citation metrics cleared", { cutoff: cutoff.toISOString() });
  }
}

// Singleton instance
let citationMetricsTrackerInstance: CitationMetricsTracker | null = null;

export function getCitationMetricsTracker(): CitationMetricsTracker {
  if (!citationMetricsTrackerInstance) {
    citationMetricsTrackerInstance = new CitationMetricsTracker();
  }
  return citationMetricsTrackerInstance;
}
