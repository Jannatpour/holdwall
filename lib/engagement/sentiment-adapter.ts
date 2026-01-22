/**
 * Sentiment Adapter
 * 
 * Adapts response tone based on detected sentiment to ensure
 * appropriate and effective communication.
 */

import { ResponseGenerator } from "./response-generator";

export interface SentimentAnalysis {
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  confidence: number; // 0-1
  emotions?: string[]; // anger, joy, trust, etc.
  intensity: "low" | "medium" | "high";
}

export interface AdaptedResponse {
  original: string;
  adapted: string;
  sentiment: SentimentAnalysis;
  tone: string;
  changes: Array<{
    type: "tone" | "length" | "evidence" | "apology";
    description: string;
  }>;
}

export class SentimentAdapter {
  private responseGenerator: ResponseGenerator;

  constructor() {
    this.responseGenerator = new ResponseGenerator();
  }

  /**
   * Analyze sentiment of text
   */
  analyzeSentiment(text: string): SentimentAnalysis {
    const lower = text.toLowerCase();
    
    // Positive indicators
    const positiveWords = [
      "good", "great", "excellent", "amazing", "wonderful", "best", "love",
      "recommend", "satisfied", "happy", "pleased", "outstanding", "fantastic",
    ];

    // Negative indicators
    const negativeWords = [
      "bad", "terrible", "awful", "worst", "hate", "disappointed", "frustrated",
      "scam", "fraud", "problem", "issue", "complaint", "refund", "sue", "lawsuit",
      "angry", "upset", "furious", "outraged",
    ];

    const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lower.includes(w)).length;

    // Determine sentiment
    let sentiment: SentimentAnalysis["sentiment"];
    let confidence: number;
    let intensity: SentimentAnalysis["intensity"];

    if (positiveCount > negativeCount && positiveCount > 0) {
      sentiment = "positive";
      confidence = Math.min(0.9, 0.5 + positiveCount * 0.1);
      intensity = positiveCount > 3 ? "high" : positiveCount > 1 ? "medium" : "low";
    } else if (negativeCount > positiveCount && negativeCount > 0) {
      sentiment = "negative";
      confidence = Math.min(0.9, 0.5 + negativeCount * 0.1);
      intensity = negativeCount > 3 ? "high" : negativeCount > 1 ? "medium" : "low";
    } else if (positiveCount > 0 && negativeCount > 0) {
      sentiment = "mixed";
      confidence = 0.7;
      intensity = "medium";
    } else {
      sentiment = "neutral";
      confidence = 0.6;
      intensity = "low";
    }

    // Detect specific emotions
    const emotions: string[] = [];
    if (lower.includes("angry") || lower.includes("furious") || lower.includes("outraged")) {
      emotions.push("anger");
    }
    if (lower.includes("happy") || lower.includes("joy") || lower.includes("excited")) {
      emotions.push("joy");
    }
    if (lower.includes("trust") || lower.includes("confident") || lower.includes("reliable")) {
      emotions.push("trust");
    }
    if (lower.includes("fear") || lower.includes("worried") || lower.includes("concerned")) {
      emotions.push("fear");
    }

    return {
      sentiment,
      confidence,
      emotions,
      intensity,
    };
  }

  /**
   * Adapt response based on sentiment
   */
  async adaptResponse(
    originalResponse: string,
    contextSentiment: SentimentAnalysis
  ): Promise<AdaptedResponse> {
    let adapted = originalResponse;
    const changes: AdaptedResponse["changes"] = [];

    // Adapt based on sentiment
    switch (contextSentiment.sentiment) {
      case "negative":
        if (contextSentiment.intensity === "high") {
          // High negative - add apology and empathy
          if (!adapted.toLowerCase().includes("sorry") && !adapted.toLowerCase().includes("apologize")) {
            adapted = `We understand your frustration and apologize for any inconvenience. ${adapted}`;
            changes.push({
              type: "apology",
              description: "Added apology for high negative sentiment",
            });
          }

          // Increase evidence
          if (!adapted.includes("[Evidence]") && !adapted.includes("verified")) {
            adapted += " [Verified information]";
            changes.push({
              type: "evidence",
              description: "Added evidence markers for credibility",
            });
          }
        } else {
          // Medium negative - acknowledge concern
          if (!adapted.toLowerCase().includes("understand") && !adapted.toLowerCase().includes("appreciate")) {
            adapted = `We appreciate your feedback and want to address your concerns. ${adapted}`;
            changes.push({
              type: "tone",
              description: "Added acknowledgment for negative sentiment",
            });
          }
        }
        break;

      case "positive":
        // Positive sentiment - match enthusiasm
        if (contextSentiment.intensity === "high") {
          adapted = adapted.replace(/thank you/gi, "Thank you so much");
          changes.push({
            type: "tone",
            description: "Enhanced positive tone",
          });
        }
        break;

      case "mixed":
        // Mixed sentiment - be balanced
        if (!adapted.toLowerCase().includes("understand")) {
          adapted = `We understand there are different perspectives. ${adapted}`;
          changes.push({
            type: "tone",
            description: "Added balanced acknowledgment",
          });
        }
        break;

      case "neutral":
        // Neutral - keep professional
        // No changes needed
        break;
    }

    // Adapt length based on intensity
    if (contextSentiment.intensity === "high" && adapted.length < 200) {
      // High intensity needs more detail
      adapted += " Please let us know if you need any additional information or clarification.";
      changes.push({
        type: "length",
        description: "Extended response for high intensity",
      });
    }

    // Determine final tone
    let tone = "professional";
    if (contextSentiment.sentiment === "negative" && contextSentiment.intensity === "high") {
      tone = "empathetic";
    } else if (contextSentiment.sentiment === "positive") {
      tone = "appreciative";
    }

    return {
      original: originalResponse,
      adapted,
      sentiment: contextSentiment,
      tone,
      changes,
    };
  }

  /**
   * Generate and adapt response in one step
   */
  async generateAndAdapt(
    context: string,
    options: {
      intent?: "inform" | "correct" | "engage" | "defend";
      includeEvidence?: boolean;
    } = {}
  ): Promise<AdaptedResponse> {
    // Analyze sentiment first
    const sentiment = this.analyzeSentiment(context);

    // Determine tone based on sentiment
    let tone: "helpful" | "professional" | "friendly" | "neutral" = "professional";
    if (sentiment.sentiment === "negative" && sentiment.intensity === "high") {
      tone = "professional"; // More careful with negative
    } else if (sentiment.sentiment === "positive") {
      tone = "friendly";
    }

    // Generate response
    const generated = await this.responseGenerator.generate({
      context,
      intent: options.intent || (sentiment.sentiment === "negative" ? "defend" : "inform"),
      tone,
      includeEvidence: options.includeEvidence !== false,
    });

    // Adapt based on sentiment
    return await this.adaptResponse(generated.response, sentiment);
  }
}
