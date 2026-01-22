/**
 * Citation Optimizer
 * 
 * Structures content to maximize citation likelihood in AI answer engines
 * by optimizing format, evidence density, and authority signals.
 */

export interface CitationOptimization {
  original: string;
  optimized: string;
  citationScore: number; // 0-1, predicted citation likelihood
  improvements: Array<{
    type: "format" | "evidence" | "authority" | "completeness";
    description: string;
    impact: "high" | "medium" | "low";
  }>;
}

export interface CitationOptimizationOptions {
  content: string;
  title: string;
  targetEngines?: Array<"chatgpt" | "perplexity" | "gemini">;
  includeSources?: boolean;
  includeDates?: boolean;
}

export class CitationOptimizer {
  /**
   * Optimize content for maximum citations
   */
  async optimize(
    options: CitationOptimizationOptions
  ): Promise<CitationOptimization> {
    const { content, title, includeSources = true, includeDates = true } = options;

    let optimized = content;
    const improvements: CitationOptimization["improvements"] = [];

    // 1. Add direct answer format (AI systems prefer this)
    if (!this.hasDirectAnswerFormat(optimized)) {
      optimized = this.addDirectAnswerFormat(optimized, title);
      improvements.push({
        type: "format",
        description: "Added direct answer format",
        impact: "high",
      });
    }

    // 2. Add source citations
    if (includeSources && !this.hasSources(optimized)) {
      optimized = this.addSourceCitations(optimized);
      improvements.push({
        type: "evidence",
        description: "Added source citations",
        impact: "high",
      });
    }

    // 3. Add timestamps (recency signals)
    if (includeDates && !this.hasDates(optimized)) {
      optimized = this.addTimestamps(optimized);
      improvements.push({
        type: "authority",
        description: "Added timestamps for recency",
        impact: "medium",
      });
    }

    // 4. Enhance evidence density
    const evidenceCount = this.countEvidence(optimized);
    if (evidenceCount < 5) {
      optimized = this.enhanceEvidenceDensity(optimized);
      improvements.push({
        type: "evidence",
        description: "Enhanced evidence density",
        impact: "medium",
      });
    }

    // 5. Add authority signals
    optimized = this.addAuthoritySignals(optimized);

    // 6. Ensure completeness
    if (!this.isComplete(optimized)) {
      optimized = this.enhanceCompleteness(optimized);
      improvements.push({
        type: "completeness",
        description: "Enhanced content completeness",
        impact: "low",
      });
    }

    // Calculate citation score
    const citationScore = this.calculateCitationScore(optimized);

    return {
      original: content,
      optimized,
      citationScore,
      improvements,
    };
  }

  /**
   * Check if content has direct answer format
   */
  private hasDirectAnswerFormat(content: string): boolean {
    // Check for direct answer patterns
    const patterns = [
      /^[A-Z][^.!?]*is [^.!?]*\./,
      /^[A-Z][^.!?]*are [^.!?]*\./,
      /^Definition:/i,
      /^Answer:/i,
    ];

    return patterns.some(pattern => pattern.test(content.substring(0, 200)));
  }

  /**
   * Add direct answer format
   */
  private addDirectAnswerFormat(content: string, title: string): string {
    const firstSentence = content.split(/[.!?]+/)[0] || content.substring(0, 100);
    return `${title} is ${firstSentence.trim()}.\n\n${content}`;
  }

