/**
 * Escalation Checker
 * 
 * Detects language that could escalate a narrative situation.
 */

import { logger } from "@/lib/logging/logger";

export interface EscalationResult {
  passed: boolean;
  escalation_risk: "none" | "low" | "medium" | "high";
  issues: string[];
}

export class EscalationChecker {
  /**
   * Check for escalation risk
   */
  async check(content: string, tenantId: string): Promise<EscalationResult> {
    try {
      const issues: string[] = [];
      let escalationRisk: "none" | "low" | "medium" | "high" = "none";

      const lowerContent = content.toLowerCase();

      // Check for inflammatory language
      const inflammatoryPatterns = [
        /\b(outrageous|disgusting|appalling|shocking)\b/gi,
        /\b(demand|demands|must|require|insist)\b/gi,
        /\b(immediately|urgently|asap|right now)\b/gi,
        /\b(boycott|protest|lawsuit|legal action)\b/gi,
      ];

      let inflammatoryCount = 0;
      for (const pattern of inflammatoryPatterns) {
        const matches = lowerContent.match(pattern);
        if (matches) {
          inflammatoryCount += matches.length;
        }
      }

      if (inflammatoryCount > 0) {
        if (inflammatoryCount >= 5) {
          escalationRisk = "high";
          issues.push(`High inflammatory language: ${inflammatoryCount} instances`);
        } else if (inflammatoryCount >= 3) {
          escalationRisk = "medium";
          issues.push(`Moderate inflammatory language: ${inflammatoryCount} instances`);
        } else {
          escalationRisk = "low";
          issues.push(`Some inflammatory language: ${inflammatoryCount} instances`);
        }
      }

      // Check for absolutes (can escalate by being too definitive)
      const absolutePatterns = [
        /\b(always|never|all|none|every|no one)\b/gi,
        /\b(guaranteed|certain|definite|proven fact)\b/gi,
      ];

      let absoluteCount = 0;
      for (const pattern of absolutePatterns) {
        const matches = lowerContent.match(pattern);
        if (matches) {
          absoluteCount += matches.length;
        }
      }

      if (absoluteCount > 3 && escalationRisk === "none") {
        escalationRisk = "low";
        issues.push(`Excessive use of absolute language: ${absoluteCount} instances`);
      }

      // Check for blame attribution
      const blamePatterns = [
        /\b(blame|fault|responsible|culpable|liable)\b/gi,
        /\b(should have|must have|ought to have)\b/gi,
      ];

      let blameCount = 0;
      for (const pattern of blamePatterns) {
        const matches = lowerContent.match(pattern);
        if (matches) {
          blameCount += matches.length;
        }
      }

      if (blameCount > 2) {
        if (escalationRisk === "none") {
          escalationRisk = "low";
        } else if (escalationRisk === "low") {
          escalationRisk = "medium";
        }
        issues.push(`Blame attribution language: ${blameCount} instances`);
      }

      // Check for emotional language
      const emotionalPatterns = [
        /\b(angry|furious|enraged|frustrated|disappointed)\b/gi,
        /\b(betrayed|deceived|lied to|cheated)\b/gi,
      ];

      let emotionalCount = 0;
      for (const pattern of emotionalPatterns) {
        const matches = lowerContent.match(pattern);
        if (matches) {
          emotionalCount += matches.length;
        }
      }

      if (emotionalCount > 2 && escalationRisk !== "high") {
        if (escalationRisk === "none") {
          escalationRisk = "low";
        } else {
          escalationRisk = escalationRisk === "low" ? "medium" : escalationRisk;
        }
        issues.push(`Emotional language: ${emotionalCount} instances`);
      }

      return {
        passed: escalationRisk === "none",
        escalation_risk: escalationRisk,
        issues,
      };
    } catch (error) {
      logger.error("Failed to check escalation risk", {
        error: error instanceof Error ? error.message : String(error),
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return { passed: true, escalation_risk: "none", issues: [] };
    }
  }
}
