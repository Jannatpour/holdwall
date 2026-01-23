/**
 * Autonomous Measurement Automation
 * 
 * Fully autonomous measurement of narrative risk metrics:
 * - Negative query traffic share
 * - Outbreak probability
 * - AI citation capture rate
 * - Time-to-brief / time-to-approved response
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export interface MeasurementResult {
  negative_query_traffic_share: number;
  outbreak_probability: number;
  ai_citation_capture_rate: number;
  time_to_brief_hours: number;
  time_to_approved_response_hours: number;
  errors: number;
  duration_ms: number;
}

export class MeasurementAutomation {
  constructor() {
  }

  /**
   * Execute autonomous measurement
   */
  async execute(tenantId: string): Promise<MeasurementResult> {
    const startTime = Date.now();
    let errors = 0;

    try {
      // Calculate negative query traffic share (autonomous)
      const negativeQueryShare = await this.calculateNegativeQueryShare(tenantId);

      // Calculate outbreak probability (autonomous)
      const outbreakProbability = await this.calculateOutbreakProbability(tenantId);

      // Calculate AI citation capture rate (autonomous)
      const citationCaptureRate = await this.calculateCitationCaptureRate(tenantId);

      // Calculate time-to-brief (autonomous)
      const timeToBrief = await this.calculateTimeToBrief(tenantId);

      // Calculate time-to-approved response (autonomous)
      const timeToApproved = await this.calculateTimeToApproved(tenantId);

      return {
        negative_query_traffic_share: negativeQueryShare,
        outbreak_probability: outbreakProbability,
        ai_citation_capture_rate: citationCaptureRate,
        time_to_brief_hours: timeToBrief,
        time_to_approved_response_hours: timeToApproved,
        errors,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      logger.error("Autonomous measurement failed", {
        error: error instanceof Error ? error.message : String(error),
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        negative_query_traffic_share: 0,
        outbreak_probability: 0,
        ai_citation_capture_rate: 0,
        time_to_brief_hours: 0,
        time_to_approved_response_hours: 0,
        errors: errors + 1,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Calculate negative query traffic share
   */
  private async calculateNegativeQueryShare(tenantId: string): Promise<number> {
    try {
      // Get recent claims with negative sentiment
      const negativeClaims = await db.claim.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        take: 1000,
      });

      // Simple heuristic: claims with high decisiveness and negative keywords
      const negativeKeywords = ["scam", "fraud", "bad", "terrible", "awful", "failed"];
      const negativeCount = negativeClaims.filter((c) =>
        negativeKeywords.some((kw) => c.canonicalText.toLowerCase().includes(kw))
      ).length;

      return negativeCount / Math.max(negativeClaims.length, 1);
    } catch (error) {
      logger.warn("Failed to calculate negative query share", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Calculate outbreak probability
   */
  private async calculateOutbreakProbability(tenantId: string): Promise<number> {
    try {
      // Get outbreak forecasts
      const forecasts = await db.forecast.findMany({
        where: {
          tenantId,
          type: "OUTBREAK",
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      if (forecasts.length === 0) {
        return 0;
      }

      // Average outbreak probability
      const avgProbability =
        forecasts.reduce((sum, f) => sum + f.value, 0) / forecasts.length;

      return avgProbability;
    } catch (error) {
      logger.warn("Failed to calculate outbreak probability", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Calculate AI citation capture rate
   */
  private async calculateCitationCaptureRate(tenantId: string): Promise<number> {
    try {
      // Get published artifacts
      const artifacts = await db.aAALArtifact.findMany({
        where: {
          tenantId,
          status: "PUBLISHED",
          padlPublished: true,
        },
        take: 20,
      });

      if (artifacts.length === 0) {
        return 0;
      }

      // Check AI answer snapshots for citations
      const snapshots = await db.aIAnswerSnapshot.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        take: 100,
      });

      // Count citations to our artifacts
      const artifactUrls = artifacts.map((a) => a.padlUrl).filter(Boolean);
      const citations = snapshots.filter((s) =>
        artifactUrls.some((url) => s.citations.includes(url || ""))
      ).length;

      return citations / Math.max(snapshots.length, 1);
    } catch (error) {
      logger.warn("Failed to calculate citation capture rate", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Calculate time-to-brief (hours)
   */
  private async calculateTimeToBrief(tenantId: string): Promise<number> {
    try {
      // Get recent clusters and their creation time
      const clusters = await db.claimCluster.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      if (clusters.length === 0) {
        return 0;
      }

      // Calculate average time from cluster creation to first artifact
      const times: number[] = [];
      for (const cluster of clusters) {
        const artifact = await db.aAALArtifact.findFirst({
          where: {
            tenantId,
            createdAt: {
              gte: cluster.createdAt,
            },
          },
          orderBy: { createdAt: "asc" },
        });

        if (artifact) {
          const timeDiff = artifact.createdAt.getTime() - cluster.createdAt.getTime();
          times.push(timeDiff / (60 * 60 * 1000)); // Convert to hours
        }
      }

      return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    } catch (error) {
      logger.warn("Failed to calculate time-to-brief", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Calculate time-to-approved response (hours)
   */
  private async calculateTimeToApproved(tenantId: string): Promise<number> {
    try {
      // Get approvals that were approved
      const approvals = await db.approval.findMany({
        where: {
          tenantId,
          decision: "APPROVED",
          decidedAt: { not: null },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        take: 50,
      });

      if (approvals.length === 0) {
        return 0;
      }

      // Calculate average time from creation to approval
      const times = approvals.map((a) => {
        if (!a.decidedAt) {
          return 0;
        }
        return (a.decidedAt.getTime() - a.createdAt.getTime()) / (60 * 60 * 1000); // Hours
      });

      return times.reduce((a, b) => a + b, 0) / times.length;
    } catch (error) {
      logger.warn("Failed to calculate time-to-approved", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }
}
