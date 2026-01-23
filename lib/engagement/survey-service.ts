/**
 * Survey Service
 * 
 * Handles customer satisfaction surveys and feedback collection.
 * Supports integration with external survey providers (SurveyMonkey, Typeform, etc.)
 * or internal survey system.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

export interface SurveyResponse {
  id: string;
  caseId?: string;
  caseNumber?: string;
  tenantId: string;
  respondentEmail?: string;
  respondentName?: string;
  satisfactionScore: number; // 1-5 scale
  npsScore?: number; // Net Promoter Score: -100 to 100
  feedback?: string;
  categories?: Record<string, number>; // Category-specific scores
  submittedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface SurveyMetrics {
  averageSatisfaction: number;
  averageNPS: number;
  responseCount: number;
  trend: Array<{ date: string; score: number }>;
  byCategory?: Record<string, number>;
}

export class SurveyService {
  /**
   * Record a survey response
   */
  async recordResponse(
    tenantId: string,
    response: Omit<SurveyResponse, "id" | "submittedAt">
  ): Promise<SurveyResponse> {
    try {
      // Store in database using CaseResolution metadata field
      if (response.caseId) {
        // Verify case belongs to tenant
        const caseRecord = await db.case.findFirst({
          where: {
            id: response.caseId,
            tenantId,
          },
        });

        if (!caseRecord) {
          throw new Error(`Case ${response.caseId} not found for tenant ${tenantId}`);
        }

        // Get or create resolution
        const existingResolution = await db.caseResolution.findUnique({
          where: { caseId: response.caseId },
        });

        const satisfactionMetadata = {
          customerSatisfaction: response.satisfactionScore,
          customerFeedback: response.feedback || null,
          npsScore: response.npsScore,
          categories: response.categories,
          submittedAt: new Date().toISOString(),
          ...(response.metadata || {}),
        };

        if (existingResolution) {
          // Update existing resolution metadata
          const existingMetadata = (existingResolution.customerPlan as Record<string, unknown>) || {};
          await db.caseResolution.update({
            where: { caseId: response.caseId },
            data: {
              customerPlan: {
                ...existingMetadata,
                survey: satisfactionMetadata,
              },
            },
          });
        } else {
          // Create new resolution with survey data
          await db.caseResolution.create({
            data: {
              caseId: response.caseId,
              customerPlan: {
                survey: satisfactionMetadata,
              },
              internalPlan: {},
              evidenceChecklist: [],
            },
          });
        }
      }

      // Record metrics
      metrics.increment("survey_responses_total", {
        tenant_id: tenantId,
        satisfaction_range: this.getSatisfactionRange(response.satisfactionScore),
      });

      if (response.npsScore !== undefined) {
        metrics.setGauge("survey_nps_score", response.npsScore, {
          tenant_id: tenantId,
        });
      }

      const surveyResponse: SurveyResponse = {
        id: `survey-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...response,
        submittedAt: new Date(),
      };

      logger.info("Survey response recorded", {
        tenantId,
        caseId: response.caseId,
        satisfactionScore: response.satisfactionScore,
      });

      return surveyResponse;
    } catch (error) {
      logger.error("Failed to record survey response", {
        error: error instanceof Error ? error.message : String(error),
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get survey metrics for a tenant
   */
  async getMetrics(
    tenantId: string,
    days: number = 30
  ): Promise<SurveyMetrics> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get all case resolutions with satisfaction data
      // Query through Case to filter by tenantId
      const cases = await db.case.findMany({
        where: {
          tenantId,
          createdAt: { gte: startDate },
        },
        select: {
          id: true,
          resolution: {
            select: {
              customerPlan: true,
              createdAt: true,
            },
          },
        },
      });

      const resolutions = cases
        .filter((c) => c.resolution !== null)
        .map((c) => ({
          caseId: c.id,
          customerPlan: c.resolution!.customerPlan as Record<string, unknown> | null,
          createdAt: c.resolution!.createdAt,
        }))
        .filter((r) => {
          const survey = (r.customerPlan as Record<string, unknown>)?.survey as
            | Record<string, unknown>
            | undefined;
          return survey && survey.customerSatisfaction !== undefined;
        });

      if (resolutions.length === 0) {
        return {
          averageSatisfaction: 0,
          averageNPS: 0,
          responseCount: 0,
          trend: [],
        };
      }

      // Calculate averages
      const satisfactionScores = resolutions
        .map((r) => {
          const survey = (r.customerPlan as Record<string, unknown>)?.survey as
            | Record<string, unknown>
            | undefined;
          return survey?.customerSatisfaction as number | undefined;
        })
        .filter((s): s is number => s !== null && s !== undefined && typeof s === "number");

      const averageSatisfaction =
        satisfactionScores.length > 0
          ? satisfactionScores.reduce((sum, score) => sum + score, 0) /
            satisfactionScores.length
          : 0;

      // Extract NPS scores from survey metadata
      const npsScores = resolutions
        .map((r) => {
          const survey = (r.customerPlan as Record<string, unknown>)?.survey as
            | Record<string, unknown>
            | undefined;
          return survey?.npsScore as number | undefined;
        })
        .filter((nps): nps is number => nps !== undefined && nps !== null && typeof nps === "number");

      const averageNPS =
        npsScores.length > 0
          ? npsScores.reduce((sum, score) => sum + score, 0) / npsScores.length
          : 0;

      // Build trend data
      const trendMap = new Map<string, { total: number; count: number }>();
      for (const resolution of resolutions) {
        const date = resolution.createdAt.toISOString().split("T")[0];
        const survey = (resolution.customerPlan as Record<string, unknown>)?.survey as
          | Record<string, unknown>
          | undefined;
        const score = (survey?.customerSatisfaction as number) || 0;
        const existing = trendMap.get(date) || { total: 0, count: 0 };
        trendMap.set(date, {
          total: existing.total + score,
          count: existing.count + 1,
        });
      }

      const trend: Array<{ date: string; score: number }> = Array.from(
        trendMap.entries()
      )
        .map(([date, data]) => ({
          date,
          score: data.count > 0 ? data.total / data.count : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate category averages if available
      const categoryScores: Record<string, number[]> = {};
      for (const resolution of resolutions) {
        const survey = (resolution.customerPlan as Record<string, unknown>)?.survey as
          | Record<string, unknown>
          | undefined;
        const categories = survey?.categories as
          | Record<string, number>
          | undefined;
        if (categories && typeof categories === "object") {
          for (const [category, score] of Object.entries(categories)) {
            if (typeof score === "number") {
              if (!categoryScores[category]) {
                categoryScores[category] = [];
              }
              categoryScores[category].push(score);
            }
          }
        }
      }

      const byCategory: Record<string, number> = {};
      for (const [category, scores] of Object.entries(categoryScores)) {
        byCategory[category] =
          scores.reduce((sum, score) => sum + score, 0) / scores.length;
      }

      return {
        averageSatisfaction: Math.round(averageSatisfaction * 100) / 100,
        averageNPS: Math.round(averageNPS * 100) / 100,
        responseCount: resolutions.length,
        trend,
        byCategory: Object.keys(byCategory).length > 0 ? byCategory : undefined,
      };
    } catch (error) {
      logger.error("Failed to get survey metrics", {
        error: error instanceof Error ? error.message : String(error),
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get satisfaction score for a specific case
   */
  async getCaseSatisfaction(
    tenantId: string,
    caseId: string
  ): Promise<number | null> {
    try {
      // Verify case belongs to tenant
      const caseRecord = await db.case.findFirst({
        where: {
          id: caseId,
          tenantId,
        },
        select: {
          resolution: {
            select: {
              customerPlan: true,
            },
          },
        },
      });

      if (!caseRecord?.resolution) {
        return null;
      }

      const survey = (caseRecord.resolution.customerPlan as Record<string, unknown>)?.survey as
        | Record<string, unknown>
        | undefined;
      const satisfaction = survey?.customerSatisfaction as number | undefined;

      return satisfaction && typeof satisfaction === "number" ? satisfaction : null;
    } catch (error) {
      logger.error("Failed to get case satisfaction", {
        error: error instanceof Error ? error.message : String(error),
        tenantId,
        caseId,
      });
      return null;
    }
  }

  /**
   * Get satisfaction trend for a date range
   */
  async getSatisfactionTrend(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: string; score: number; count: number }>> {
    try {
      // Query through Case to filter by tenantId
      const cases = await db.case.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          resolution: {
            select: {
              customerPlan: true,
              createdAt: true,
            },
          },
        },
      });

      const resolutions = cases
        .filter((c) => c.resolution !== null)
        .map((c) => ({
          customerPlan: c.resolution!.customerPlan as Record<string, unknown> | null,
          createdAt: c.resolution!.createdAt,
        }))
        .filter((r) => {
          const survey = (r.customerPlan as Record<string, unknown>)?.survey as
            | Record<string, unknown>
            | undefined;
          return survey && survey.customerSatisfaction !== undefined;
        });

      const trendMap = new Map<
        string,
        { total: number; count: number }
      >();
      for (const resolution of resolutions) {
        const date = resolution.createdAt.toISOString().split("T")[0];
        const survey = (resolution.customerPlan as Record<string, unknown>)?.survey as
          | Record<string, unknown>
          | undefined;
        const score = (survey?.customerSatisfaction as number) || 0;
        const existing = trendMap.get(date) || { total: 0, count: 0 };
        trendMap.set(date, {
          total: existing.total + score,
          count: existing.count + 1,
        });
      }

      return Array.from(trendMap.entries())
        .map(([date, data]) => ({
          date,
          score: data.count > 0 ? data.total / data.count : 0,
          count: data.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      logger.error("Failed to get satisfaction trend", {
        error: error instanceof Error ? error.message : String(error),
        tenantId,
      });
      return [];
    }
  }

  /**
   * Calculate Net Promoter Score from satisfaction scores
   */
  calculateNPS(satisfactionScores: number[]): number {
    if (satisfactionScores.length === 0) return 0;

    // Convert 1-5 satisfaction to NPS scale (0-10)
    // 5 = 10 (promoter), 4 = 7-9 (passive), 1-3 = 0-6 (detractor)
    const npsScores = satisfactionScores.map((score) => {
      if (score >= 4.5) return 10; // Promoter
      if (score >= 3.5) return 7; // Passive
      return 3; // Detractor
    });

    const promoters = npsScores.filter((score) => score >= 9).length;
    const detractors = npsScores.filter((score) => score <= 6).length;
    const total = npsScores.length;

    const nps = ((promoters - detractors) / total) * 100;
    return Math.round(nps * 100) / 100;
  }

  /**
   * Get satisfaction range for metrics
   */
  private getSatisfactionRange(score: number): string {
    if (score >= 4.5) return "high";
    if (score >= 3.5) return "medium";
    return "low";
  }
}

export const surveyService = new SurveyService();
