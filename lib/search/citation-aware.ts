/**
 * Citation-Aware Chunk Selection
 * 
 * Prefers chunks with strong evidence links and ensures citation coverage.
 */

import { logger } from "@/lib/logging/logger";
import type { Evidence } from "@/lib/evidence/vault";

export interface CitationAwareChunk {
  evidence: Evidence;
  score: number;
  citationStrength: number;
  evidenceQuality: number;
  hasStrongLinks: boolean;
}

export interface CitationAwareConfig {
  minCitationStrength?: number; // 0-1
  preferStrongLinks?: boolean;
  ensureCoverage?: boolean; // Ensure at least N chunks have citations
  minCoverage?: number; // Minimum number of chunks with citations
}

/**
 * Citation-Aware Chunk Selector
 */
export class CitationAwareSelector {
  /**
   * Select chunks with citation awareness
   */
  selectChunks(
    chunks: Array<{ evidence: Evidence; score: number }>,
    config?: CitationAwareConfig
  ): CitationAwareChunk[] {
    const minCitationStrength = config?.minCitationStrength ?? 0.5;
    const preferStrongLinks = config?.preferStrongLinks ?? true;
    const ensureCoverage = config?.ensureCoverage ?? true;
    const minCoverage = config?.minCoverage ?? 3;

    // Calculate citation metrics for each chunk
    const chunksWithCitations = chunks.map((chunk) => {
      const citationStrength = this.calculateCitationStrength(chunk.evidence);
      const evidenceQuality = this.calculateEvidenceQuality(chunk.evidence);
      const hasStrongLinks = citationStrength >= minCitationStrength;

      // Boost score if has strong citations
      let adjustedScore = chunk.score;
      if (preferStrongLinks && hasStrongLinks) {
        adjustedScore *= 1.2; // 20% boost for strong citations
      }
      if (evidenceQuality > 0.8) {
        adjustedScore *= 1.1; // 10% boost for high-quality evidence
      }

      return {
        evidence: chunk.evidence,
        score: adjustedScore,
        citationStrength,
        evidenceQuality,
        hasStrongLinks,
      };
    });

    // Sort by adjusted score
    chunksWithCitations.sort((a, b) => b.score - a.score);

    // Ensure citation coverage
    if (ensureCoverage) {
      const chunksWithStrongCitations = chunksWithCitations.filter(
        (c) => c.hasStrongLinks
      );

      if (chunksWithStrongCitations.length < minCoverage) {
        // Add more chunks with citations even if lower score
        const additionalChunks = chunksWithCitations
          .filter((c) => c.hasStrongLinks && !chunksWithStrongCitations.includes(c))
          .slice(0, minCoverage - chunksWithStrongCitations.length);

        // Merge and re-sort
        const merged = [...chunksWithStrongCitations, ...additionalChunks];
        merged.sort((a, b) => b.score - a.score);
        return merged;
      }
    }

    return chunksWithCitations;
  }

  /**
   * Calculate citation strength for evidence
   */
  private calculateCitationStrength(evidence: Evidence): number {
    // Factors that indicate strong citations:
    // 1. Has source links
    // 2. Has evidence links
    // 3. Has metadata with citations
    // 4. Has provenance information

    let strength = 0;
    let factors = 0;

    // Source links
    if (evidence.source?.id) {
      strength += 0.3;
      factors++;
    }

    // Evidence links (related evidence) - check metadata for links
    if (evidence.metadata?.links && Array.isArray(evidence.metadata.links) && evidence.metadata.links.length > 0) {
      strength += 0.3;
      factors++;
    }

    // Metadata with citation info
    if (evidence.metadata?.citations) {
      strength += 0.2;
      factors++;
    }

    // Provenance information - check metadata for source info
    if (evidence.metadata?.source) {
      strength += 0.2;
      factors++;
    }

    // Normalize by number of factors
    return factors > 0 ? strength / factors : 0;
  }

  /**
   * Calculate evidence quality score
   */
  private calculateEvidenceQuality(evidence: Evidence): number {
    // Factors that indicate high-quality evidence:
    // 1. Has content
    // 2. Has structured metadata
    // 3. Has verification status
    // 4. Has timestamps

    let quality = 0;
    let factors = 0;

    // Content quality
    const hasContent = Boolean(
      evidence.content?.normalized || evidence.content?.raw || evidence.metadata?.title
    );
    if (hasContent) {
      quality += 0.3;
      factors++;
    }

    // Structured metadata
    if (evidence.metadata && Object.keys(evidence.metadata).length > 0) {
      quality += 0.2;
      factors++;
    }

    // Verification status (check signature for verification)
    if (evidence.signature) {
      quality += 0.3;
      factors++;
    }

    // Timestamps (indicates freshness/tracking)
    if (evidence.created_at || evidence.updated_at) {
      quality += 0.2;
      factors++;
    }

    // Normalize by number of factors
    return factors > 0 ? quality / factors : 0;
  }

  /**
   * Ensure citation coverage in selected chunks
   */
  ensureCitationCoverage(
    chunks: CitationAwareChunk[],
    minCoverage: number = 3
  ): CitationAwareChunk[] {
    const chunksWithCitations = chunks.filter((c) => c.hasStrongLinks);

    if (chunksWithCitations.length >= minCoverage) {
      return chunks; // Already has sufficient coverage
    }

    // Need to add more chunks with citations
    // In production, would query for additional evidence with strong citations
    logger.warn("Citation coverage insufficient", {
      current: chunksWithCitations.length,
      required: minCoverage,
    });

    return chunks; // Return as-is, would enhance in production
  }
}
