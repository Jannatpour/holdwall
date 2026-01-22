/**
 * Sentiment Trend Analyzer
 * 
 * Analyzes sentiment trends over time to identify shifts
 * and measure narrative impact.
 */

export interface SentimentData {
  timestamp: string;
  positive: number;
  negative: number;
  neutral: number;
  mixed: number;
  total: number;
}

export interface SentimentTrend {
  period: { start: string; end: string };
  trend: "improving" | "declining" | "stable";
  change: number; // Percentage change
  currentSentiment: number; // -1 to 1
  previousSentiment: number; // -1 to 1
}

export class SentimentAnalyzer {
  private sentimentData: SentimentData[] = [];

  /**
   * Record sentiment data
   */
  recordSentiment(data: SentimentData): void {
    this.sentimentData.push(data);
  }

  /**
   * Calculate sentiment score (-1 to 1)
   */
  calculateSentimentScore(data: SentimentData): number {
    if (data.total === 0) {
      return 0;
    }

    const positiveRatio = data.positive / data.total;
    const negativeRatio = data.negative / data.total;

    return positiveRatio - negativeRatio;
  }

  /**
   * Analyze sentiment trend
   */
  analyzeTrend(
    timeWindow?: { start: string; end: string }
  ): SentimentTrend {
    let filtered = this.sentimentData;

    if (timeWindow) {
      filtered = this.sentimentData.filter(d => {
        const time = new Date(d.timestamp).getTime();
        return (
          time >= new Date(timeWindow.start).getTime() &&
          time <= new Date(timeWindow.end).getTime()
        );
      });
    }

    if (filtered.length < 2) {
      const current = filtered[0] || { positive: 0, negative: 0, neutral: 0, mixed: 0, total: 0, timestamp: new Date().toISOString() };
      return {
        period: {
          start: current.timestamp,
          end: current.timestamp,
        },
        trend: "stable",
        change: 0,
        currentSentiment: this.calculateSentimentScore(current),
        previousSentiment: this.calculateSentimentScore(current),
      };
    }

    // Split into recent and previous
    const recent = filtered.slice(-Math.ceil(filtered.length * 0.3));
    const previous = filtered.slice(0, Math.ceil(filtered.length * 0.3));

    // Aggregate
    const recentAgg = this.aggregateSentiment(recent);
    const previousAgg = this.aggregateSentiment(previous);

    const currentSentiment = this.calculateSentimentScore(recentAgg);
    const previousSentiment = this.calculateSentimentScore(previousAgg);

    const change = previousSentiment !== 0
      ? ((currentSentiment - previousSentiment) / Math.abs(previousSentiment)) * 100
      : 0;

    let trend: "improving" | "declining" | "stable";
    if (change > 10) {
      trend = "improving";
    } else if (change < -10) {
      trend = "declining";
    } else {
      trend = "stable";
    }

    return {
      period: {
        start: filtered[0].timestamp,
        end: filtered[filtered.length - 1].timestamp,
      },
      trend,
      change,
      currentSentiment,
      previousSentiment,
    };
  }

  /**
   * Aggregate sentiment data
   */
  private aggregateSentiment(data: SentimentData[]): SentimentData {
    return {
      timestamp: data[0]?.timestamp || new Date().toISOString(),
      positive: data.reduce((sum, d) => sum + d.positive, 0),
      negative: data.reduce((sum, d) => sum + d.negative, 0),
      neutral: data.reduce((sum, d) => sum + d.neutral, 0),
      mixed: data.reduce((sum, d) => sum + d.mixed, 0),
      total: data.reduce((sum, d) => sum + d.total, 0),
    };
  }
}
