/**
 * Hashtag Optimizer
 * 
 * Intelligent hashtag selection for maximum reach and engagement
 * based on trending topics and platform algorithms.
 */

export interface HashtagRecommendation {
  hashtag: string;
  relevance: number; // 0-1
  reach: number; // Estimated reach
  competition: "low" | "medium" | "high";
  trend: "rising" | "stable" | "declining";
}

export interface HashtagOptimization {
  content: string;
  recommended: HashtagRecommendation[];
  selected: string[];
  reason: string;
}

export class HashtagOptimizer {
  private trendingHashtags: Map<string, {
    count: number;
    trend: "rising" | "stable" | "declining";
    lastUpdated: string;
  }> = new Map();

  /**
   * Update trending hashtags
   */
  updateTrending(hashtag: string, count: number, trend: "rising" | "stable" | "declining"): void {
    this.trendingHashtags.set(hashtag.toLowerCase(), {
      count,
      trend,
      lastUpdated: new Date().toISOString(),
    });
  }

  /**
   * Recommend hashtags for content
   */
  recommendHashtags(
    content: string,
    platform: string,
    maxHashtags: number = 5
  ): HashtagRecommendation[] {
    // Extract keywords from content
    const keywords = this.extractKeywords(content);

    // Generate hashtag candidates
    const candidates = this.generateHashtagCandidates(keywords, content);

    // Score and rank candidates
    const scored = candidates.map(candidate => ({
      hashtag: candidate,
      ...this.scoreHashtag(candidate, platform),
    }));

    // Sort by relevance and reach
    const ranked = scored.sort((a, b) => {
      const scoreA = a.relevance * 0.6 + (a.reach / 1000000) * 0.4;
      const scoreB = b.relevance * 0.6 + (b.reach / 1000000) * 0.4;
      return scoreB - scoreA;
    });

    return ranked.slice(0, maxHashtags);
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string): string[] {
    // Simple keyword extraction (in production, use NLP)
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 4); // Filter short words

    // Count frequencies
    const frequencies = new Map<string, number>();
    for (const word of words) {
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    }

    // Get top keywords
    return Array.from(frequencies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Generate hashtag candidates
   */
  private generateHashtagCandidates(keywords: string[], content: string): string[] {
    const candidates = new Set<string>();

    // Direct keyword hashtags
    for (const keyword of keywords) {
      candidates.add(keyword);
    }

    // Multi-word phrases
    const phrases = content.toLowerCase().match(/\b\w+\s+\w+\b/g) || [];
    for (const phrase of phrases.slice(0, 5)) {
      candidates.add(phrase.replace(/\s+/g, ""));
    }

    // Industry-specific hashtags (would be more sophisticated in production)
    const industryTerms = ["ai", "technology", "business", "innovation", "enterprise"];
    for (const term of industryTerms) {
      if (content.toLowerCase().includes(term)) {
        candidates.add(term);
      }
    }

    return Array.from(candidates);
  }

  /**
   * Score hashtag
   */
  private scoreHashtag(
    hashtag: string,
    platform: string
  ): Omit<HashtagRecommendation, "hashtag"> {
    const lower = hashtag.toLowerCase();
    const trending = this.trendingHashtags.get(lower);

    // Calculate relevance (simplified)
    let relevance = 0.5;
    if (trending) {
      relevance = Math.min(0.9, 0.5 + trending.count / 10000);
    }

    // Estimate reach (simplified)
    const reach = trending ? trending.count * 100 : 1000;

    // Determine competition
    let competition: "low" | "medium" | "high" = "medium";
    if (trending) {
      if (trending.count < 1000) {
        competition = "low";
      } else if (trending.count > 100000) {
        competition = "high";
      }
    }

    // Get trend
    const trend = trending?.trend || "stable";

    return {
      relevance,
      reach,
      competition,
      trend,
    };
  }

  /**
   * Optimize hashtags for content
   */
  optimize(
    content: string,
    platform: string,
    maxHashtags: number = 5
  ): HashtagOptimization {
    const recommended = this.recommendHashtags(content, platform, maxHashtags);

    // Select best hashtags
    const selected = recommended
      .filter(h => h.relevance > 0.5 && h.competition !== "high")
      .slice(0, maxHashtags)
      .map(h => h.hashtag);

    const reason = selected.length > 0
      ? `Selected ${selected.length} hashtags based on relevance and reach`
      : "No suitable hashtags found";

    return {
      content,
      recommended,
      selected,
      reason,
    };
  }

  /**
   * Add hashtags to content
   */
  addHashtags(
    content: string,
    platform: string,
    maxHashtags: number = 5
  ): string {
    const optimization = this.optimize(content, platform, maxHashtags);

    if (optimization.selected.length === 0) {
      return content;
    }

    const hashtags = optimization.selected
      .map(h => h.startsWith("#") ? h : `#${h}`)
      .join(" ");

    return `${content} ${hashtags}`;
  }
}
