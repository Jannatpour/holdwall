/**
 * Cross-Platform Seeding Detector
 * 
 * Detects cross-platform seeding by analyzing content fingerprinting
 * and timing correlation across platforms.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { createHash } from "node:crypto";

export interface CrossPlatformSeedingResult {
  detected: boolean;
  confidence: number;
  platforms: string[];
  timing_correlation: number;
}

export class CrossPlatformSeeder {
  /**
   * Detect cross-platform seeding for evidence
   */
  async detect(evidenceId: string, tenantId: string): Promise<CrossPlatformSeedingResult> {
    try {
      const evidence = await db.evidence.findUnique({
        where: { id: evidenceId },
      });

      if (!evidence || evidence.tenantId !== tenantId) {
        return { detected: false, confidence: 0, platforms: [], timing_correlation: 0 };
      }

      const content = evidence.contentRaw || evidence.contentNormalized || "";
      if (!content.trim()) {
        return { detected: false, confidence: 0, platforms: [], timing_correlation: 0 };
      }

      // Generate content fingerprint
      const fingerprint = this.generateFingerprint(content);

      // Find evidence with similar fingerprints across different platforms
      const timeWindow = 48 * 60 * 60 * 1000; // 48 hours
      const similarEvidence = await db.evidence.findMany({
        where: {
          tenantId,
          sourceType: { not: evidence.sourceType }, // Different platform
          createdAt: {
            gte: new Date(new Date(evidence.createdAt).getTime() - timeWindow),
            lte: new Date(new Date(evidence.createdAt).getTime() + timeWindow),
          },
          id: { not: evidenceId },
        },
        take: 100,
      });

      // Filter by content similarity
      const matchingEvidence = similarEvidence.filter((e) => {
        const eContent = e.contentRaw || e.contentNormalized || "";
        if (!eContent.trim()) {
          return false;
        }
        const eFingerprint = this.generateFingerprint(eContent);
        return this.fingerprintSimilarity(fingerprint, eFingerprint) > 0.8;
      });

      if (matchingEvidence.length < 2) {
        return { detected: false, confidence: 0, platforms: [], timing_correlation: 0 };
      }

      // Get unique platforms
      const platforms = Array.from(
        new Set([evidence.sourceType, ...matchingEvidence.map((e) => e.sourceType)])
      );

      // Calculate timing correlation
      const timingCorrelation = this.calculateTimingCorrelation(
        evidence,
        matchingEvidence
      );

      // Calculate confidence
      const platformScore = Math.min(1.0, platforms.length / 3); // More platforms = higher confidence
      const timingScore = timingCorrelation;
      const volumeScore = Math.min(1.0, matchingEvidence.length / 5); // More matches = higher confidence
      const confidence = (platformScore * 0.4 + timingScore * 0.4 + volumeScore * 0.2);

      const detected = confidence >= 0.6 && platforms.length >= 2;

      // Store campaign if detected
      if (detected) {
        await this.storeCampaign(tenantId, platforms, [evidenceId, ...matchingEvidence.map((e) => e.id)], timingCorrelation, fingerprint);
      }

      return {
        detected,
        confidence,
        platforms,
        timing_correlation: timingCorrelation,
      };
    } catch (error) {
      logger.error("Failed to detect cross-platform seeding", {
        error: error instanceof Error ? error.message : String(error),
        evidence_id: evidenceId,
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return { detected: false, confidence: 0, platforms: [], timing_correlation: 0 };
    }
  }

  /**
   * Generate content fingerprint
   */
  private generateFingerprint(content: string): string {
    // Normalize content
    const normalized = content
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 500); // First 500 chars

    // Generate hash
    return createHash("sha256").update(normalized).digest("hex").substring(0, 16);
  }

  /**
   * Calculate fingerprint similarity
   */
  private fingerprintSimilarity(fp1: string, fp2: string): number {
    // Simple character overlap
    const chars1 = new Set(fp1.split(""));
    const chars2 = new Set(fp2.split(""));
    const intersection = new Set([...chars1].filter((c) => chars2.has(c)));
    return intersection.size / Math.max(chars1.size, chars2.size, 1);
  }

  /**
   * Calculate timing correlation
   */
  private calculateTimingCorrelation(
    evidence: any,
    matchingEvidence: any[]
  ): number {
    const evidenceTime = new Date(evidence.createdAt).getTime();
    const times = matchingEvidence.map((e) => new Date(e.createdAt).getTime());

    // Calculate time differences
    const timeDiffs = times.map((t) => Math.abs(t - evidenceTime));
    const avgDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;

    // Lower average difference = higher correlation
    // Normalize to 0-1 range (48 hours = 0, 0 hours = 1)
    const correlation = 1 - Math.min(1, avgDiff / (48 * 60 * 60 * 1000));

    return correlation;
  }

  /**
   * Store cross-platform campaign
   */
  private async storeCampaign(
    tenantId: string,
    platforms: string[],
    evidenceIds: string[],
    timingCorrelation: number,
    contentFingerprint: string
  ): Promise<void> {
    try {
      // Check for existing campaign
      const existing = await db.crossPlatformCampaign.findFirst({
        where: {
          tenantId,
          contentFingerprint,
        },
      });

      if (existing) {
        // Update existing campaign
        await db.crossPlatformCampaign.update({
          where: { id: existing.id },
          data: {
            evidenceIds: Array.from(new Set([...existing.evidenceIds, ...evidenceIds])),
            platforms: Array.from(new Set([...existing.platforms, ...platforms])),
            timingCorrelation: Math.max(existing.timingCorrelation, timingCorrelation),
            confidence: Math.max(existing.confidence, timingCorrelation),
          },
        });
      } else {
        // Create new campaign
        await db.crossPlatformCampaign.create({
          data: {
            tenantId,
            campaignId: `campaign-${Date.now()}`,
            platforms,
            evidenceIds,
            timingCorrelation,
            contentFingerprint,
            confidence: timingCorrelation,
          },
        });
      }
    } catch (error) {
      logger.warn("Failed to store cross-platform campaign", {
        error: error instanceof Error ? error.message : String(error),
        tenant_id: tenantId,
      });
    }
  }
}
