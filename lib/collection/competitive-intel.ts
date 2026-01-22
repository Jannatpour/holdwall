/**
 * Competitive Intelligence
 * 
 * Monitors competitor narratives and responses to identify opportunities
 * and threats in the competitive landscape.
 */

import { PAIAggregator, PAIData } from "./pai-aggregator";
import { CrossPlatformAnalyzer } from "./cross-platform-analyzer";

export interface CompetitorAnalysis {
  competitor: string;
  mentions: number;
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
  topNarratives: Array<{
    narrative: string;
    frequency: number;
    sentiment: "positive" | "negative" | "neutral" | "mixed";
  }>;
  comparison: {
    vsBrand: {
      sentiment: number; // -1 to 1
      volume: number; // ratio
    };
    opportunities: string[];
    threats: string[];
  };
}

export interface CompetitiveLandscape {
  brandName: string;
  competitors: CompetitorAnalysis[];
  marketPosition: {
    sentiment: number; // -1 to 1
    shareOfVoice: number; // 0-1
    ranking: number;
  };
  opportunities: Array<{
    type: "narrative" | "platform" | "audience";
    description: string;
    potential: number; // 0-1
  }>;
}

export class CompetitiveIntel {
  private aggregator: PAIAggregator;
  private analyzer: CrossPlatformAnalyzer;
  private competitors: string[] = [];

  constructor() {
    this.aggregator = new PAIAggregator();
    this.analyzer = new CrossPlatformAnalyzer();
  }

  /**
   * Register competitors
   */
  registerCompetitors(competitorNames: string[]): void {
    this.competitors = competitorNames;
  }

  /**
   * Analyze competitor
   */
  async analyzeCompetitor(
    competitor: string,
    brandName: string
  ): Promise<CompetitorAnalysis> {
    // Collect data for competitor
    const competitorData = await this.aggregator.aggregateDefaultSources(competitor);
    
    // Analyze competitor
    const competitorAnalysis = await this.analyzer.analyze(competitor, competitorData);

    // Collect data for brand
    const brandData = await this.aggregator.aggregateDefaultSources(brandName);
    const brandAnalysis = await this.analyzer.analyze(brandName, brandData);

    // Compare
    const comparison = this.compare(brandAnalysis, competitorAnalysis);

    return {
      competitor,
      mentions: competitorData.length,
      sentiment: competitorAnalysis.platforms[0]?.sentiment || {
        positive: 0,
        negative: 0,
        neutral: 0,
        mixed: 0,
      },
      topNarratives: competitorAnalysis.narrativePatterns.slice(0, 5).map(p => ({
        narrative: p.pattern,
        frequency: p.frequency,
        sentiment: "neutral", // Would be calculated from examples
      })),
      comparison,
    };
  }

  /**
   * Compare brand vs competitor
   */
  private compare(
    brandAnalysis: any,
    competitorAnalysis: any
  ): CompetitorAnalysis["comparison"] {
    // Calculate sentiment scores
    const brandSentiment = this.calculateSentimentScore(brandAnalysis.platforms[0]?.sentiment);
    const competitorSentiment = this.calculateSentimentScore(competitorAnalysis.platforms[0]?.sentiment);

    // Calculate volume ratio
    const brandVolume = brandAnalysis.totalMentions;
    const competitorVolume = competitorAnalysis.totalMentions;
    const volumeRatio = brandVolume > 0 ? competitorVolume / brandVolume : 0;

    // Identify opportunities and threats
    const opportunities: string[] = [];
    const threats: string[] = [];

    // Opportunities: competitor has negative narratives we can address
    for (const pattern of competitorAnalysis.narrativePatterns) {
      if (pattern.frequency >= 3) {
        // Check if brand has similar narrative
        const brandHasSimilar = brandAnalysis.narrativePatterns.some(
          (p: any) => this.similarNarratives(p.pattern, pattern.pattern)
        );

        if (!brandHasSimilar) {
          opportunities.push(
            `Competitor faces narrative: "${pattern.pattern}" - opportunity to differentiate`
          );
        }
      }
    }

    // Threats: competitor has positive narratives we lack
    for (const pattern of competitorAnalysis.narrativePatterns) {
      if (pattern.frequency >= 3) {
        const brandHasSimilar = brandAnalysis.narrativePatterns.some(
          (p: any) => this.similarNarratives(p.pattern, pattern.pattern)
        );

        if (!brandHasSimilar && competitorSentiment > brandSentiment) {
          threats.push(
            `Competitor has positive narrative: "${pattern.pattern}" - we should address this`
          );
        }
      }
    }

    return {
      vsBrand: {
        sentiment: competitorSentiment - brandSentiment,
        volume: volumeRatio,
      },
      opportunities,
      threats,
    };
  }

