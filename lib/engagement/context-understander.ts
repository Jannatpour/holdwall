/**
 * Context Understander
 * 
 * Understands conversation context before responding to ensure
 * appropriate and effective communication.
 */

export interface ConversationContext {
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
  }>;
  intent: "question" | "complaint" | "praise" | "comparison" | "other";
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  topics: string[];
  requiresResponse: boolean;
}

export class ContextUnderstander {
  /**
   * Understand context from conversation
   */
  understand(messages: Array<{ role: string; content: string; timestamp?: string }>): ConversationContext {
    if (messages.length === 0) {
      throw new Error("No messages provided");
    }

    const lastMessage = messages[messages.length - 1].content;

    // Detect intent
    const intent = this.detectIntent(lastMessage);

    // Detect sentiment
    const sentiment = this.detectSentiment(lastMessage);

    // Extract topics
    const topics = this.extractTopics(messages.map(m => m.content).join(" "));

    // Determine if response is needed
    const requiresResponse = this.requiresResponse(messages, intent, sentiment);

    return {
      messages: messages.map(m => ({
        role: m.role as any,
        content: m.content,
        timestamp: m.timestamp || new Date().toISOString(),
      })),
      intent,
      sentiment,
      topics,
      requiresResponse,
    };
  }

  /**
   * Detect intent
   */
  private detectIntent(text: string): ConversationContext["intent"] {
    const lower = text.toLowerCase();

    if (lower.includes("?") || lower.includes("how") || lower.includes("what") || lower.includes("why")) {
      return "question";
    } else if (lower.includes("complaint") || lower.includes("problem") || lower.includes("issue")) {
      return "complaint";
    } else if (lower.includes("great") || lower.includes("love") || lower.includes("excellent")) {
      return "praise";
    } else if (lower.includes("vs") || lower.includes("versus") || lower.includes("compared")) {
      return "comparison";
    } else {
      return "other";
    }
  }

  /**
   * Detect sentiment
   */
  private detectSentiment(text: string): ConversationContext["sentiment"] {
    const lower = text.toLowerCase();
    
    const positiveWords = ["good", "great", "excellent", "amazing", "love"];
    const negativeWords = ["bad", "terrible", "awful", "hate", "problem"];

    const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lower.includes(w)).length;

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
   * Extract topics
   */
  private extractTopics(text: string): string[] {
    // Simple extraction (in production, use NLP)
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4);

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
   * Determine if response is required
   */
  private requiresResponse(
    messages: Array<{ role: string; content: string }>,
    intent: ConversationContext["intent"],
    sentiment: ConversationContext["sentiment"]
  ): boolean {
    // Questions always need response
    if (intent === "question") {
      return true;
    }

    // Complaints need response
    if (intent === "complaint" || sentiment === "negative") {
      return true;
    }

    // Last message is from user (not assistant)
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "user") {
      return true;
    }

    return false;
  }

  /**
   * Get response strategy based on context
   */
  getResponseStrategy(context: ConversationContext): {
    tone: string;
    length: "short" | "medium" | "long";
    includeEvidence: boolean;
    urgency: "low" | "medium" | "high";
  } {
    let tone = "professional";
    let length: "short" | "medium" | "long" = "medium";
    let includeEvidence = false;
    let urgency: "low" | "medium" | "high" = "medium";

    // Adjust based on sentiment
    if (context.sentiment === "negative") {
      tone = "empathetic";
      includeEvidence = true;
      urgency = "high";
      length = "medium";
    } else if (context.sentiment === "positive") {
      tone = "appreciative";
      length = "short";
      urgency = "low";
    }

    // Adjust based on intent
    if (context.intent === "question") {
      length = "medium";
      includeEvidence = true;
    } else if (context.intent === "complaint") {
      urgency = "high";
      includeEvidence = true;
      length = "medium";
    }

    return {
      tone,
      length,
      includeEvidence,
      urgency,
    };
  }
}
