/**
 * Content Gap Analyzer
 * 
 * Identifies content gaps in target topics to ensure comprehensive
 * coverage and authority building.
 */

export interface ContentGap {
  topic: string;
  subtopic: string;
  priority: "high" | "medium" | "low";
  reason: string;
  suggestedContent: {
    title: string;
    type: "article" | "faq" | "guide" | "case_study";
    estimatedWordCount: number;
  };
}

export interface GapAnalysis {
  topic: string;
  gaps: ContentGap[];
  coverage: number; // 0-1
  recommendations: string[];
}

export class GapAnalyzer {
  private existingContent: Map<string, Array<{
    title: string;
    url: string;
    topics: string[];
    wordCount: number;
  }>> = new Map();

  /**
   * Register existing content
   */
  registerContent(
    topic: string,
    content: Array<{ title: string; url: string; topics: string[]; wordCount: number }>
  ): void {
    this.existingContent.set(topic, content);
  }

  /**
   * Analyze gaps for topic
   */
  analyzeGaps(topic: string): GapAnalysis {
    const existing = this.existingContent.get(topic) || [];
    const gaps: ContentGap[] = [];

    // Expected subtopics
    const expectedSubtopics = this.generateExpectedSubtopics(topic);

    // Check coverage
    const coveredSubtopics = new Set<string>();
    for (const content of existing) {
      for (const contentTopic of content.topics) {
        coveredSubtopics.add(contentTopic.toLowerCase());
      }
    }

    // Identify gaps
    for (const subtopic of expectedSubtopics) {
      const subtopicLower = subtopic.toLowerCase();
      const isCovered = Array.from(coveredSubtopics).some(covered =>
        covered.includes(subtopicLower) || subtopicLower.includes(covered)
      );

      if (!isCovered) {
        // Determine priority
        const priority = this.determinePriority(subtopic, topic);

        gaps.push({
          topic,
          subtopic,
          priority,
          reason: `Missing content on ${subtopic}`,
          suggestedContent: {
            title: `${subtopic}: Complete Guide`,
            type: "guide",
            estimatedWordCount: 1500,
          },
        });
      }
    }

    // Calculate coverage
    const coverage = expectedSubtopics.length > 0
      ? (expectedSubtopics.length - gaps.length) / expectedSubtopics.length
      : 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(gaps, coverage);

    return {
      topic,
      gaps,
      coverage,
      recommendations,
    };
  }

  /**
   * Generate expected subtopics
   */
  private generateExpectedSubtopics(topic: string): string[] {
    return [
      `Introduction to ${topic}`,
      `What is ${topic}?`,
      `How ${topic} Works`,
      `Benefits of ${topic}`,
      `${topic} Best Practices`,
      `${topic} Use Cases`,
      `${topic} vs Alternatives`,
      `${topic} Implementation`,
      `${topic} Security`,
      `${topic} Pricing`,
      `${topic} FAQ`,
      `${topic} Troubleshooting`,
    ];
  }

  /**
   * Determine priority
   */
  private determinePriority(subtopic: string, topic: string): "high" | "medium" | "low" {
    const highPriorityKeywords = ["introduction", "what is", "how", "faq"];
    const mediumPriorityKeywords = ["benefits", "use cases", "best practices"];

    const lower = subtopic.toLowerCase();

    if (highPriorityKeywords.some(kw => lower.includes(kw))) {
      return "high";
    } else if (mediumPriorityKeywords.some(kw => lower.includes(kw))) {
      return "medium";
    } else {
      return "low";
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    gaps: ContentGap[],
    coverage: number
  ): string[] {
    const recommendations: string[] = [];

    if (coverage < 0.5) {
      recommendations.push("Significant content gaps detected. Prioritize high-priority topics first.");
    }

    const highPriorityGaps = gaps.filter(g => g.priority === "high");
    if (highPriorityGaps.length > 0) {
      recommendations.push(
        `Create ${highPriorityGaps.length} high-priority content pieces: ${highPriorityGaps.map(g => g.subtopic).join(", ")}`
      );
    }

    if (coverage > 0.8) {
      recommendations.push("Good coverage. Focus on depth and updating existing content.");
    }

    return recommendations;
  }

  /**
   * Get gaps by priority
   */
  getGapsByPriority(topic: string, priority: "high" | "medium" | "low"): ContentGap[] {
    const analysis = this.analyzeGaps(topic);
    return analysis.gaps.filter(g => g.priority === priority);
  }
}