  /**
   * Calculate sentiment score (-1 to 1)
   */
  private calculateSentimentScore(sentiment?: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  }): number {
    if (!sentiment) return 0;

    const total = sentiment.positive + sentiment.negative + sentiment.neutral + sentiment.mixed;
    if (total === 0) return 0;

    const positiveRatio = sentiment.positive / total;
    const negativeRatio = sentiment.negative / total;

    return positiveRatio - negativeRatio;
  }

  /**
   * Check if narratives are similar
   */
  private similarNarratives(narrative1: string, narrative2: string): boolean {
    const words1 = new Set(narrative1.toLowerCase().split(/\s+/));
    const words2 = new Set(narrative2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    // Jaccard similarity
    const similarity = intersection.size / union.size;
    return similarity > 0.5;
  }

  /**
   * Analyze competitive landscape
   */
  async analyzeLandscape(
    brandName: string,
    competitors: string[]
  ): Promise<CompetitiveLandscape> {
    this.registerCompetitors(competitors);

    // Analyze all competitors
    const competitorAnalyses = await Promise.all(
      competitors.map(competitor => this.analyzeCompetitor(competitor, brandName))
    );

    // Calculate market position
    const brandData = await this.aggregator.aggregateDefaultSources(brandName);
    const brandAnalysis = await this.analyzer.analyze(brandName, brandData);

    const totalMentions = competitorAnalyses.reduce((sum, c) => sum + c.mentions, 0) + brandData.length;
    const shareOfVoice = totalMentions > 0 ? brandData.length / totalMentions : 0;

    const brandSentiment = this.calculateSentimentScore(
      brandAnalysis.platforms[0]?.sentiment
    );

    // Rank by sentiment
    const rankings = [
      { name: brandName, sentiment: brandSentiment },
      ...competitorAnalyses.map(c => ({
        name: c.competitor,
        sentiment: this.calculateSentimentScore(c.sentiment),
      })),
    ].sort((a, b) => b.sentiment - a.sentiment);

    const ranking = rankings.findIndex(r => r.name === brandName) + 1;

    // Identify opportunities
    const opportunities = this.identifyOpportunities(brandAnalysis, competitorAnalyses);

    return {
      brandName,
      competitors: competitorAnalyses,
      marketPosition: {
        sentiment: brandSentiment,
        shareOfVoice,
        ranking,
      },
      opportunities,
    };
  }

  /**
   * Identify opportunities
   */
  private identifyOpportunities(
    brandAnalysis: any,
    competitorAnalyses: CompetitorAnalysis[]
  ): CompetitiveLandscape["opportunities"] {
    const opportunities: CompetitiveLandscape["opportunities"] = [];

    // Narrative opportunities
    for (const competitor of competitorAnalyses) {
      for (const narrative of competitor.topNarratives) {
        const brandHasSimilar = brandAnalysis.narrativePatterns.some(
          (p: any) => this.similarNarratives(p.pattern, narrative.narrative)
        );

        if (!brandHasSimilar && narrative.sentiment === "negative") {
          opportunities.push({
            type: "narrative",
            description: `Competitor ${competitor.competitor} faces negative narrative: "${narrative.narrative}" - opportunity to position brand positively`,
            potential: 0.7,
          });
        }
      }
    }

    // Platform opportunities (simplified)
    const brandPlatforms = new Set(
      brandAnalysis.platforms.map((p: any) => p.platform)
    );

    for (const competitor of competitorAnalyses) {
      // Would check competitor platforms and identify gaps
    }

    return opportunities;
  }
}
