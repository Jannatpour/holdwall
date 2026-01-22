/**
 * Cross-Platform Analyzer
 * 
 * Analyzes mentions across all platforms simultaneously to identify
 * narrative patterns, amplification, and coordinated campaigns.
 */

import { PAIAggregator, PAIData } from "./pai-aggregator";

export interface CrossPlatformAnalysis {
  brandName: string;
  totalMentions: number;
  platforms: {
    platform: string;
    mentions: number;
    sentiment: {
      positive: number;
      negative: number;
      neutral: number;
      mixed: number;
    };
    topPosts: PAIData[];
  }[];
  narrativePatterns: {
    pattern: string;
    frequency: number;
    platforms: string[];
    examples: PAIData[];
  }[];
  amplification: {
    platform: string;
    velocity: number; // Mentions per hour
    trend: "increasing" | "decreasing" | "stable";
  }[];
  coordinatedCampaigns?: {
    indicators: string[];
    confidence: number;
    evidence: PAIData[];
  }[];
}

export class CrossPlatformAnalyzer {
  private aggregator: PAIAggregator;

  constructor() {
    this.aggregator = new PAIAggregator();
  }

  /**
   * Analyze mentions across all platforms
   */
  async analyze(
    brandName: string,
    data: PAIData[]
  ): Promise<CrossPlatformAnalysis> {
    // Group by platform
    const platformGroups = new Map<string, PAIData[]>();
    
    for (const item of data) {
      const platform = item.metadata.platform || item.source.type || "unknown";
      if (!platformGroups.has(platform)) {
        platformGroups.set(platform, []);
      }
      platformGroups.get(platform)!.push(item);
    }

    // Analyze each platform
    const platforms = Array.from(platformGroups.entries()).map(([platform, mentions]) => {
      const sentiment = this.analyzeSentiment(mentions);
      const topPosts = mentions
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 10);

      return {
        platform,
        mentions: mentions.length,
        sentiment,
        topPosts,
      };
    });

    // Identify narrative patterns
    const narrativePatterns = this.identifyNarrativePatterns(data, brandName);

    // Calculate amplification
    const amplification = this.calculateAmplification(platformGroups);

    // Detect coordinated campaigns
    const coordinatedCampaigns = this.detectCoordinatedCampaigns(data);

