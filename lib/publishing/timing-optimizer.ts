/**
 * Timing Optimizer
 * 
 * Determines optimal publishing times for maximum visibility and engagement
 * using historical data and platform-specific algorithms.
 */

export interface OptimalTiming {
  platform: string;
  recommendedTime: string; // ISO timestamp
  confidence: number; // 0-1
  reason: string;
  alternatives?: string[]; // Alternative time slots
}

export interface TimingAnalysis {
  platform: string;
  bestTime: string;
  worstTime: string;
  averageEngagement: number;
  peakHours: number[]; // Hours of day (0-23)
  peakDays: string[]; // Days of week
}

export class TimingOptimizer {
  private historicalData: Map<string, TimingAnalysis> = new Map();
  private engagementHistory: Map<string, Map<string, number>> = new Map(); // platform -> time -> engagement

  /**
   * Record engagement data for timing analysis
   */
  recordEngagement(
    platform: string,
    publishedAt: string,
    engagement: number
  ): void {
    // Store engagement for this time
    if (!this.engagementHistory.has(platform)) {
      this.engagementHistory.set(platform, new Map());
    }
    const platformHistory = this.engagementHistory.get(platform)!;
    platformHistory.set(publishedAt, engagement);

    if (!this.historicalData.has(platform)) {
      this.historicalData.set(platform, {
        platform,
        bestTime: publishedAt,
        worstTime: publishedAt,
        averageEngagement: engagement,
        peakHours: [],
        peakDays: [],
      });
    }

    const analysis = this.historicalData.get(platform)!;
    
    // Update best/worst by comparing with stored engagement values
    const bestEngagement = this.getEngagementAt(platform, analysis.bestTime);
    const worstEngagement = this.getEngagementAt(platform, analysis.worstTime);
    
    if (engagement > bestEngagement) {
      analysis.bestTime = publishedAt;
    }
    if (engagement < worstEngagement || worstEngagement === 0) {
      analysis.worstTime = publishedAt;
    }

    // Update average using exponential moving average for better responsiveness
    const alpha = 0.3; // Smoothing factor
    analysis.averageEngagement = alpha * engagement + (1 - alpha) * analysis.averageEngagement;

    // Update peak hours
    const hour = new Date(publishedAt).getHours();
    if (!analysis.peakHours.includes(hour)) {
      analysis.peakHours.push(hour);
      analysis.peakHours.sort();
    }
  }

  /**
   * Get engagement at a specific time from historical data
   */
  private getEngagementAt(platform: string, time: string): number {
    const platformHistory = this.engagementHistory.get(platform);
    if (!platformHistory) {
      return 0;
    }
    return platformHistory.get(time) || 0;
  }

  /**
   * Get optimal timing for platform
   */
  getOptimalTiming(
    platform: string,
    options?: {
      earliest?: string;
      latest?: string;
      timezone?: string;
    }
  ): OptimalTiming {
    const analysis = this.historicalData.get(platform);

    if (analysis) {
      // Use historical data
      const recommendedTime = this.calculateOptimalTime(analysis, options);
      
      return {
        platform,
        recommendedTime,
        confidence: 0.8,
        reason: `Based on historical data showing peak engagement at ${new Date(recommendedTime).toLocaleTimeString()}`,
      };
    }

    // Use platform defaults
    return this.getPlatformDefaults(platform, options);
  }

  /**
   * Calculate optimal time from analysis
   */
  private calculateOptimalTime(
    analysis: TimingAnalysis,
    options?: { earliest?: string; latest?: string; timezone?: string }
  ): string {
    // Use best time from history, adjusted for constraints
    let optimal = new Date(analysis.bestTime);

    // Apply constraints
    if (options?.earliest) {
      const earliest = new Date(options.earliest);
      if (optimal < earliest) {
        optimal = earliest;
      }
    }

    if (options?.latest) {
      const latest = new Date(options.latest);
      if (optimal > latest) {
        optimal = latest;
      }
    }

    return optimal.toISOString();
  }

  /**
   * Get platform default optimal times
   */
  private getPlatformDefaults(
    platform: string,
    options?: { earliest?: string; latest?: string }
  ): OptimalTiming {
    const now = new Date();
    let recommendedTime = now;

    // Platform-specific defaults (UTC times)
    switch (platform) {
      case "twitter":
        // Twitter: 9 AM, 12 PM, 3 PM, 5 PM (UTC)
        recommendedTime = this.setTime(now, 9, 0);
        break;

      case "linkedin":
        // LinkedIn: 8 AM, 12 PM, 5 PM (UTC) - Tuesday-Thursday best
        recommendedTime = this.setTime(now, 8, 0);
        // Adjust to Tuesday-Thursday
        const day = recommendedTime.getDay();
        if (day < 2) {
          recommendedTime.setDate(recommendedTime.getDate() + (2 - day));
        } else if (day > 4) {
          recommendedTime.setDate(recommendedTime.getDate() + (9 - day));
        }
        break;

      case "facebook":
        // Facebook: 1 PM, 3 PM (UTC)
        recommendedTime = this.setTime(now, 13, 0);
        break;

      case "medium":
        // Medium: 8 AM, 12 PM (UTC)
        recommendedTime = this.setTime(now, 8, 0);
        break;

      case "reddit":
        // Reddit: 6 AM, 12 PM, 8 PM (UTC)
        recommendedTime = this.setTime(now, 12, 0);
        break;

      default:
        // Default: 10 AM UTC
        recommendedTime = this.setTime(now, 10, 0);
    }

    // Apply constraints
    if (options?.earliest) {
      const earliest = new Date(options.earliest);
      if (recommendedTime < earliest) {
        recommendedTime = earliest;
      }
    }

    if (options?.latest) {
      const latest = new Date(options.latest);
      if (recommendedTime > latest) {
        recommendedTime = latest;
      }
    }

    return {
      platform,
      recommendedTime: recommendedTime.toISOString(),
      confidence: 0.6,
      reason: `Using platform default optimal time for ${platform}`,
    };
  }

  /**
   * Set time on date
   */
  private setTime(date: Date, hours: number, minutes: number): Date {
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
  }

  /**
   * Get optimal timing for multiple platforms
   */
  getOptimalTimings(
    platforms: string[],
    options?: { earliest?: string; latest?: string }
  ): OptimalTiming[] {
    return platforms.map(platform => this.getOptimalTiming(platform, options));
  }

  /**
   * Schedule content for optimal time
   */
  scheduleForOptimal(
    platform: string,
    content: string,
    options?: { earliest?: string; latest?: string }
  ): { scheduledTime: string; reason: string } {
    const timing = this.getOptimalTiming(platform, options);

    return {
      scheduledTime: timing.recommendedTime,
      reason: timing.reason,
    };
  }
}
