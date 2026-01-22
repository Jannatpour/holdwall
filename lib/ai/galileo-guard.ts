/**
 * Galileo Luna Guard Models
 * 
 * Real-time hallucination detection and content safety
 * for LLM outputs.
 */

export interface GuardResult {
  text: string;
  safe: boolean;
  hallucinationScore: number; // 0-1, higher = more hallucination
  safetyScore: number; // 0-1, higher = safer
  issues: Array<{
    type: "hallucination" | "safety" | "factuality";
    description: string;
    severity: "low" | "medium" | "high";
  }>;
}

export class GalileoGuard {
  private openaiApiKey: string | null = null;

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || null;
  }

  /**
   * Guard text for hallucinations and safety
   */
  async guard(text: string, context?: string): Promise<GuardResult> {
    const issues: GuardResult["issues"] = [];

    // Detect hallucinations
    const hallucinationScore = await this.detectHallucination(text, context);
    if (hallucinationScore > 0.5) {
      issues.push({
        type: "hallucination",
        description: "Potential hallucination detected",
        severity: hallucinationScore > 0.7 ? "high" : "medium",
      });
    }

    // Check safety
    const safetyScore = await this.checkSafety(text);
    if (safetyScore < 0.7) {
      issues.push({
        type: "safety",
        description: "Safety concerns detected",
        severity: safetyScore < 0.5 ? "high" : "medium",
      });
    }

    // Check factuality
    const factualityIssues = await this.checkFactuality(text);
    issues.push(...factualityIssues);

    const safe = issues.filter(i => i.severity === "high").length === 0;

    return {
      text,
      safe,
      hallucinationScore,
      safetyScore,
      issues,
    };
  }

  /**
   * Detect hallucinations
   */
  private async detectHallucination(
    text: string,
    context?: string
  ): Promise<number> {
    if (!this.openaiApiKey) {
      // Fallback: pattern-based detection
      return this.patternBasedHallucinationDetection(text);
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "Detect hallucinations in text. Rate 0-1 where 1 = definite hallucination.",
            },
            {
              role: "user",
              content: `Text: "${text}"${context ? `\n\nContext: "${context}"` : ""}\n\nRate hallucination likelihood 0-1.`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const parsed = JSON.parse(data.choices[0]?.message?.content || "{}");
        return parsed.score || 0.5;
      }
    } catch (error) {
      console.warn("Hallucination detection failed:", error);
    }

    return this.patternBasedHallucinationDetection(text);
  }

  /**
   * Pattern-based hallucination detection (fallback)
   */
  private patternBasedHallucinationDetection(text: string): number {
    let score = 0;

    // Check for common hallucination patterns
    const patterns = [
      /exactly \d+%/gi,
      /studies show that/gi,
      /research proves/gi,
      /scientists agree/gi,
    ];

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        score += 0.2;
      }
    }

    return Math.min(1, score);
  }

  /**
   * Check safety
   */
  private async checkSafety(text: string): Promise<number> {
    // Check for harmful content
    const harmfulPatterns = [
      /scam/i,
      /fraud/i,
      /illegal/i,
      /criminal/i,
    ];

    const matches = harmfulPatterns.filter(p => p.test(text)).length;
    const safetyScore = 1 - (matches / harmfulPatterns.length) * 0.5;

    return Math.max(0, safetyScore);
  }

  /**
   * Check factuality
   */
  private async checkFactuality(text: string): Promise<GuardResult["issues"]> {
    const issues: GuardResult["issues"] = [];

    // Check for unsourced claims
    const claimPatterns = [
      /(\d+)% of/gi,
      /studies show/gi,
      /research indicates/gi,
    ];

    let unsourcedClaims = 0;
    for (const pattern of claimPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        unsourcedClaims += matches.length;
      }
    }

    if (unsourcedClaims > 2) {
      issues.push({
        type: "factuality",
        description: `${unsourcedClaims} unsourced factual claims`,
        severity: unsourcedClaims > 5 ? "high" : "medium",
      });
    }

    return issues;
  }
}
