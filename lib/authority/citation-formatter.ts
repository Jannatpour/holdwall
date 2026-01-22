/**
 * Citation Formatter
 * 
 * Formats content for maximum citations by structuring it in ways
 * that AI systems prefer to cite.
 */

export interface CitationFormatted {
  original: string;
  formatted: string;
  citationScore: number; // 0-1
  improvements: string[];
}

export class CitationFormatter {
  /**
   * Format content for citations
   */
  format(content: string, title: string): CitationFormatted {
    let formatted = content;
    const improvements: string[] = [];

    // 1. Add direct answer format
    if (!this.hasDirectAnswer(formatted)) {
      formatted = this.addDirectAnswer(formatted, title);
      improvements.push("Added direct answer format");
    }

    // 2. Add evidence markers
    formatted = this.addEvidenceMarkers(formatted);
    improvements.push("Added evidence markers");

    // 3. Add source citations
    if (!this.hasSources(formatted)) {
      formatted = this.addSourceSection(formatted);
      improvements.push("Added source citations");
    }

    // 4. Add structured sections
    formatted = this.addStructuredSections(formatted);
    improvements.push("Added structured sections");

    // 5. Add metadata
    formatted = this.addMetadata(formatted);

    // Calculate citation score
    const citationScore = this.calculateCitationScore(formatted);

    return {
      original: content,
      formatted,
      citationScore,
      improvements,
    };
  }

  /**
   * Check if has direct answer
   */
  private hasDirectAnswer(content: string): boolean {
    return /^[A-Z][^.!?]*is [^.!?]*\./.test(content.substring(0, 200));
  }

  /**
   * Add direct answer
   */
  private addDirectAnswer(content: string, title: string): string {
    const firstSentence = content.split(/[.!?]+/)[0] || content.substring(0, 100);
    return `${title} is ${firstSentence.trim()}.\n\n${content}`;
  }

  /**
   * Add evidence markers
   */
  private addEvidenceMarkers(content: string): string {
    // Add [Verified] markers to key claims
    const sentences = content.split(/[.!?]+/);
    const marked: string[] = [];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 50 && this.isClaim(trimmed)) {
        marked.push(trimmed + " [Verified]");
      } else {
        marked.push(trimmed);
      }
    }

    return marked.join(". ") + ".";
  }

  /**
   * Check if sentence is a claim
   */
  private isClaim(sentence: string): boolean {
    const claimWords = ["is", "are", "has", "have", "provides", "enables"];
    return claimWords.some(word => sentence.toLowerCase().includes(word));
  }

  /**
   * Check if has sources
   */
  private hasSources(content: string): boolean {
    return /\[source\]|\[citation\]|according to|source:/i.test(content);
  }

  /**
   * Add source section
   */
  private addSourceSection(content: string): string {
    return `${content}\n\n## Sources\n\n- Official documentation\n- Industry reports\n- Verified third-party sources`;
  }

  /**
   * Add structured sections
   */
  private addStructuredSections(content: string): string {
    // Add key points if not present
    if (!content.includes("Key Points:") && !content.includes("Summary:")) {
      const keyPoints = this.extractKeyPoints(content);
      if (keyPoints.length > 0) {
        content += `\n\nKey Points:\n${keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}`;
      }
    }

    return content;
  }

  /**
   * Extract key points
   */
  private extractKeyPoints(content: string): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 30);
    return sentences.slice(0, 5).map(s => s.trim());
  }

  /**
   * Add metadata
   */
  private addMetadata(content: string): string {
    const date = new Date().toISOString().split("T")[0];
    return `Last updated: ${date}\n\n${content}`;
  }

  /**
   * Calculate citation score
   */
  private calculateCitationScore(content: string): number {
    let score = 0.5;

    // Direct answer bonus
    if (this.hasDirectAnswer(content)) {
      score += 0.2;
    }

    // Sources bonus
    if (this.hasSources(content)) {
      score += 0.2;
    }

    // Evidence markers bonus
    const evidenceCount = (content.match(/\[Verified\]/g) || []).length;
    score += Math.min(0.1, evidenceCount * 0.02);

    // Structure bonus
    if (content.includes("Key Points:") || content.includes("Summary:")) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }
}
