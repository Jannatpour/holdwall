/**
 * Case Prioritization Engine
 * 
 * Smart priority calculation based on multiple factors including severity,
 * financial impact, regulatory sensitivity, customer value, SLA proximity, etc.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import type { Case, CasePriority, CaseSeverity, CaseType } from "@prisma/client";

export interface PriorityFactors {
  severity: CaseSeverity;
  financialImpact?: number;
  regulatorySensitivity: boolean;
  customerValue?: "VIP" | "ENTERPRISE" | "STANDARD" | "LOW";
  timeSinceSubmission: number; // milliseconds
  slaDeadlineProximity: number; // 0-1 ratio
  narrativeRisk?: number; // 0-1 score from POS
  assignedTo?: string;
  assignedTeam?: string;
}

export interface PriorityScore {
  priority: CasePriority;
  score: number; // 0-100
  factors: {
    severity: number;
    financialImpact: number;
    regulatory: number;
    customerValue: number;
    urgency: number;
    narrativeRisk: number;
  };
  reasoning: string;
}

/**
 * Case Prioritization Engine
 */
export class CasePrioritizationEngine {
  /**
   * Calculate priority for a case
   */
  async calculatePriority(case_: Case): Promise<PriorityScore> {
    const factors = await this.extractFactors(case_);
    const score = this.computePriorityScore(factors);
    const priority = this.mapScoreToPriority(score.total);
    const reasoning = this.generateReasoning(priority, score, factors);

    logger.debug("Priority calculated", {
      case_id: case_.id,
      priority,
      score: score.total,
      factors,
    });

    metrics.observe("cases.priority.score", score.total, {
      tenant_id: case_.tenantId,
      priority,
    });

    return {
      priority,
      score: score.total,
      factors: score.factors,
      reasoning,
    };
  }

  /**
   * Extract priority factors from case
   */
  private async extractFactors(case_: Case): Promise<PriorityFactors> {
    const now = Date.now();
    const createdAt = case_.createdAt.getTime();
    const timeSinceSubmission = now - createdAt;

    // Calculate SLA deadline proximity
    let slaDeadlineProximity = 1.0; // Default: no urgency
    if (case_.slaDeadline) {
      const deadline = case_.slaDeadline.getTime();
      const totalTime = deadline - createdAt;
      const remainingTime = deadline - now;
      slaDeadlineProximity = totalTime > 0 ? Math.max(0, remainingTime / totalTime) : 0;
    }

    // Extract financial impact from metadata
    const metadata = case_.metadata as Record<string, unknown> | null;
    const financialImpact = metadata?.financialImpact as number | undefined;
    const customerValue = metadata?.customerValue as "VIP" | "ENTERPRISE" | "STANDARD" | "LOW" | undefined;
    const narrativeRisk = metadata?.narrativeRiskScore as number | undefined;

    return {
      severity: case_.severity,
      financialImpact,
      regulatorySensitivity: case_.regulatorySensitivity,
      customerValue,
      timeSinceSubmission,
      slaDeadlineProximity,
      narrativeRisk,
      assignedTo: case_.assignedTo || undefined,
      assignedTeam: case_.assignedTeam || undefined,
    };
  }

  /**
   * Compute priority score from factors
   */
  private computePriorityScore(factors: PriorityFactors): {
    total: number;
    factors: PriorityScore["factors"];
  } {
    // Severity weight: 30%
    const severityScore = this.scoreSeverity(factors.severity);
    const severityWeighted = severityScore * 0.3;

    // Financial impact weight: 20%
    const financialScore = this.scoreFinancialImpact(factors.financialImpact);
    const financialWeighted = financialScore * 0.2;

    // Regulatory sensitivity weight: 15%
    const regulatoryScore = factors.regulatorySensitivity ? 100 : 0;
    const regulatoryWeighted = regulatoryScore * 0.15;

    // Customer value weight: 15%
    const customerScore = this.scoreCustomerValue(factors.customerValue);
    const customerWeighted = customerScore * 0.15;

    // Urgency weight: 15% (time since submission + SLA proximity)
    const urgencyScore = this.scoreUrgency(factors.timeSinceSubmission, factors.slaDeadlineProximity);
    const urgencyWeighted = urgencyScore * 0.15;

    // Narrative risk weight: 5%
    const narrativeScore = (factors.narrativeRisk || 0) * 100;
    const narrativeWeighted = narrativeScore * 0.05;

    const total = Math.min(100, Math.round(
      severityWeighted +
      financialWeighted +
      regulatoryWeighted +
      customerWeighted +
      urgencyWeighted +
      narrativeWeighted
    ));

    return {
      total,
      factors: {
        severity: severityScore,
        financialImpact: financialScore,
        regulatory: regulatoryScore,
        customerValue: customerScore,
        urgency: urgencyScore,
        narrativeRisk: narrativeScore,
      },
    };
  }