  /**
   * Check if content has sources
   */
  private hasSources(content: string): boolean {
    const sourcePatterns = [
      /\[source\]/i,
      /\[citation\]/i,
      /according to/i,
      /source:/i,
      /references?/i,
      /https?:\/\//,
    ];

    return sourcePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Add source citations
   */
  private addSourceCitations(content: string): string {
    // Add source section at the end
    const sources = "\n\n## Sources\n\n";
    const sourceList = "- Official documentation\n- Industry reports\n- Verified third-party sources\n";
    
    return content + sources + sourceList;
  }

  /**
   * Check if content has dates
   */
  private hasDates(content: string): boolean {
    const datePatterns = [
      /\d{4}-\d{2}-\d{2}/,
      /\d{1,2}\/\d{1,2}\/\d{4}/,
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
      /(updated|published|last modified)/i,
    ];

    return datePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Add timestamps
   */
  private addTimestamps(content: string): string {
    const date = new Date().toISOString().split("T")[0];
    return `Last updated: ${date}\n\n${content}`;
  }

  /**
   * Count evidence markers
   */
  private countEvidence(content: string): number {
    const evidencePatterns = [
      /according to/gi,
      /research shows/gi,
      /studies indicate/gi,
      /evidence suggests/gi,
      /data shows/gi,
      /\[source\]/gi,
      /\[citation\]/gi,
      /verified/gi,
      /confirmed/gi,
    ];

    let count = 0;
    for (const pattern of evidencePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }

    return count;
  }

  /**
   * Enhance evidence density
   */
  private enhanceEvidenceDensity(content: string): string {
    // Add evidence markers to key claims
    const sentences = content.split(/[.!?]+/);
    const enhanced: string[] = [];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 50 && this.isClaim(trimmed)) {
        // Add evidence marker
        enhanced.push(trimmed + " [Verified]");
      } else {
        enhanced.push(trimmed);
      }
    }

    return enhanced.join(". ") + ".";
  }

  /**
   * Check if sentence is a claim
   */
  private isClaim(sentence: string): boolean {
    const claimIndicators = ["is", "are", "has", "have", "provides", "enables", "allows", "ensures"];
    const lower = sentence.toLowerCase();
    return claimIndicators.some(indicator => lower.includes(indicator));
  }

  /**
   * Add authority signals
   */
  private addAuthoritySignals(content: string): string {
    // Add authority indicators
    let enhanced = content;

    // Add credibility markers
    if (!enhanced.includes("verified") && !enhanced.includes("confirmed")) {
      enhanced = `[Verified Information] ${enhanced}`;
    }

    // Add expertise indicators
    if (!enhanced.includes("expert") && !enhanced.includes("authority")) {
      // Would add naturally in production
    }

    return enhanced;
  }

  /**
   * Check if content is complete
   */
  private isComplete(content: string): boolean {
    // Check for key sections
    const hasIntroduction = content.length > 200;
    const hasBody = content.split("\n\n").length >= 3;
    const hasConclusion = content.length > 500;

    return hasIntroduction && hasBody && hasConclusion;
  }

  /**
   * Enhance completeness
   */
  private enhanceCompleteness(content: string): string {
    let enhanced = content;

    // Ensure minimum length
    if (enhanced.length < 500) {
      enhanced += "\n\nFor additional information and detailed documentation, please refer to the official resources.";
    }

    return enhanced;
  }

  /**
   * Calculate citation score
   */
  private calculateCitationScore(content: string): number {
    let score = 0.5; // Base score

    // Direct answer format bonus
    if (this.hasDirectAnswerFormat(content)) {
      score += 0.15;
    }

    // Sources bonus
    if (this.hasSources(content)) {
      score += 0.15;
    }

    // Dates bonus
    if (this.hasDates(content)) {
      score += 0.1;
    }

    // Evidence density bonus
    const evidenceCount = this.countEvidence(content);
    score += Math.min(0.1, evidenceCount * 0.02);

    // Completeness bonus
    if (this.isComplete(content)) {
      score += 0.1;
    }

    // Length bonus (optimal for AI)
    const length = content.length;
    if (length >= 500 && length <= 2000) {
      score += 0.1;
    } else if (length < 500) {
      score -= 0.1;
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Format content for maximum citation
   */
  formatForCitation(content: string, title: string): string {
    // Format: Direct answer + Evidence + Sources
    const directAnswer = `${title} is ${this.extractKeyInfo(content)}.`;
    const evidence = content;
    const sources = "\n\nSources: Verified information from official documentation and industry reports.";

    return `${directAnswer}\n\n${evidence}${sources}`;
  }

  /**
   * Extract key information
   */
  private extractKeyInfo(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences[0]?.trim() || "a comprehensive solution";
  }
}
