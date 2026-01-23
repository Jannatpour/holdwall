/**
 * Citation-Grounded Checker
 * 
 * Verifies that all claims cite evidence and that citations are valid.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export interface CitationGroundedResult {
  passed: boolean;
  score: number; // 0-1
  issues: string[];
}

export class CitationGroundedChecker {
  /**
   * Check if content is citation-grounded
   */
  async check(content: string, evidenceRefs: string[]): Promise<CitationGroundedResult> {
    try {
      const issues: string[] = [];
      let score = 1.0;

      // Extract claims from content (simplified - in production use NLP)
      const claims = this.extractClaims(content);

      if (claims.length === 0) {
        return { passed: true, score: 1.0, issues: [] };
      }

      // Check if evidence refs exist
      if (evidenceRefs.length === 0) {
        issues.push("No evidence references provided");
        score = 0;
      } else {
        // Verify evidence exists
        const validEvidence = await Promise.all(
          evidenceRefs.map(async (ref) => {
            const evidence = await db.evidence.findUnique({ where: { id: ref } });
            return evidence !== null;
          })
        );
        const validCount = validEvidence.filter((v) => v).length;
        if (validCount < evidenceRefs.length) {
          issues.push(`${evidenceRefs.length - validCount} invalid evidence references`);
          score -= 0.2;
        }
      }

      // Check citation coverage (claims should have evidence)
      const citationCoverage = evidenceRefs.length / Math.max(claims.length, 1);
      if (citationCoverage < 0.5) {
        issues.push(`Low citation coverage: ${(citationCoverage * 100).toFixed(0)}%`);
        score -= 0.3;
      }

      // Check for unsupported claims (claims without evidence)
      const unsupportedClaims = claims.length - Math.min(claims.length, evidenceRefs.length);
      if (unsupportedClaims > 0) {
        issues.push(`${unsupportedClaims} unsupported claims detected`);
        score -= 0.2 * unsupportedClaims;
      }

      score = Math.max(0, score);
      const passed = score >= 0.7 && issues.length === 0;

      return {
        passed,
        score,
        issues,
      };
    } catch (error) {
      logger.error("Failed to check citation grounding", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return { passed: false, score: 0, issues: ["Citation check failed"] };
    }
  }

  /**
   * Extract claims from content (simplified)
   */
  private extractClaims(content: string): string[] {
    // Simple heuristic: sentences that make factual statements
    // In production, use NLP/LLM to extract claims
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    return sentences.filter((s) => {
      // Filter for factual-sounding sentences
      const lower = s.toLowerCase();
      return (
        !lower.includes("?") &&
        (lower.includes("is") ||
          lower.includes("was") ||
          lower.includes("are") ||
          lower.includes("were") ||
          lower.includes("has") ||
          lower.includes("had"))
      );
    });
  }
}
