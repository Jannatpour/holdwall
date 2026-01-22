/**
 * Answer Engine Optimization (AEO)
 * 
 * Optimizes content specifically for AI answer engines (ChatGPT, Perplexity, Gemini)
 * to maximize citation likelihood and ensure accurate representation.
 */

export interface AEOOptimizationOptions {
  content: string;
  title: string;
  targetEngines?: Array<"chatgpt" | "perplexity" | "gemini" | "claude">;
  keywords?: string[];
  questions?: string[]; // Questions AI systems might ask
}

export interface AEOOptimizedContent {
  original: string;
  optimized: string;
  improvements: Array<{
    type: "structure" | "clarity" | "evidence" | "completeness";
    description: string;
    impact: "high" | "medium" | "low";
  }>;
  citationScore: number; // 0-1, predicted citation likelihood
}

export class AEOOptimizer {
  /**
   * Optimize content for AI answer engines
   */
  async optimize(
    options: AEOOptimizationOptions
  ): Promise<AEOOptimizedContent> {
    const { content, title, keywords = [], questions = [] } = options;

    let optimized = content;
    const improvements: AEOOptimizedContent["improvements"] = [];

    // 1. Ensure direct answer first (AI systems prefer direct answers)
    if (!this.hasDirectAnswer(optimized)) {
      optimized = this.addDirectAnswer(optimized, title);
      improvements.push({
        type: "structure",
        description: "Added direct answer at the beginning",
        impact: "high",
      });
    }

    // 2. Add FAQ section (AI systems frequently cite FAQ sections)
    if (!this.hasFAQ(optimized)) {
      optimized = this.addFAQ(optimized, questions);
      improvements.push({
        type: "structure",
        description: "Added FAQ section for better AI citation",
        impact: "high",
      });
    }

    // 3. Enhance evidence density
    const evidenceCount = this.countEvidence(optimized);
    if (evidenceCount < 3) {
      optimized = this.addEvidenceMarkers(optimized);
      improvements.push({
        type: "evidence",
        description: "Added evidence markers for credibility",
        impact: "medium",
      });
    }

    // 4. Improve clarity and completeness
    if (!this.isComplete(optimized)) {
      optimized = this.enhanceCompleteness(optimized, keywords);
      improvements.push({
        type: "completeness",
        description: "Enhanced content completeness",
        impact: "medium",
      });
    }

    // 5. Add structured data hints (for AI parsing)
    optimized = this.addStructuredHints(optimized);

    // Calculate citation score
    const citationScore = this.calculateCitationScore(optimized);

    return {
      original: content,
      optimized,
      improvements,
      citationScore,
    };
  }

  /**
   * Check if content has direct answer
   */
  private hasDirectAnswer(content: string): boolean {
    // Check if first paragraph directly answers the question
    const firstParagraph = content.split("\n\n")[0] || content.substring(0, 200);
    return firstParagraph.length < 150 && !firstParagraph.includes("?");
  }

  /**
   * Add direct answer at the beginning
   */
  private addDirectAnswer(content: string, title: string): string {
    // Extract key information to create direct answer
    const keyInfo = this.extractKeyInfo(content);
    const directAnswer = `${title} is ${keyInfo}. `;
    return directAnswer + content;
  }

  /**
   * Extract key information for direct answer
   */
  private extractKeyInfo(content: string): string {
    // Extract first sentence or key phrase
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences[0]?.trim() || "a platform for autonomous consensus control";
  }

  /**
   * Check if content has FAQ section
   */
  private hasFAQ(content: string): boolean {
    const lower = content.toLowerCase();
    return lower.includes("frequently asked") || 
      lower.includes("faq") ||
      (lower.includes("q:") && lower.includes("a:"));
  }

  /**
   * Add FAQ section
   */
  private addFAQ(content: string, questions: string[]): string {
    if (questions.length === 0) {
      // Generate common questions
      questions.push("What is this?");
      questions.push("How does it work?");
      questions.push("Why is it important?");
    }

    let faq = "\n\n## Frequently Asked Questions\n\n";
    
    for (const question of questions) {
      // Generate answer from content
      const answer = this.generateAnswer(content, question);
      faq += `**Q: ${question}**\n\nA: ${answer}\n\n`;
    }

    return content + faq;
  }

