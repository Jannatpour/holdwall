/**
 * Effectiveness Tracker
 * 
 * Tracks response effectiveness and optimizes future responses
 * based on engagement and outcome data.
 */

export interface ResponseMetrics {
  responseId: string;
  platform: string;
  sentAt: string;
  engagement?: {
    views?: number;
    likes?: number;
    shares?: number;
    replies?: number;
    clicks?: number;
  };
  outcome?: {
    resolved: boolean;
    sentimentChange?: "improved" | "worsened" | "unchanged";
    userSatisfaction?: number; // 1-5
  };
}

export interface EffectivenessAnalysis {
  platform: string;
  averageEngagement: number;
  averageSatisfaction: number;
  bestPerforming: Array<{
    responseId: string;
    metrics: ResponseMetrics;
  }>;
  worstPerforming: Array<{
    responseId: string;
    metrics: ResponseMetrics;
  }>;
  recommendations: string[];
}

export class EffectivenessTracker {
  private metrics: Map<string, ResponseMetrics> = new Map();

  /**
   * Record response metrics
   */
  recordMetrics(metrics: ResponseMetrics): void {
    this.metrics.set(metrics.responseId, metrics);
  }

  /**
   * Analyze effectiveness
   */
  analyze(platform: string): EffectivenessAnalysis {
    const platformMetrics = Array.from(this.metrics.values())
      .filter(m => m.platform === platform);

    if (platformMetrics.length === 0) {
      return {
        platform,
        averageEngagement: 0,
        averageSatisfaction: 0,
        bestPerforming: [],
        worstPerforming: [],
        recommendations: ["Insufficient data for analysis"],
      };
    }

    // Calculate averages
    const totalEngagement = platformMetrics.reduce((sum, m) => {
      const engagement = m.engagement || {};
      return sum + Object.values(engagement).reduce((s: number, v: any) => s + (typeof v === "number" ? v : 0), 0);
    }, 0);

    const averageEngagement = totalEngagement / platformMetrics.length;

    const satisfactions = platformMetrics
      .filter(m => m.outcome?.userSatisfaction !== undefined)
      .map(m => m.outcome!.userSatisfaction!);

    const averageSatisfaction = satisfactions.length > 0
      ? satisfactions.reduce((a, b) => a + b, 0) / satisfactions.length
      : 0;

    // Find best and worst
    const scored = platformMetrics.map(m => ({
      responseId: m.responseId,
      metrics: m,
      score: this.calculateScore(m),
    }));

    const sorted = scored.sort((a, b) => b.score - a.score);
    const bestPerforming = sorted.slice(0, 5).map(s => ({
      responseId: s.responseId,
      metrics: s.metrics,
    }));

    const worstPerforming = sorted.slice(-5).map(s => ({
      responseId: s.responseId,
      metrics: s.metrics,
    }));

    // Generate recommendations
    const recommendations = this.generateRecommendations(platformMetrics, bestPerforming, worstPerforming);

    return {
      platform,
      averageEngagement,
      averageSatisfaction,
      bestPerforming,
      worstPerforming,
      recommendations,
    };
  }

  /**
   * Calculate score for metrics
   */
  private calculateScore(metrics: ResponseMetrics): number {
    let score = 0;

    // Engagement score
    const engagement = metrics.engagement || {};
    const engagementTotal = Object.values(engagement).reduce((sum: number, val: any) =>
      sum + (typeof val === "number" ? val : 0), 0
    );
    score += Math.min(50, engagementTotal / 10);

    // Outcome score
    if (metrics.outcome) {
      if (metrics.outcome.resolved) {
        score += 30;
      }
      if (metrics.outcome.sentimentChange === "improved") {
        score += 20;
      }
      if (metrics.outcome.userSatisfaction) {
        score += metrics.outcome.userSatisfaction * 4;
      }
    }

    return score;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    allMetrics: ResponseMetrics[],
    best: Array<{ responseId: string; metrics: ResponseMetrics }>,
    worst: Array<{ responseId: string; metrics: ResponseMetrics }>
  ): string[] {
    const recommendations: string[] = [];

    // Analyze best performing
    if (best.length > 0) {
      const bestAvgLength = best.reduce((sum, b) => sum + b.metrics.responseId.length, 0) / best.length;
      recommendations.push(`Best performing responses average ${Math.round(bestAvgLength)} characters`);
    }

    // Analyze worst performing
    if (worst.length > 0) {
      recommendations.push(`Review ${worst.length} underperforming responses for improvement opportunities`);
    }

    // Engagement recommendations
    const lowEngagement = allMetrics.filter(m => {
      const engagement = m.engagement || {};
      const total = Object.values(engagement).reduce((sum: number, val: any) =>
        sum + (typeof val === "number" ? val : 0), 0
      );
      return total < 10;
    });

    if (lowEngagement.length > 0) {
      recommendations.push(`${lowEngagement.length} responses had low engagement - consider improving timing or content`);
    }

    return recommendations;
  }

  /**
   * Get metrics for response
   */
  getMetrics(responseId: string): ResponseMetrics | null {
    return this.metrics.get(responseId) || null;
  }
}