  /**
   * Score severity
   */
  private scoreSeverity(severity: CaseSeverity): number {
    const scores: Record<CaseSeverity, number> = {
      LOW: 25,
      MEDIUM: 50,
      HIGH: 75,
      CRITICAL: 100,
    };
    return scores[severity] || 50;
  }

  /**
   * Score financial impact
   */
  private scoreFinancialImpact(impact?: number): number {
    if (!impact) {
      return 0;
    }

    // Logarithmic scale: $0-100 = 0-25, $100-1K = 25-50, $1K-10K = 50-75, $10K+ = 75-100
    if (impact < 100) {
      return (impact / 100) * 25;
    } else if (impact < 1000) {
      return 25 + ((impact - 100) / 900) * 25;
    } else if (impact < 10000) {
      return 50 + ((impact - 1000) / 9000) * 25;
    } else {
      return Math.min(100, 75 + ((impact - 10000) / 100000) * 25);
    }
  }

  /**
   * Score customer value
   */
  private scoreCustomerValue(value?: string): number {
    const scores: Record<string, number> = {
      VIP: 100,
      ENTERPRISE: 75,
      STANDARD: 50,
      LOW: 25,
    };
    return scores[value || "STANDARD"] || 50;
  }

  /**
   * Score urgency (time since submission + SLA proximity)
   */
  private scoreUrgency(timeSinceSubmission: number, slaDeadlineProximity: number): number {
    // Time since submission: older cases get higher urgency (up to 50 points)
    const hoursSinceSubmission = timeSinceSubmission / (1000 * 60 * 60);
    const timeScore = Math.min(50, (hoursSinceSubmission / 168) * 50); // 168 hours = 1 week

    // SLA proximity: closer to deadline = higher urgency (up to 50 points)
    const slaScore = (1 - slaDeadlineProximity) * 50;

    return Math.min(100, timeScore + slaScore);
  }

  /**
   * Map score to priority level
   */
  private mapScoreToPriority(score: number): CasePriority {
    if (score >= 85) {
      return "P0"; // Critical
    } else if (score >= 70) {
      return "P1"; // High
    } else if (score >= 50) {
      return "P2"; // Medium
    } else {
      return "P3"; // Low
    }
  }

  /**
   * Generate reasoning for priority
   */
  private generateReasoning(
    priority: CasePriority,
    score: { total: number; factors: PriorityScore["factors"] },
    factors: PriorityFactors
  ): string {
    const reasons: string[] = [];

    if (score.factors.severity >= 75) {
      reasons.push(`High severity (${factors.severity})`);
    }

    if (score.factors.financialImpact >= 50) {
      reasons.push(`Significant financial impact ($${factors.financialImpact?.toLocaleString()})`);
    }

    if (factors.regulatorySensitivity) {
      reasons.push("Regulatory sensitivity");
    }

    if (score.factors.customerValue >= 75) {
      reasons.push(`High-value customer (${factors.customerValue})`);
    }

    if (score.factors.urgency >= 70) {
      reasons.push("High urgency (approaching SLA deadline or long-standing case)");
    }

    if (score.factors.narrativeRisk >= 70) {
      reasons.push("High narrative risk");
    }

    if (reasons.length === 0) {
      return `Standard priority based on ${factors.severity} severity`;
    }

    return `Priority ${priority} due to: ${reasons.join(", ")}`;
  }

  /**
   * Update case priority
   */
  async updateCasePriority(caseId: string, tenantId: string): Promise<CasePriority> {
    const case_ = await db.case.findFirst({
      where: { id: caseId, tenantId },
    });

    if (!case_) {
      throw new Error("Case not found");
    }

    const priorityScore = await this.calculatePriority(case_);

    await db.case.update({
      where: { id: caseId },
      data: {
        priority: priorityScore.priority,
      },
    });

    logger.info("Case priority updated", {
      case_id: caseId,
      tenant_id: tenantId,
      priority: priorityScore.priority,
      score: priorityScore.score,
    });

    return priorityScore.priority;
  }

  /**
   * Batch update priorities for multiple cases
   */
  async batchUpdatePriorities(tenantId: string, caseIds?: string[]): Promise<number> {
    const where: any = { tenantId };
    if (caseIds && caseIds.length > 0) {
      where.id = { in: caseIds };
    }

    const cases = await db.case.findMany({
      where,
      take: 1000, // Limit batch size
    });

    let updated = 0;
    for (const case_ of cases) {
      try {
        const priorityScore = await this.calculatePriority(case_);

        if (case_.priority !== priorityScore.priority) {
          await db.case.update({
            where: { id: case_.id },
            data: { priority: priorityScore.priority },
          });
          updated++;
        }
      } catch (error) {
        logger.error("Failed to update case priority", {
          case_id: case_.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("Batch priority update completed", {
      tenant_id: tenantId,
      cases_processed: cases.length,
      cases_updated: updated,
    });

    return updated;
  }
}

export const casePrioritizationEngine = new CasePrioritizationEngine();
