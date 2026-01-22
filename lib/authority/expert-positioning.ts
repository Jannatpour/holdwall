/**
 * Expert Positioning
 * 
 * Positions brand as expert through comprehensive content hubs
 * and authoritative content creation.
 */

import { TopicalAuthority } from "../seo/topical-authority";

export interface ExpertPosition {
  topic: string;
  authorityScore: number; // 0-1
  contentCount: number;
  coverage: {
    breadth: number;
    depth: number;
  };
  gaps: string[]; // Topics needing more content
}

export class ExpertPositioning {
  private topicalAuthority: TopicalAuthority;
  private positions: Map<string, ExpertPosition> = new Map();

  constructor() {
    this.topicalAuthority = new TopicalAuthority();
  }

  /**
   * Build expert position for topic
   */
  async buildPosition(
    topic: string,
    existingContent: Array<{ title: string; url: string; wordCount: number }>
  ): Promise<ExpertPosition> {
    // Build topical authority hub
    const hub = await this.topicalAuthority.buildHub({
      topic,
      targetWordCount: 10000,
      minArticles: 5,
    });

    // Analyze gaps
    const gaps = this.identifyGaps(topic, existingContent);

    const position: ExpertPosition = {
      topic,
      authorityScore: hub.authorityScore,
      contentCount: hub.articles.length,
      coverage: hub.coverage,
      gaps,
    };

    this.positions.set(topic, position);
    return position;
  }

  /**
   * Identify content gaps
   */
  private identifyGaps(
    topic: string,
    existingContent: Array<{ title: string; url: string; wordCount: number }>
  ): string[] {
    const gaps: string[] = [];

    // Expected subtopics
    const expectedSubtopics = [
      `Introduction to ${topic}`,
      `How ${topic} Works`,
      `${topic} Best Practices`,
      `${topic} Use Cases`,
      `${topic} FAQ`,
    ];

    // Check which are missing
    const existingTitles = existingContent.map(c => c.title.toLowerCase());
    
    for (const subtopic of expectedSubtopics) {
      const hasContent = existingTitles.some(title => 
        title.includes(subtopic.toLowerCase())
      );

      if (!hasContent) {
        gaps.push(subtopic);
      }
    }

    return gaps;
  }

  /**
   * Get expert position
   */
  getPosition(topic: string): ExpertPosition | null {
    return this.positions.get(topic) || null;
  }

  /**
   * Check if brand is positioned as expert
   */
  isExpert(topic: string, minScore: number = 0.7): boolean {
    const position = this.positions.get(topic);
    return position ? position.authorityScore >= minScore : false;
  }

  /**
   * Get topics needing more content
   */
  getTopicsNeedingContent(minScore: number = 0.7): string[] {
    const topics: string[] = [];

    for (const [topic, position] of this.positions.entries()) {
      if (position.authorityScore < minScore) {
        topics.push(topic);
      }
    }

    return topics;
  }
}
