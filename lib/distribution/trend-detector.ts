/**
 * Trend Detector
 * 
 * Detects emerging trends before they peak to enable
 * preemptive content creation and positioning.
 */

export interface Trend {
  keyword: string;
  trend: "rising" | "stable" | "declining" | "emerging";
  velocity: number; // Growth rate
  peakPrediction?: string; // ISO timestamp
  confidence: number; // 0-1
  opportunity: "high" | "medium" | "low";
}

export interface TrendAnalysis {
  trends: Trend[];
  emerging: Trend[];
  peaking: Trend[];
  declining: Trend[];
}

export class TrendDetector {
  private keywordHistory: Map<string, Array<{
    timestamp: string;
    volume: number;
  }>> = new Map();

  /**
   * Record keyword volume
   */
  recordVolume(keyword: string, volume: number, timestamp: string = new Date().toISOString()): void {
    if (!this.keywordHistory.has(keyword)) {
      this.keywordHistory.set(keyword, []);
    }

    this.keywordHistory.get(keyword)!.push({ timestamp, volume });
  }

  /**
   * Detect trends
   */
  detectTrends(keywords: string[]): TrendAnalysis {
    const trends: Trend[] = [];

    for (const keyword of keywords) {
      const trend = this.analyzeKeyword(keyword);
      if (trend) {
        trends.push(trend);
      }
    }

    return {
      trends,
      emerging: trends.filter(t => t.trend === "emerging"),
      peaking: trends.filter(t => t.trend === "rising" && t.velocity > 0.5),
      declining: trends.filter(t => t.trend === "declining"),
    };
  }

  /**
   * Analyze keyword trend
   */
  private analyzeKeyword(keyword: string): Trend | null {
    const history = this.keywordHistory.get(keyword);
    if (!history || history.length < 2) {
      return null;
    }

    // Sort by timestamp
    const sorted = history.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate velocity
    const recent = sorted.slice(-Math.ceil(sorted.length * 0.3));
    const older = sorted.slice(0, Math.ceil(sorted.length * 0.3));

    const recentAvg = recent.reduce((sum, h) => sum + h.volume, 0) / recent.length;
    const olderAvg = older.reduce((sum, h) => sum + h.volume, 0) / older.length;

    let trend: Trend["trend"];
    let velocity: number;

    if (olderAvg === 0 && recentAvg > 0) {
      trend = "emerging";
      velocity = recentAvg;
    } else if (recentAvg > olderAvg * 1.3) {
      trend = "rising";
      velocity = (recentAvg - olderAvg) / olderAvg;
    } else if (recentAvg < olderAvg * 0.7) {
      trend = "declining";
      velocity = (olderAvg - recentAvg) / olderAvg;
    } else {
      trend = "stable";
      velocity = 0;
    }

    // Predict peak (simplified)
    let peakPrediction: string | undefined;
    if (trend === "rising" && velocity > 0.3) {
      // Estimate days to peak (simplified)
      const daysToPeak = Math.max(7, 30 / velocity);
      const peak = new Date();
      peak.setDate(peak.getDate() + daysToPeak);
      peakPrediction = peak.toISOString();
    }

    // Determine opportunity
    let opportunity: "high" | "medium" | "low";
    if (trend === "emerging" || (trend === "rising" && velocity > 0.5)) {
      opportunity = "high";
    } else if (trend === "rising" && velocity > 0.2) {
      opportunity = "medium";
    } else {
      opportunity = "low";
    }

    // Calculate confidence
    const confidence = Math.min(0.9, 0.5 + sorted.length / 20);

    return {
      keyword,
      trend,
      velocity,
      peakPrediction,
      confidence,
      opportunity,
    };
  }

  /**
   * Get emerging trends
   */
  getEmergingTrends(minVelocity: number = 0.3): Trend[] {
    const allTrends: Trend[] = [];

    for (const keyword of this.keywordHistory.keys()) {
      const trend = this.analyzeKeyword(keyword);
      if (trend && (trend.trend === "emerging" || trend.velocity >= minVelocity)) {
        allTrends.push(trend);
      }
    }

    return allTrends.sort((a, b) => b.velocity - a.velocity);
  }

  /**
   * Predict trend peak
   */
  predictPeak(keyword: string): string | null {
    const trend = this.analyzeKeyword(keyword);
    return trend?.peakPrediction || null;
  }
}
