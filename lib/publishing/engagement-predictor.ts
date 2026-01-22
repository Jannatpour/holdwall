/**
 * Engagement Predictor
 * 
 * Predicts engagement levels before publishing to optimize content
 * and timing decisions.
 */

export interface EngagementPrediction {
  platform: string;
  predictedEngagement: number;
  confidence: number; // 0-1
  factors: Array<{
    factor: string;
    impact: "positive" | "negative" | "neutral";
    magnitude: number; // 0-1
  }>;
  recommendations?: string[];
}

export interface EngagementFactors {
  contentLength: number;
  hashtagCount: number;
  linkCount: number;
  sentiment: "positive" | "negative" | "neutral";
  timing: string; // ISO timestamp
  dayOfWeek: number; // 0-6
  hourOfDay: number; // 0-23
}

export class EngagementPredictor {
  private historicalData: Map<string, Array<{
    factors: EngagementFactors;
    actualEngagement: number;
  }>> = new Map();

  /**
   * Record historical engagement data
   */
  recordEngagement(
    platform: string,
    factors: EngagementFactors,
    actualEngagement: number
  ): void {
    if (!this.historicalData.has(platform)) {
      this.historicalData.set(platform, []);
    }

    this.historicalData.get(platform)!.push({
      factors,
      actualEngagement,
    });
  }

  /**
   * Predict engagement
   */
  predict(
    platform: string,
    factors: EngagementFactors
  ): EngagementPrediction {
    const historical = this.historicalData.get(platform) || [];
    const factorsList: EngagementPrediction["factors"] = [];

    let predictedEngagement = 100; // Base prediction

    // Analyze each factor
    if (historical.length > 0) {
      // Content length factor
      const lengthImpact = this.analyzeLengthImpact(historical, factors.contentLength);
      factorsList.push({
        factor: "content_length",
        impact: lengthImpact > 0 ? "positive" : "negative",
        magnitude: Math.abs(lengthImpact),
      });
      predictedEngagement += lengthImpact * 50;

      // Hashtag factor
      const hashtagImpact = this.analyzeHashtagImpact(historical, factors.hashtagCount);
      factorsList.push({
        factor: "hashtags",
        impact: hashtagImpact > 0 ? "positive" : "negative",
        magnitude: Math.abs(hashtagImpact),
      });
      predictedEngagement += hashtagImpact * 30;

      // Timing factor
      const timingImpact = this.analyzeTimingImpact(historical, factors.hourOfDay, factors.dayOfWeek);
      factorsList.push({
        factor: "timing",
        impact: timingImpact > 0 ? "positive" : "negative",
        magnitude: Math.abs(timingImpact),
      });
      predictedEngagement += timingImpact * 40;

      // Sentiment factor
      const sentimentImpact = factors.sentiment === "positive" ? 0.2 : 
                             factors.sentiment === "negative" ? -0.3 : 0;
      factorsList.push({
        factor: "sentiment",
        impact: sentimentImpact > 0 ? "positive" : sentimentImpact < 0 ? "negative" : "neutral",
        magnitude: Math.abs(sentimentImpact),
      });
      predictedEngagement += sentimentImpact * 100;
    } else {
      // Use defaults if no historical data
      predictedEngagement = this.getDefaultPrediction(platform, factors);
    }

    // Calculate confidence
    const confidence = Math.min(0.9, 0.5 + historical.length / 50);

    // Generate recommendations
    const recommendations = this.generateRecommendations(factors, factorsList);

    return {
      platform,
      predictedEngagement: Math.max(0, Math.round(predictedEngagement)),
      confidence,
      factors: factorsList,
      recommendations,
    };
  }

