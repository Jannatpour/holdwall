/**
 * Influencer Tracker
 * 
 * Identifies and tracks key opinion leaders, influencers, and authoritative
 * voices discussing the brand across platforms.
 */

import { PAIData } from "./pai-aggregator";

export interface Influencer {
  username: string;
  platform: string;
  displayName?: string;
  verified?: boolean;
  followerCount?: number;
  engagement: {
    totalMentions: number;
    averageEngagement?: number;
    reach?: number;
  };
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
  };
  influenceScore: number; // 0-1
  recentMentions: PAIData[];
}

export interface InfluencerAnalysis {
  brandName: string;
  influencers: Influencer[];
  topInfluencers: Influencer[];
  byPlatform: Record<string, Influencer[]>;
  trends: Array<{
    influencer: string;
    trend: "increasing" | "decreasing" | "stable";
    change: number;
  }>;
}

export class InfluencerTracker {
  private influencerData: Map<string, Map<string, PAIData[]>> = new Map(); // brand -> username -> mentions

  /**
   * Track influencers from data
   */
  trackInfluencers(brandName: string, data: PAIData[]): void {
    if (!this.influencerData.has(brandName)) {
      this.influencerData.set(brandName, new Map());
    }

    const brandInfluencers = this.influencerData.get(brandName)!;

    for (const item of data) {
      const author = item.metadata.author;
      if (!author) continue;

      const platform = item.metadata.platform || item.source.type || "unknown";
      const key = `${platform}:${author}`;

      if (!brandInfluencers.has(key)) {
        brandInfluencers.set(key, []);
      }

      brandInfluencers.get(key)!.push(item);
    }
  }

  /**
   * Analyze influencers
   */
  analyzeInfluencers(brandName: string): InfluencerAnalysis {
    const brandInfluencers = this.influencerData.get(brandName);
    if (!brandInfluencers) {
      return {
        brandName,
        influencers: [],
        topInfluencers: [],
        byPlatform: {},
        trends: [],
      };
    }

    const influencers: Influencer[] = [];

    for (const [key, mentions] of brandInfluencers.entries()) {
      const [platform, username] = key.split(":");

      // Calculate engagement
      const totalEngagement = mentions.reduce((sum, m) => {
        const engagement = m.metadata.engagement || {};
        return sum + Object.values(engagement).reduce((s: number, v: any) => s + (typeof v === "number" ? v : 0), 0);
      }, 0);

      const averageEngagement = mentions.length > 0 ? totalEngagement / mentions.length : 0;

      // Calculate sentiment
      const sentiment = this.calculateSentiment(mentions);

      // Calculate influence score
      const influenceScore = this.calculateInfluenceScore(mentions, averageEngagement);

      influencers.push({
        username,
        platform,
        engagement: {
          totalMentions: mentions.length,
          averageEngagement,
        },
        sentiment,
        influenceScore,
        recentMentions: mentions.slice(-10), // Last 10 mentions
      });
    }

    // Sort by influence score
    const sorted = influencers.sort((a, b) => b.influenceScore - a.influenceScore);
    const topInfluencers = sorted.slice(0, 10);

    // Group by platform
    const byPlatform: Record<string, Influencer[]> = {};
    for (const influencer of influencers) {
      if (!byPlatform[influencer.platform]) {
        byPlatform[influencer.platform] = [];
      }
      byPlatform[influencer.platform].push(influencer);
    }

    // Calculate trends (simplified)
    const trends = this.calculateTrends(brandInfluencers);

    return {
      brandName,
      influencers: sorted,
      topInfluencers,
      byPlatform,
      trends,
    };
  }

  /**
   * Calculate sentiment distribution
   */
  private calculateSentiment(mentions: PAIData[]): Influencer["sentiment"] {
    const sentiment: Influencer["sentiment"] = {
      positive: 0,
      negative: 0,
      neutral: 0,
    };

    for (const mention of mentions) {
      const detected = this.detectSentiment(mention.content);
      sentiment[detected]++;
    }

    return sentiment;
  }

  /**
   * Detect sentiment
   */
  private detectSentiment(text: string): "positive" | "negative" | "neutral" {
    const lower = text.toLowerCase();
    
    const positiveWords = ["good", "great", "excellent", "amazing", "love"];
    const negativeWords = ["bad", "terrible", "awful", "hate", "scam"];

    const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lower.includes(w)).length;

    if (positiveCount > negativeCount) {
      return "positive";
    } else if (negativeCount > positiveCount) {
      return "negative";
    } else {
      return "neutral";
    }
  }

  /**
   * Calculate influence score
   */
  private calculateInfluenceScore(
    mentions: PAIData[],
    averageEngagement: number
  ): number {
    let score = 0;

    // Base score from mention count
    score += Math.min(0.3, mentions.length * 0.01);

    // Engagement score
    score += Math.min(0.4, averageEngagement / 1000);

    // Recency bonus
    const recentMentions = mentions.filter(m => {
      const mentionTime = new Date(m.metadata.timestamp).getTime();
      const daysAgo = (Date.now() - mentionTime) / (1000 * 60 * 60 * 24);
      return daysAgo < 7; // Last 7 days
    });

    score += Math.min(0.2, recentMentions.length * 0.02);

    // Sentiment bonus (positive mentions are more influential)
    const positiveMentions = mentions.filter(m => {
      const sentiment = this.detectSentiment(m.content);
      return sentiment === "positive";
    });

    score += Math.min(0.1, positiveMentions.length / mentions.length * 0.1);

    return Math.min(1.0, score);
  }

  /**
   * Calculate trends
   */
  private calculateTrends(
    brandInfluencers: Map<string, PAIData[]>
  ): InfluencerAnalysis["trends"] {
    const trends: InfluencerAnalysis["trends"] = [];

    for (const [key, mentions] of brandInfluencers.entries()) {
      if (mentions.length < 2) continue;

      // Sort by timestamp
      const sorted = mentions.sort((a, b) =>
        new Date(a.metadata.timestamp).getTime() - new Date(b.metadata.timestamp).getTime()
      );

      // Compare recent vs older
      const recent = sorted.slice(-Math.ceil(sorted.length * 0.3));
      const older = sorted.slice(0, Math.ceil(sorted.length * 0.3));

      const change = recent.length - older.length;
      const changeRatio = older.length > 0 ? change / older.length : 0;

      let trend: "increasing" | "decreasing" | "stable";
      if (changeRatio > 0.2) {
        trend = "increasing";
      } else if (changeRatio < -0.2) {
        trend = "decreasing";
      } else {
        trend = "stable";
      }

      trends.push({
        influencer: key,
        trend,
        change: changeRatio,
      });
    }

    return trends;
  }

  /**
   * Get top influencers for a brand
   */
  getTopInfluencers(brandName: string, limit: number = 10): Influencer[] {
    const analysis = this.analyzeInfluencers(brandName);
    return analysis.topInfluencers.slice(0, limit);
  }

  /**
   * Get influencers by platform
   */
  getInfluencersByPlatform(
    brandName: string,
    platform: string
  ): Influencer[] {
    const analysis = this.analyzeInfluencers(brandName);
    return analysis.byPlatform[platform] || [];
  }
}
