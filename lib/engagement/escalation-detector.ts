/**
 * Escalation Detector
 * 
 * Automatically detects when human intervention is needed
 * based on conversation context and risk factors.
 */

import { ConversationContext } from "./context-understander";

export interface EscalationCriteria {
  sentiment: "negative" | "very_negative";
  intent: "complaint" | "legal_threat";
  keywords: string[];
  messageCount: number;
  duration: number; // minutes
}

export interface EscalationDecision {
  shouldEscalate: boolean;
  reason: string;
  priority: "low" | "medium" | "high" | "critical";
  suggestedAction: string;
}

export class EscalationDetector {
  private escalationKeywords = [
    "lawsuit", "sue", "legal", "lawyer", "attorney",
    "refund", "chargeback", "fraud", "scam",
    "regulatory", "complaint", "filing",
  ];

  /**
   * Check if escalation is needed
   */
  shouldEscalate(
    context: ConversationContext,
    messageCount: number,
    durationMinutes: number
  ): EscalationDecision {
    const criteria: EscalationCriteria = {
      sentiment: context.sentiment === "negative" ? "negative" : "very_negative",
      intent: context.intent === "complaint" ? "complaint" : "other" as any,
      keywords: this.extractEscalationKeywords(context.messages.map(m => m.content).join(" ")),
      messageCount,
      duration: durationMinutes,
    };

    // Check escalation conditions
    let shouldEscalate = false;
    let priority: EscalationDecision["priority"] = "low";
    const reasons: string[] = [];

    // High negative sentiment
    if (context.sentiment === "negative" || context.sentiment === "mixed") {
      shouldEscalate = true;
      priority = "medium";
      reasons.push("Negative sentiment detected");
    }

    // Legal keywords
    if (criteria.keywords.length > 0) {
      shouldEscalate = true;
      priority = "high";
      reasons.push(`Legal keywords detected: ${criteria.keywords.join(", ")}`);
    }

    // Complaint intent
    if (context.intent === "complaint") {
      shouldEscalate = true;
      if (priority === "low") {
        priority = "medium";
      }
      reasons.push("Complaint intent detected");
    }

    // Long conversation
    if (messageCount > 10) {
      shouldEscalate = true;
      if (priority === "low") {
        priority = "medium";
      }
      reasons.push("Extended conversation - may need human review");
    }

    // Determine suggested action
    let suggestedAction: string;
    if (priority === "high") {
      suggestedAction = "Immediate human review required";
    } else if (priority === "medium") {
      suggestedAction = "Route to support team for review";
    } else {
      suggestedAction = "Monitor conversation";
    }

    return {
      shouldEscalate,
      reason: reasons.join("; "),
      priority,
      suggestedAction,
    };
  }

  /**
   * Extract escalation keywords
   */
  private extractEscalationKeywords(text: string): string[] {
    const lower = text.toLowerCase();
    return this.escalationKeywords.filter(keyword => lower.includes(keyword));
  }

  /**
   * Check for critical escalation
   */
  isCritical(context: ConversationContext): boolean {
    const text = context.messages.map(m => m.content).join(" ").toLowerCase();
    
    const criticalKeywords = ["lawsuit", "sue", "fraud", "scam", "regulatory"];
    return criticalKeywords.some(keyword => text.includes(keyword));
  }
}