  /**
   * Analyze length impact
   */
  private analyzeLengthImpact(
    historical: Array<{ factors: EngagementFactors; actualEngagement: number }>,
    currentLength: number
  ): number {
    // Find optimal length from history
    const optimalLength = historical
      .sort((a, b) => b.actualEngagement - a.actualEngagement)
      .slice(0, 5)
      .reduce((sum, item) => sum + item.factors.contentLength, 0) / 5;

    // Calculate impact
    const difference = Math.abs(currentLength - optimalLength);
    const maxDifference = optimalLength;
    const impact = 1 - (difference / maxDifference);

    return (currentLength <= optimalLength ? impact : -impact) * 0.3;
  }

  /**
   * Analyze hashtag impact
   */
  private analyzeHashtagImpact(
    historical: Array<{ factors: EngagementFactors; actualEngagement: number }>,
    currentCount: number
  ): number {
    // Find optimal hashtag count
    const optimalCount = historical
      .sort((a, b) => b.actualEngagement - a.actualEngagement)
      .slice(0, 5)
      .reduce((sum, item) => sum + item.factors.hashtagCount, 0) / 5;

    const difference = Math.abs(currentCount - optimalCount);
    return difference === 0 ? 0.2 : (difference > 2 ? -0.2 : 0.1);
  }

  /**
   * Analyze timing impact
   */
  private analyzeTimingImpact(
    historical: Array<{ factors: EngagementFactors; actualEngagement: number }>,
    hour: number,
    day: number
  ): number {
    // Find best performing time slots
    const bestSlots = historical
      .sort((a, b) => b.actualEngagement - a.actualEngagement)
      .slice(0, 10);

    const bestHours = bestSlots.map(item => item.factors.hourOfDay);
    const bestDays = bestSlots.map(item => item.factors.dayOfWeek);

    // Check if current time matches
    const hourMatch = bestHours.includes(hour);
    const dayMatch = bestDays.includes(day);

    if (hourMatch && dayMatch) {
      return 0.3;
    } else if (hourMatch || dayMatch) {
      return 0.15;
    } else {
      return -0.1;
    }
  }

  /**
   * Get default prediction
   */
  private getDefaultPrediction(platform: string, factors: EngagementFactors): number {
    const defaults: Record<string, number> = {
      twitter: 50,
      linkedin: 100,
      facebook: 80,
      medium: 200,
      reddit: 30,
    };

    return defaults[platform] || 50;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    factors: EngagementFactors,
    factorAnalysis: EngagementPrediction["factors"]
  ): string[] {
    const recommendations: string[] = [];

    // Check content length
    const lengthFactor = factorAnalysis.find(f => f.factor === "content_length");
    if (lengthFactor && lengthFactor.impact === "negative") {
      if (factors.contentLength > 1000) {
        recommendations.push("Consider shortening content for better engagement");
      } else if (factors.contentLength < 100) {
        recommendations.push("Consider expanding content for more value");
      }
    }

    // Check hashtags
    const hashtagFactor = factorAnalysis.find(f => f.factor === "hashtags");
    if (hashtagFactor && hashtagFactor.impact === "negative") {
      if (factors.hashtagCount === 0) {
        recommendations.push("Add 2-3 relevant hashtags to increase reach");
      } else if (factors.hashtagCount > 5) {
        recommendations.push("Reduce hashtag count to 2-3 for better engagement");
      }
    }

    // Check timing
    const timingFactor = factorAnalysis.find(f => f.factor === "timing");
    if (timingFactor && timingFactor.impact === "negative") {
      recommendations.push("Consider scheduling for a different time for better engagement");
    }

    // Check sentiment
    const sentimentFactor = factorAnalysis.find(f => f.factor === "sentiment");
    if (sentimentFactor && sentimentFactor.impact === "negative") {
      recommendations.push("Consider adjusting tone to be more positive");
    }

    return recommendations;
  }

  /**
   * Predict for multiple platforms
   */
  predictMultiple(
    platforms: string[],
    factors: EngagementFactors
  ): EngagementPrediction[] {
    return platforms.map(platform => this.predict(platform, factors));
  }
}