  /**
   * Generate answer from content for a question
   */
  private generateAnswer(content: string, question: string): string {
    // Simple extraction - in production, use AI to generate contextual answer
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences[0]?.trim() || "Please refer to the content above for details.";
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
   * Add evidence markers
   */
  private addEvidenceMarkers(content: string): string {
    // Add evidence markers to key claims
    const sentences = content.split(/[.!?]+/);
    const enhanced: string[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (sentence.length > 50 && this.isClaim(sentence)) {
        enhanced.push(sentence + " [Evidence available upon request]");
      } else {
        enhanced.push(sentence);
      }
    }

    return enhanced.join(". ") + ".";
  }

  /**
   * Check if sentence is a claim (needs evidence)
   */
  private isClaim(sentence: string): boolean {
    const claimIndicators = ["is", "are", "has", "have", "provides", "enables", "allows"];
    const lower = sentence.toLowerCase();
    return claimIndicators.some(indicator => lower.includes(indicator));
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
  private enhanceCompleteness(content: string, keywords: string[]): string {
    let enhanced = content;

    // Add keywords naturally if missing
    for (const keyword of keywords) {
      if (!enhanced.toLowerCase().includes(keyword.toLowerCase())) {
        // Add keyword in context
        enhanced += ` This relates to ${keyword}.`;
      }
    }

    // Ensure minimum length
    if (enhanced.length < 500) {
      enhanced += "\n\nFor more information, please refer to the official documentation.";
    }

    return enhanced;
  }

  /**
   * Add structured hints for AI parsing
   */
  private addStructuredHints(content: string): string {
    // Add semantic markers that AI systems recognize
    let enhanced = content;

    // Add definition if not present
    if (!enhanced.includes("Definition:") && !enhanced.includes("What is")) {
      const firstSentence = enhanced.split(/[.!?]+/)[0];
      if (firstSentence) {
        enhanced = `Definition: ${firstSentence}.\n\n${enhanced}`;
      }
    }

    // Add key points section
    if (!enhanced.includes("Key Points:") && !enhanced.includes("Summary:")) {
      const keyPoints = this.extractKeyPoints(enhanced);
      if (keyPoints.length > 0) {
        enhanced += `\n\nKey Points:\n${keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}`;
      }
    }

    return enhanced;
  }

  /**
   * Extract key points
   */
  private extractKeyPoints(content: string): string[] {
    // Extract sentences that start with important words
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 30);
    const keyPoints: string[] = [];

    const importantStarters = ["This", "It", "The system", "The platform", "Users"];
    
    for (const sentence of sentences.slice(0, 5)) {
      const trimmed = sentence.trim();
      if (importantStarters.some(starter => trimmed.startsWith(starter))) {
        keyPoints.push(trimmed);
      }
    }

    return keyPoints;
  }

  /**
   * Calculate citation score (0-1)
   */
  private calculateCitationScore(content: string): number {
    let score = 0.5; // Base score

    // Direct answer bonus
    if (this.hasDirectAnswer(content)) {
      score += 0.15;
    }

    // FAQ bonus
    if (this.hasFAQ(content)) {
      score += 0.15;
    }

    // Evidence bonus
    const evidenceCount = this.countEvidence(content);
    score += Math.min(0.1, evidenceCount * 0.02);

    // Completeness bonus
    if (this.isComplete(content)) {
      score += 0.1;
    }

    // Length bonus (optimal length for AI)
    const length = content.length;
    if (length >= 500 && length <= 2000) {
      score += 0.1;
    } else if (length < 500) {
      score -= 0.1;
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Generate questions AI systems might ask
   */
  generateQuestions(content: string, brandName: string): string[] {
    const questions: string[] = [
      `What is ${brandName}?`,
      `How does ${brandName} work?`,
      `Why use ${brandName}?`,
      `Is ${brandName} legitimate?`,
      `What are ${brandName} features?`,
    ];

    // Extract additional questions from content
    const questionMatches = content.match(/[^.!?]*\?[^.!?]*/g);
    if (questionMatches) {
      questions.push(...questionMatches.slice(0, 3).map(q => q.trim()));
    }

    return [...new Set(questions)];
  }
}