    return {
      brandName,
      totalMentions: data.length,
      platforms,
      narrativePatterns,
      amplification,
      coordinatedCampaigns,
    };
  }

  /**
   * Analyze sentiment distribution
   */
  private analyzeSentiment(data: PAIData[]): CrossPlatformAnalysis["platforms"][0]["sentiment"] {
    const sentiment: CrossPlatformAnalysis["platforms"][0]["sentiment"] = {
      positive: 0,
      negative: 0,
      neutral: 0,
      mixed: 0,
    };

    for (const item of data) {
      const detected = this.detectSentiment(item.content);
      sentiment[detected]++;
    }

    return sentiment;
  }

  /**
   * Detect sentiment of text
   */
  private detectSentiment(text: string): "positive" | "negative" | "neutral" | "mixed" {
    const lower = text.toLowerCase();
    
    const positiveWords = ["good", "great", "excellent", "amazing", "love", "best"];
    const negativeWords = ["bad", "terrible", "awful", "hate", "worst", "scam"];

    const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lower.includes(w)).length;

    if (positiveCount > negativeCount && positiveCount > 0) {
      return "positive";
    } else if (negativeCount > positiveCount && negativeCount > 0) {
      return "negative";
    } else if (positiveCount > 0 && negativeCount > 0) {
      return "mixed";
    } else {
      return "neutral";
    }
  }

  /**
   * Identify narrative patterns across platforms
   */
  private identifyNarrativePatterns(
    data: PAIData[],
    brandName: string
  ): CrossPlatformAnalysis["narrativePatterns"] {
    const patterns: Map<string, { frequency: number; platforms: Set<string>; examples: PAIData[] }> = new Map();

    // Extract common phrases/claims
    for (const item of data) {
      const phrases = this.extractPhrases(item.content, brandName);
      
      for (const phrase of phrases) {
        if (!patterns.has(phrase)) {
          patterns.set(phrase, {
            frequency: 0,
            platforms: new Set(),
            examples: [],
          });
        }

        const pattern = patterns.get(phrase)!;
        pattern.frequency++;
        pattern.platforms.add(item.metadata.platform || item.source.type || "unknown");
        
        if (pattern.examples.length < 5) {
          pattern.examples.push(item);
        }
      }
    }

    // Convert to array and filter by frequency
    return Array.from(patterns.entries())
      .filter(([_, info]) => info.frequency >= 2) // At least 2 mentions
      .map(([pattern, info]) => ({
        pattern,
        frequency: info.frequency,
        platforms: Array.from(info.platforms),
        examples: info.examples,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10); // Top 10 patterns
  }

  /**
   * Extract key phrases from content
   */
  private extractPhrases(content: string, brandName: string): string[] {
    const phrases: string[] = [];
    const lower = content.toLowerCase();
    const brandLower = brandName.toLowerCase();

    // Extract sentences containing brand
    const sentences = content.split(/[.!?]+/).filter(s => 
      s.toLowerCase().includes(brandLower)
    );

    for (const sentence of sentences) {
      // Extract key phrases (simplified - in production use NLP)
      const words = sentence.toLowerCase().split(/\s+/);
      const brandIndex = words.findIndex(w => w.includes(brandLower));
      
      if (brandIndex !== -1) {
        // Extract 3-5 word phrases around brand
        const start = Math.max(0, brandIndex - 2);
        const end = Math.min(words.length, brandIndex + 3);
        const phrase = words.slice(start, end).join(" ");
        
        if (phrase.length > 10) {
          phrases.push(phrase);
        }
      }
    }

    return phrases;
  }

  /**
   * Calculate amplification velocity
   */
  private calculateAmplification(
    platformGroups: Map<string, PAIData[]>
  ): CrossPlatformAnalysis["amplification"] {
    const amplification: CrossPlatformAnalysis["amplification"] = [];

    for (const [platform, data] of platformGroups.entries()) {
      // Sort by timestamp
      const sorted = data.sort((a, b) => 
        new Date(a.metadata.timestamp).getTime() - new Date(b.metadata.timestamp).getTime()
      );

      if (sorted.length < 2) {
        amplification.push({
          platform,
          velocity: 0,
          trend: "stable",
        });
        continue;
      }

      // Calculate velocity (mentions per hour)
      const firstTime = new Date(sorted[0].metadata.timestamp).getTime();
      const lastTime = new Date(sorted[sorted.length - 1].metadata.timestamp).getTime();
      const hours = (lastTime - firstTime) / (1000 * 60 * 60);
      const velocity = hours > 0 ? sorted.length / hours : 0;

      // Determine trend
      const recent = sorted.slice(-Math.ceil(sorted.length * 0.3));
      const older = sorted.slice(0, Math.ceil(sorted.length * 0.3));
      
      const recentRate = recent.length / (hours * 0.3);
      const olderRate = older.length / (hours * 0.3);
      
      let trend: "increasing" | "decreasing" | "stable";
      if (recentRate > olderRate * 1.2) {
        trend = "increasing";
      } else if (recentRate < olderRate * 0.8) {
        trend = "decreasing";
      } else {
        trend = "stable";
      }

      amplification.push({
        platform,
        velocity,
        trend,
      });
    }

    return amplification;
  }

  /**
   * Detect coordinated campaigns
   */
  private detectCoordinatedCampaigns(
    data: PAIData[]
  ): CrossPlatformAnalysis["coordinatedCampaigns"] {
    const campaigns: CrossPlatformAnalysis["coordinatedCampaigns"] = [];

    // Group by similar content (simplified - in production use semantic similarity)
    const contentGroups = new Map<string, PAIData[]>();
    
    for (const item of data) {
      // Create a signature from content (first 100 chars)
      const signature = item.content.substring(0, 100).toLowerCase().trim();
      
      if (!contentGroups.has(signature)) {
        contentGroups.set(signature, []);
      }
      contentGroups.get(signature)!.push(item);
    }

    // Identify potential coordinated campaigns
    for (const [signature, items] of contentGroups.entries()) {
      if (items.length >= 3) {
        // Multiple similar posts
        const platforms = new Set(items.map(i => i.metadata.platform || i.source.type));
        
        if (platforms.size >= 2) {
          // Across multiple platforms
          const timeSpread = this.calculateTimeSpread(items);
          
          if (timeSpread < 24 * 60 * 60 * 1000) {
            // Within 24 hours - potential coordination
            campaigns.push({
              indicators: [
                `Similar content across ${platforms.size} platforms`,
                `${items.length} similar posts`,
                `Time spread: ${Math.round(timeSpread / (60 * 60 * 1000))} hours`,
              ],
              confidence: Math.min(0.9, items.length / 10),
              evidence: items.slice(0, 10),
            });
          }
        }
      }
    }

    return campaigns.length > 0 ? campaigns : undefined;
  }

  /**
   * Calculate time spread of items
   */
  private calculateTimeSpread(items: PAIData[]): number {
    const times = items
      .map(i => new Date(i.metadata.timestamp).getTime())
      .sort((a, b) => a - b);

    if (times.length < 2) {
      return 0;
    }

    return times[times.length - 1] - times[0];
  }
}
