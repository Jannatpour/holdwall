/**
 * Context Analyzer
 * 
 * Analyzes context around brand mentions to understand sentiment, intent,
 * and determine if mention is relevant or just coincidental.
 */

export interface MentionContext {
  text: string;
  brandName: string;
  position: {
    start: number;
    end: number;
  };
  context: {
    before: string;
    after: string;
    full: string;
  };
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  intent: "purchase" | "complaint" | "question" | "review" | "news" | "other";
  relevance: number; // 0-1
  keywords: string[];
}

export class ContextAnalyzer {
  // Sentiment indicators
  private positiveWords = [
    "good", "great", "excellent", "amazing", "wonderful", "best", "love", "perfect",
    "recommend", "satisfied", "happy", "pleased", "outstanding", "fantastic",
  ];

  private negativeWords = [
    "bad", "terrible", "awful", "worst", "hate", "disappointed", "frustrated",
    "scam", "fraud", "problem", "issue", "complaint", "refund", "sue", "lawsuit",
  ];

  // Intent indicators
  private purchaseIndicators = [
    "buy", "purchase", "order", "checkout", "cart", "price", "cost", "discount",
    "deal", "sale", "shipping", "delivery",
  ];

  private complaintIndicators = [
    "complaint", "refund", "return", "broken", "defective", "wrong", "error",
    "mistake", "sue", "lawsuit", "legal", "lawyer",
  ];

  private questionIndicators = [
    "what", "how", "why", "when", "where", "who", "?", "help", "question",
    "wondering", "curious", "ask",
  ];

  private reviewIndicators = [
    "review", "rating", "stars", "experience", "opinion", "thoughts", "feedback",
    "testimonial", "recommendation",
  ];

  private newsIndicators = [
    "announced", "reported", "news", "according", "sources", "breaking",
    "update", "latest", "recently",
  ];

  /**
   * Analyze context around a brand mention
   */
  analyzeContext(
    text: string,
    brandName: string,
    position: { start: number; end: number },
    contextWindow: number = 100
  ): MentionContext {
    // Extract context
    const before = text.substring(Math.max(0, position.start - contextWindow), position.start);
    const after = text.substring(position.end, Math.min(text.length, position.end + contextWindow));
    const full = before + text.substring(position.start, position.end) + after;

    // Analyze sentiment
    const sentiment = this.analyzeSentiment(full);

    // Analyze intent
    const intent = this.analyzeIntent(full);

    // Calculate relevance
    const relevance = this.calculateRelevance(full, brandName);

    // Extract keywords
    const keywords = this.extractKeywords(full);

    return {
      text: text.substring(position.start, position.end),
      brandName,
      position,
      context: {
        before: before.trim(),
        after: after.trim(),
        full: full.trim(),
      },
      sentiment,
      intent,
      relevance,
      keywords,
    };
  }

  /**
   * Analyze sentiment of text
   */
  private analyzeSentiment(text: string): MentionContext["sentiment"] {
    const lower = text.toLowerCase();
    
    const positiveCount = this.positiveWords.filter(word => lower.includes(word)).length;
    const negativeCount = this.negativeWords.filter(word => lower.includes(word)).length;

    if (positiveCount > negativeCount && positiveCount > 0) {
      return "positive";
    } else if (negativeCount > positiveCount && negativeCount > 0) {
      return "negative";
    } else if (positiveCount > 0 && negativeCount > 0) {
      return "mixed";
    } else {
      return "neutral";
    }
  }

  /**
   * Analyze intent of text
   */
  private analyzeIntent(text: string): MentionContext["intent"] {
    const lower = text.toLowerCase();

    // Check for purchase intent
    if (this.purchaseIndicators.some(indicator => lower.includes(indicator))) {
      return "purchase";
    }

    // Check for complaint intent
    if (this.complaintIndicators.some(indicator => lower.includes(indicator))) {
      return "complaint";
    }

    // Check for question intent
    if (this.questionIndicators.some(indicator => lower.includes(indicator))) {
      return "question";
    }

    // Check for review intent
    if (this.reviewIndicators.some(indicator => lower.includes(indicator))) {
      return "review";
    }

    // Check for news intent
    if (this.newsIndicators.some(indicator => lower.includes(indicator))) {
      return "news";
    }

    return "other";
  }

  /**
   * Calculate relevance score (0-1)
   */
  private calculateRelevance(text: string, brandName: string): number {
    let score = 0.5; // Base relevance

    const lower = text.toLowerCase();
    const brandLower = brandName.toLowerCase();

    // Increase score if brand appears multiple times
    const brandOccurrences = (lower.match(new RegExp(brandLower, "g")) || []).length;
    score += Math.min(0.2, brandOccurrences * 0.05);

    // Increase score if brand is mentioned with action verbs
    const actionVerbs = ["uses", "uses", "chooses", "prefers", "recommends", "buys"];
    if (actionVerbs.some(verb => lower.includes(`${verb} ${brandLower}`))) {
      score += 0.15;
    }

    // Increase score if brand is the subject
    if (lower.startsWith(brandLower) || lower.includes(`the ${brandLower}`)) {
      score += 0.1;
    }

    // Decrease score if brand appears in a list (less relevant)
    if (lower.includes(`${brandLower},`) || lower.includes(`, ${brandLower}`)) {
      score -= 0.1;
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Extract keywords from context
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction (in production, use NLP library)
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 3); // Filter short words

    // Count frequencies
    const frequencies = new Map<string, number>();
    for (const word of words) {
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    }

    // Get top keywords
    const sorted = Array.from(frequencies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    return sorted;
  }

  /**
   * Check if mention is relevant (not just coincidental)
   */
  isRelevant(context: MentionContext, minRelevance: number = 0.5): boolean {
    return context.relevance >= minRelevance;
  }

  /**
   * Check if mention requires response
   */
  requiresResponse(context: MentionContext): boolean {
    // Require response for complaints, questions, or high-relevance mentions
    return (
      context.intent === "complaint" ||
      context.intent === "question" ||
      (context.relevance > 0.7 && context.sentiment !== "neutral")
    );
  }

  /**
   * Get priority level for mention
   */
  getPriority(context: MentionContext): "high" | "medium" | "low" {
    if (context.intent === "complaint" || context.sentiment === "negative") {
      return "high";
    } else if (context.relevance > 0.7 || context.intent === "question") {
      return "medium";
    } else {
      return "low";
    }
  }
}
