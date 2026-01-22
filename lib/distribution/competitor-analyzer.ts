/**
 * Competitor Content Analyzer
 * 
 * Analyzes competitor content for opportunities and gaps
 * to inform content strategy.
 */

import { PAIAggregator, PAIData } from "../collection/pai-aggregator";

export interface CompetitorContent {
  competitor: string;
  content: PAIData[];
  topTopics: Array<{
    topic: string;
    frequency: number;
    averageEngagement: number;
  }>;
  gaps: Array<{
    topic: string;
    opportunity: string;
    potential: number; // 0-1
  }>;
}

export class CompetitorAnalyzer {
  private aggregator: PAIAggregator;

  constructor() {
    this.aggregator = new PAIAggregator();
  }

  /**
   * Analyze competitor content
   */
  async analyze(
    competitor: string,
    brandName: string
  ): Promise<CompetitorContent> {
    // Collect competitor content
    const competitorData = await this.aggregator.aggregateDefaultSources(competitor);

    // Extract top topics
    const topTopics = this.extractTopTopics(competitorData);

    // Identify gaps (topics competitor covers that we don't, or vice versa)
    const gaps = await this.identifyGaps(competitor, brandName, competitorData);

    return {
      competitor,
      content: competitorData,
      topTopics,
      gaps,
    };
  }

  /**
   * Extract top topics
   */
  private extractTopTopics(data: PAIData[]): CompetitorContent["topTopics"] {
    const topicCounts = new Map<string, { frequency: number; totalEngagement: number; count: number }>();

    for (const item of data) {
      // Extract topics (simplified)
      const topics = this.extractTopics(item.content);

      for (const topic of topics) {
        if (!topicCounts.has(topic)) {
          topicCounts.set(topic, { frequency: 0, totalEngagement: 0, count: 0 });
        }

        const stats = topicCounts.get(topic)!;
        stats.frequency++;
        stats.count++;

        // Calculate engagement (simplified)
        const engagement = this.calculateEngagement(item);
        stats.totalEngagement += engagement;
      }
    }

    // Convert to array
    return Array.from(topicCounts.entries())
      .map(([topic, stats]) => ({
        topic,
        frequency: stats.frequency,
        averageEngagement: stats.totalEngagement / stats.count,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  /**
   * Extract topics from content
   */
  private extractTopics(content: string): string[] {
    // Simple extraction (in production, use NLP)
    const words = content
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4);

    // Get frequent words as topics
    const frequencies = new Map<string, number>();
    for (const word of words) {
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    }

    return Array.from(frequencies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Calculate engagement
   */
  private calculateEngagement(item: PAIData): number {
    const engagement = item.metadata.engagement || {};
    return Object.values(engagement).reduce((sum: number, val: any) => 
      sum + (typeof val === "number" ? val : 0), 0
    );
  }

  /**
   * Identify gaps
   */
  private async identifyGaps(
    competitor: string,
    brandName: string,
    competitorData: PAIData[]
  ): Promise<CompetitorContent["gaps"]> {
    const gaps: CompetitorContent["gaps"] = [];

    // Get brand content
    const brandData = await this.aggregator.aggregateDefaultSources(brandName);

    // Find topics competitor covers that we don't
    const competitorTopics = new Set(
      competitorData.flatMap(item => this.extractTopics(item.content))
    );

    const brandTopics = new Set(
      brandData.flatMap(item => this.extractTopics(item.content))
    );

    for (const topic of competitorTopics) {
      if (!brandTopics.has(topic)) {
        gaps.push({
          topic,
          opportunity: `Competitor ${competitor} covers "${topic}" but we don't - opportunity to create content`,
          potential: 0.7,
        });
      }
    }

    return gaps;
  }
}
