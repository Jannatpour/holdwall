/**
 * Competitor Filter
 * 
 * Filters out competitor mentions to avoid confusion between brand and competitors.
 * Uses entity resolution and context analysis to distinguish brands.
 */

export interface CompetitorInfo {
  name: string;
  aliases?: string[];
  industry?: string;
  keywords?: string[];
}

export class CompetitorFilter {
  private competitors: Map<string, CompetitorInfo> = new Map(); // competitor -> info
  private brandKeywords: Map<string, string[]> = new Map(); // brand -> keywords

  /**
   * Register a competitor
   */
  registerCompetitor(competitor: CompetitorInfo): void {
    const normalized = competitor.name.toLowerCase();
    this.competitors.set(normalized, competitor);

    // Also register aliases
    if (competitor.aliases) {
      for (const alias of competitor.aliases) {
        this.competitors.set(alias.toLowerCase(), competitor);
      }
    }
  }

  /**
   * Register brand keywords to help distinguish from competitors
   */
  registerBrandKeywords(brandName: string, keywords: string[]): void {
    this.brandKeywords.set(brandName.toLowerCase(), keywords.map(k => k.toLowerCase()));
  }

  /**
   * Check if text mentions a competitor
   */
  isCompetitor(text: string): boolean {
    const lower = text.toLowerCase();

    for (const [competitor, info] of this.competitors.entries()) {
      if (lower.includes(competitor)) {
        return true;
      }

      // Check aliases
      if (info.aliases) {
        for (const alias of info.aliases) {
          if (lower.includes(alias.toLowerCase())) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Check if mention is actually about the brand (not competitor)
   */
  isBrandMention(
    text: string,
    brandName: string,
    position: { start: number; end: number }
  ): boolean {
    const lower = text.toLowerCase();
    const brandLower = brandName.toLowerCase();

    // Extract context around mention
    const contextWindow = 50;
    const context = text.substring(
      Math.max(0, position.start - contextWindow),
      Math.min(text.length, position.end + contextWindow)
    ).toLowerCase();

    // Check if competitor is mentioned nearby
    for (const [competitor] of this.competitors.entries()) {
      if (context.includes(competitor) && competitor !== brandLower) {
        // Competitor mentioned nearby - check if it's a comparison
        const comparisonWords = ["vs", "versus", "compared", "better", "worse", "than"];
        const isComparison = comparisonWords.some(word => context.includes(word));

        if (isComparison) {
          // It's a comparison - both brands are relevant
          return true;
        } else {
          // Competitor mentioned but not in comparison - might be confusion
          // Check brand-specific keywords
          const brandKeywords = this.brandKeywords.get(brandLower) || [];
          const hasBrandKeywords = brandKeywords.some(keyword => context.includes(keyword));

          if (hasBrandKeywords) {
            return true; // Brand keywords present, likely about brand
          } else {
            return false; // No brand keywords, might be about competitor
          }
        }
      }
    }

    // No competitor mentioned - assume it's about the brand
    return true;
  }

  /**
   * Filter out competitor mentions from results
   */
  filterCompetitors<T extends { text: string; brandName: string; position: { start: number; end: number } }>(
    mentions: T[]
  ): T[] {
    return mentions.filter(mention => {
      // Check if it's actually about the brand
      return this.isBrandMention(mention.text, mention.brandName, mention.position);
    });
  }

  /**
   * Get competitor mentioned in text
   */
  getCompetitor(text: string): CompetitorInfo | null {
    const lower = text.toLowerCase();

    for (const [competitor, info] of this.competitors.entries()) {
      if (lower.includes(competitor)) {
        return info;
      }

      // Check aliases
      if (info.aliases) {
        for (const alias of info.aliases) {
          if (lower.includes(alias.toLowerCase())) {
            return info;
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if text is a comparison between brand and competitor
   */
  isComparison(
    text: string,
    brandName: string
  ): { isComparison: boolean; competitor?: CompetitorInfo } {
    const competitor = this.getCompetitor(text);
    
    if (!competitor) {
      return { isComparison: false };
    }

    const lower = text.toLowerCase();
    const comparisonWords = ["vs", "versus", "compared", "better", "worse", "than", "versus"];

    const hasComparisonWord = comparisonWords.some(word => lower.includes(word));
    const hasBrand = lower.includes(brandName.toLowerCase());

    return {
      isComparison: hasComparisonWord && hasBrand,
      competitor,
    };
  }

  /**
   * Get all registered competitors
   */
  getCompetitors(): CompetitorInfo[] {
    return Array.from(this.competitors.values());
  }
}
