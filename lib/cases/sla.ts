/**
 * SLA Management Service
 * 
 * Handles SLA calculation, tracking, and alerts for cases.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { caseNotificationsService } from "./notifications";
import { caseEscalationService } from "./escalation";
import type { Case, CaseType, CaseSeverity } from "@prisma/client";

const eventStore = new DatabaseEventStore();

export interface SLAPolicy {
  caseType: CaseType;
  severity: CaseSeverity;
  hours: number;
}

export interface SLAMetrics {
  caseId: string;
  slaDeadline: Date;
  hoursRemaining: number;
  percentRemaining: number;
  status: "on_track" | "at_risk" | "breached";
  breachRisk: number; // 0-1
}

/**
 * SLA Management Service
 */
export class CaseSLAService {
  private defaultSLAPolicies: SLAPolicy[] = [
    // Critical cases: 1 hour
    { caseType: "DISPUTE", severity: "CRITICAL", hours: 1 },
    { caseType: "FRAUD_ATO", severity: "CRITICAL", hours: 1 },
    { caseType: "OUTAGE_DELAY", severity: "CRITICAL", hours: 1 },
    { caseType: "COMPLAINT", severity: "CRITICAL", hours: 1 },

    // High severity: 4 hours
    { caseType: "DISPUTE", severity: "HIGH", hours: 4 },
    { caseType: "FRAUD_ATO", severity: "HIGH", hours: 4 },
    { caseType: "OUTAGE_DELAY", severity: "HIGH", hours: 4 },
    { caseType: "COMPLAINT", severity: "HIGH", hours: 4 },

    // Medium severity: 24 hours
    { caseType: "DISPUTE", severity: "MEDIUM", hours: 24 },
    { caseType: "FRAUD_ATO", severity: "MEDIUM", hours: 24 },
    { caseType: "OUTAGE_DELAY", severity: "MEDIUM", hours: 24 },
    { caseType: "COMPLAINT", severity: "MEDIUM", hours: 24 },

    // Low severity: 72 hours
    { caseType: "DISPUTE", severity: "LOW", hours: 72 },
    { caseType: "FRAUD_ATO", severity: "LOW", hours: 72 },
    { caseType: "OUTAGE_DELAY", severity: "LOW", hours: 72 },
    { caseType: "COMPLAINT", severity: "LOW", hours: 72 },
  ];

  /**
   * Calculate SLA deadline for a case
   */
  calculateSLADeadline(case_: Case): Date {
    // Check if SLA is already set
    if (case_.slaDeadline) {
      return case_.slaDeadline;
    }

    // Find matching policy
    const policy = this.defaultSLAPolicies.find(
      (p) => p.caseType === case_.type && p.severity === case_.severity
    );

    const hours = policy?.hours || 24; // Default: 24 hours
    const deadline = new Date(case_.createdAt.getTime() + hours * 60 * 60 * 1000);

    return deadline;
  }

  /**
   * Set SLA deadline for a case
   */
  async setSLADeadline(caseId: string, tenantId: string): Promise<Date> {
    const case_ = await db.case.findFirst({
      where: { id: caseId, tenantId },
    });

    if (!case_) {
      throw new Error("Case not found");
    }

    const deadline = this.calculateSLADeadline(case_);

    await db.case.update({
      where: { id: caseId },
      data: { slaDeadline: deadline },
    });

    logger.info("SLA deadline set", {
      case_id: caseId,
      tenant_id: tenantId,
      deadline: deadline.toISOString(),
    });

    return deadline;
  }

  /**
   * Get SLA metrics for a case
   */
  async getSLAMetrics(caseId: string, tenantId: string): Promise<SLAMetrics | null> {
    const case_ = await db.case.findFirst({
      where: { id: caseId, tenantId },
    });

    if (!case_) {
      return null;
    }

    const deadline = case_.slaDeadline || this.calculateSLADeadline(case_);
    const now = new Date();
    const totalTime = deadline.getTime() - case_.createdAt.getTime();
    const remainingTime = deadline.getTime() - now.getTime();
    const hoursRemaining = remainingTime / (1000 * 60 * 60);
    const percentRemaining = totalTime > 0 ? (remainingTime / totalTime) * 100 : 0;

    let status: "on_track" | "at_risk" | "breached";
    if (remainingTime < 0) {
      status = "breached";
    } else if (percentRemaining < 20) {
      status = "at_risk";
    } else {
      status = "on_track";
    }

    const breachRisk = Math.max(0, Math.min(1, 1 - percentRemaining / 100));

    return {
      caseId,
      slaDeadline: deadline,
      hoursRemaining,
      percentRemaining,
      status,
      breachRisk,
    };
  }

