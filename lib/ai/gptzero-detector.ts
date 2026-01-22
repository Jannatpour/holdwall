/**
 * GPTZero Hallucination Detection
 * 
 * Identifies fabricated citations in academic/research contexts
 * and detects AI-generated content that may be unreliable.
 */

export interface HallucinationDetection {
  text: string;
  isHallucinated: boolean;
  confidence: number; // 0-1
  indicators: Array<{
    type: "citation" | "fact" | "statistic" | "quote";
    issue: string;
    severity: "low" | "medium" | "high";
  }>;
  recommendations: string[];
}

export class GPTZeroDetector {
  private openaiApiKey: string | null = null;

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || null;
  }

  /**
   * Detect hallucinations
   */
  async detect(text: string, citations?: string[]): Promise<HallucinationDetection> {
    const indicators: HallucinationDetection["indicators"] = [];

    // Check for fabricated citations
    if (citations && citations.length > 0) {
      const citationIssues = await this.checkCitations(text, citations);
      indicators.push(...citationIssues);
    }

    // Check for fabricated facts
    const factIssues = await this.checkFacts(text);
    indicators.push(...factIssues);

    // Check for fabricated statistics
    const statIssues = this.checkStatistics(text);
    indicators.push(...statIssues);

    // Determine if hallucinated
    const highSeverity = indicators.filter(i => i.severity === "high").length;
    const isHallucinated = highSeverity > 0 || indicators.length >= 3;

    // Calculate confidence
    const confidence = this.calculateConfidence(indicators);

    // Generate recommendations
    const recommendations = this.generateRecommendations(indicators);

    return {
      text,
      isHallucinated,
      confidence,
      indicators,
      recommendations,
    };
  }

  /**
   * Check citations for fabrication
   */
  private async checkCitations(
    text: string,
    citations: string[]
  ): Promise<HallucinationDetection["indicators"]> {
    const indicators: HallucinationDetection["indicators"] = [];

    // Check if citations are actually mentioned in text
    for (const citation of citations) {
      if (!text.includes(citation) && !text.includes(`[${citation}]`)) {
        indicators.push({
          type: "citation",
          issue: `Citation ${citation} mentioned but not present in text`,
          severity: "high",
        });
      }
    }

    // Check for citation patterns that look fabricated
    const citationPattern = /\[(\d+)\]/g;
    const matches = text.match(citationPattern);
    if (matches) {
      const citationNumbers = matches.map(m => parseInt(m.replace(/[\[\]]/g, "")));
      const maxCitation = Math.max(...citationNumbers);
      if (maxCitation > citations.length) {
        indicators.push({
          type: "citation",
          issue: `Citation [${maxCitation}] referenced but only ${citations.length} citations provided`,
          severity: "high",
        });
      }
    }

    return indicators;
  }

  /**
   * Check facts for fabrication
   */
  private async checkFacts(text: string): Promise<HallucinationDetection["indicators"]> {
    const indicators: HallucinationDetection["indicators"] = [];

    // Look for specific factual claims
    const factPatterns = [
      /(\d+)% of/gi,
      /studies show/gi,
      /research indicates/gi,
      /according to research/gi,
    ];

    for (const pattern of factPatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 2) {
        indicators.push({
          type: "fact",
          issue: "Multiple unsourced factual claims detected",
          severity: "medium",
        });
      }
    }

    return indicators;
  }

  /**
   * Check statistics
   */
  private checkStatistics(text: string): HallucinationDetection["indicators"] {
    const indicators: HallucinationDetection["indicators"] = [];

    // Look for statistics without sources
    const statPattern = /(\d+(?:\.\d+)?)%/g;
    const stats = text.match(statPattern);

    if (stats && stats.length > 3) {
      // Check if sources are mentioned
      const hasSources = /source|study|research|according/i.test(text);
      if (!hasSources) {
        indicators.push({
          type: "statistic",
          issue: "Multiple statistics without clear sources",
          severity: "medium",
        });
      }
    }

    return indicators;
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(indicators: HallucinationDetection["indicators"]): number {
    if (indicators.length === 0) {
      return 0.9; // High confidence if no issues
    }

    let confidence = 0.5;

    // Reduce confidence based on severity
    for (const indicator of indicators) {
      switch (indicator.severity) {
        case "high":
          confidence -= 0.2;
          break;
        case "medium":
          confidence -= 0.1;
          break;
        case "low":
          confidence -= 0.05;
          break;
      }
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(indicators: HallucinationDetection["indicators"]): string[] {
    const recommendations: string[] = [];

    const citationIssues = indicators.filter(i => i.type === "citation");
    if (citationIssues.length > 0) {
      recommendations.push("Review and verify all citations");
    }

    const factIssues = indicators.filter(i => i.type === "fact");
    if (factIssues.length > 0) {
      recommendations.push("Add sources for factual claims");
    }

    const statIssues = indicators.filter(i => i.type === "statistic");
    if (statIssues.length > 0) {
      recommendations.push("Provide sources for statistics");
    }

    return recommendations;
  }
}