  /**
   * Check SLA compliance for cases
   */
  async checkSLACompliance(tenantId?: string): Promise<{
    onTrack: number;
    atRisk: number;
    breached: number;
  }> {
    const where: any = {
      status: { in: ["SUBMITTED", "TRIAGED", "IN_PROGRESS"] },
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const cases = await db.case.findMany({
      where,
      select: {
        id: true,
        tenantId: true,
        slaDeadline: true,
        createdAt: true,
      },
    });

    let onTrack = 0;
    let atRisk = 0;
    let breached = 0;

    for (const case_ of cases) {
      const metrics = await this.getSLAMetrics(case_.id, case_.tenantId);
      if (!metrics) {
        continue;
      }

      switch (metrics.status) {
        case "on_track":
          onTrack++;
          break;
        case "at_risk":
          atRisk++;
          // Trigger escalation for at-risk cases
          setImmediate(async () => {
            try {
              const fullCase = await db.case.findUnique({ where: { id: case_.id } });
              if (fullCase) {
                await caseEscalationService.checkEscalationRules(fullCase);
              }
            } catch (error) {
              logger.error("Failed to check escalation for at-risk case", {
                case_id: case_.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          });
          break;
        case "breached":
          breached++;
          // Send breach notification
          setImmediate(async () => {
            try {
              const fullCase = await db.case.findUnique({ where: { id: case_.id } });
              if (fullCase && fullCase.submittedByEmail) {
                await caseNotificationsService.sendNotification({
                  caseId: case_.id,
                  recipient: fullCase.submittedByEmail,
                  type: "EMAIL",
                  subject: `URGENT: SLA Breach for Case ${fullCase.caseNumber}`,
                  message: `Your case ${fullCase.caseNumber} has exceeded its SLA deadline. We apologize for the delay and are prioritizing its resolution.`,
                  actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://holdwall.com"}/cases/track/${fullCase.caseNumber}`,
                  actionLabel: "View Case",
                });
              }
            } catch (error) {
              logger.error("Failed to send SLA breach notification", {
                case_id: case_.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          });
          break;
      }
    }

    metrics.gauge("cases.sla.on_track", onTrack, { tenant_id: tenantId || "all" });
    metrics.gauge("cases.sla.at_risk", atRisk, { tenant_id: tenantId || "all" });
    metrics.gauge("cases.sla.breached", breached, { tenant_id: tenantId || "all" });

    logger.info("SLA compliance check completed", {
      tenant_id: tenantId || "all",
      on_track: onTrack,
      at_risk: atRisk,
      breached,
    });

    return { onTrack, atRisk, breached };
  }

  /**
   * Get SLA compliance percentage
   */
  async getSLACompliancePercentage(tenantId: string, days: number = 30): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const resolvedCases = await db.case.findMany({
      where: {
        tenantId,
        status: { in: ["RESOLVED", "CLOSED"] },
        resolvedAt: { gte: startDate },
        slaDeadline: { not: null },
      },
    });

    if (resolvedCases.length === 0) {
      return 100; // No cases to measure
    }

    let compliant = 0;
    for (const case_ of resolvedCases) {
      if (case_.resolvedAt && case_.slaDeadline) {
        if (case_.resolvedAt <= case_.slaDeadline) {
          compliant++;
        }
      }
    }

    const percentage = (compliant / resolvedCases.length) * 100;

    metrics.gauge("cases.sla.compliance_percentage", percentage, {
      tenant_id: tenantId,
      days: days.toString(),
    });

    return Math.round(percentage * 100) / 100;
  }
}

export const caseSLAService = new CaseSLAService();
