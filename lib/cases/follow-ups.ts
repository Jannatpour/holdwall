/**
 * Case Follow-Ups Service
 * 
 * Handles automated follow-up reminders and customer communication.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { caseNotificationsService } from "./notifications";
import crypto from "crypto";
import type { Case, CaseResolution } from "@prisma/client";

const eventStore = new DatabaseEventStore();

export interface FollowUpRule {
  id: string;
  name: string;
  tenantId: string;
  trigger: FollowUpTrigger;
  delay: number; // Delay in milliseconds
  template: FollowUpTemplate;
  enabled: boolean;
}

export interface FollowUpTrigger {
  type: "missing_evidence" | "customer_action_required" | "resolution_completed" | "case_reopened" | "no_response";
  conditions?: Record<string, unknown>;
}

export interface FollowUpTemplate {
  subject: string;
  message: string;
  type: "EMAIL" | "SMS";
  actionUrl?: string;
  actionLabel?: string;
}

/**
 * Case Follow-Ups Service
 */
export class CaseFollowUpsService {
  /**
   * Check and send follow-ups for cases
   */
  async processFollowUps(tenantId?: string): Promise<number> {
    const rules = await this.getFollowUpRules(tenantId);
    let sentCount = 0;

    for (const rule of rules) {
      if (!rule.enabled) {
        continue;
      }

      const cases = await this.findCasesForFollowUp(rule, tenantId);

      for (const case_ of cases) {
        try {
          await this.sendFollowUp(case_, rule);
          sentCount++;
        } catch (error) {
          logger.error("Failed to send follow-up", {
            case_id: case_.id,
            rule_id: rule.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    logger.info("Follow-ups processed", {
      tenant_id: tenantId,
      rules_processed: rules.length,
      follow_ups_sent: sentCount,
    });

    metrics.increment("case_followups_sent_total", {
      tenant_id: tenantId || "all",
    });

    return sentCount;
  }

  /**
   * Get follow-up rules
   */
  private async getFollowUpRules(tenantId?: string): Promise<FollowUpRule[]> {
    // In production, these would be stored in database
    // For now, return default rules
    return [
      {
        id: "missing-evidence-24h",
        name: "Missing Evidence Reminder (24h)",
        tenantId: tenantId || "default",
        trigger: {
          type: "missing_evidence",
        },
        delay: 24 * 60 * 60 * 1000, // 24 hours
        template: {
          subject: "Action Required: Additional Information Needed for Your Case",
          message: "We need additional information to process your case. Please review the evidence checklist and submit any missing documents.",
          type: "EMAIL",
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://holdwall.com"}/cases/track/{caseNumber}`,
          actionLabel: "View Evidence Checklist",
        },
        enabled: true,
      },
      {
        id: "customer-action-24h",
        name: "Customer Action Required (24h)",
        tenantId: tenantId || "default",
        trigger: {
          type: "customer_action_required",
        },
        delay: 24 * 60 * 60 * 1000, // 24 hours
        template: {
          subject: "Action Required: Please Complete Next Steps",
          message: "Your case requires your attention. Please complete the next steps outlined in your resolution plan.",
          type: "EMAIL",
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://holdwall.com"}/cases/track/{caseNumber}`,
          actionLabel: "View Resolution Plan",
        },
        enabled: true,
      },
      {
        id: "resolution-completed-survey",
        name: "Resolution Completed Satisfaction Survey",
        tenantId: tenantId || "default",
        trigger: {
          type: "resolution_completed",
        },
        delay: 1 * 60 * 60 * 1000, // 1 hour after resolution
        template: {
          subject: "How was your experience?",
          message: "Your case has been resolved. We'd love to hear about your experience. Please take a moment to share your feedback.",
          type: "EMAIL",
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://holdwall.com"}/cases/track/{caseNumber}/feedback`,
          actionLabel: "Share Feedback",
        },
        enabled: true,
      },
      {
        id: "case-reopened-followup",
        name: "Case Reopened Follow-Up",
        tenantId: tenantId || "default",
        trigger: {
          type: "case_reopened",
        },
        delay: 2 * 60 * 60 * 1000, // 2 hours
        template: {
          subject: "Your Case Has Been Reopened",
          message: "Your case has been reopened. We're working on resolving the issue and will keep you updated.",
          type: "EMAIL",
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://holdwall.com"}/cases/track/{caseNumber}`,
          actionLabel: "View Case",
        },
        enabled: true,
      },
      {
        id: "no-response-48h",
        name: "No Response Reminder (48h)",
        tenantId: tenantId || "default",
        trigger: {
          type: "no_response",
        },
        delay: 48 * 60 * 60 * 1000, // 48 hours
        template: {
          subject: "We're Still Here to Help",
          message: "We haven't heard from you regarding your case. If you need assistance or have questions, please don't hesitate to reach out.",
          type: "EMAIL",
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://holdwall.com"}/cases/track/{caseNumber}`,
          actionLabel: "View Case",
        },
        enabled: true,
      },
    ];
  }

  /**
   * Find cases that need follow-up
   */
  private async findCasesForFollowUp(
    rule: FollowUpRule,
    tenantId?: string
  ): Promise<Case[]> {
    const now = new Date();
    const triggerTime = new Date(now.getTime() - rule.delay);

    switch (rule.trigger.type) {
      case "missing_evidence":
        return await this.findCasesWithMissingEvidence(tenantId, triggerTime);
      case "customer_action_required":
        return await this.findCasesRequiringCustomerAction(tenantId, triggerTime);
      case "resolution_completed":
        return await this.findRecentlyResolvedCases(tenantId, triggerTime);
      case "case_reopened":
        return await this.findRecentlyReopenedCases(tenantId, triggerTime);
      case "no_response":
        return await this.findCasesWithNoResponse(tenantId, triggerTime);
      default:
        return [];
    }
  }

  /**
   * Find cases with missing evidence
   */
  private async findCasesWithMissingEvidence(
    tenantId: string | undefined,
    since: Date
  ): Promise<Case[]> {
    const where: any = {
      status: { in: ["SUBMITTED", "TRIAGED", "IN_PROGRESS"] },
      updatedAt: { lte: since },
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const cases = await db.case.findMany({
      where,
      include: {
        resolution: true,
      },
    });

    // Filter cases that have missing evidence
    return cases.filter((case_) => {
      const resolution = case_.resolution as CaseResolution | null;
      if (!resolution) {
        return false;
      }

      const evidenceChecklist = resolution.evidenceChecklist as Record<string, unknown> | null;
      if (!evidenceChecklist || !Array.isArray(evidenceChecklist.items)) {
        return false;
      }

      const missingItems = (evidenceChecklist.items as Array<{ status: string }>).filter(
        (item) => item.status === "missing" || item.status === "pending"
      );

      return missingItems.length > 0;
    });
  }

  /**
   * Find cases requiring customer action
   */
  private async findCasesRequiringCustomerAction(
    tenantId: string | undefined,
    since: Date
  ): Promise<Case[]> {
    const where: any = {
      status: { in: ["TRIAGED", "IN_PROGRESS"] },
      updatedAt: { lte: since },
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const cases = await db.case.findMany({
      where,
      include: {
        resolution: true,
      },
    });

    // Filter cases with resolution plans that require customer action
    return cases.filter((case_) => {
      const resolution = case_.resolution as CaseResolution | null;
      if (!resolution) {
        return false;
      }

      const customerPlan = resolution.customerPlan as Record<string, unknown> | null;
      if (!customerPlan || !Array.isArray(customerPlan.steps)) {
        return false;
      }

      const pendingSteps = (customerPlan.steps as Array<{ status: string }>).filter(
        (step) => step.status === "pending" || step.status === "in_progress"
      );

      return pendingSteps.length > 0;
    });
  }

  /**
   * Find recently resolved cases
   */
  private async findRecentlyResolvedCases(
    tenantId: string | undefined,
    since: Date
  ): Promise<Case[]> {
    const where: any = {
      status: "RESOLVED",
      resolvedAt: { gte: since },
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    return await db.case.findMany({
      where,
    });
  }

  /**
   * Find recently reopened cases
   */
  private async findRecentlyReopenedCases(
    tenantId: string | undefined,
    since: Date
  ): Promise<Case[]> {
    // Cases that were RESOLVED or CLOSED and then changed to another status
    const where: any = {
      status: { in: ["SUBMITTED", "TRIAGED", "IN_PROGRESS"] },
      updatedAt: { gte: since },
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const cases = await db.case.findMany({
      where,
    });

    // Filter cases that have a resolvedAt date (were previously resolved)
    return cases.filter((case_) => case_.resolvedAt !== null);
  }

  /**
   * Find cases with no response
   */
  private async findCasesWithNoResponse(
    tenantId: string | undefined,
    since: Date
  ): Promise<Case[]> {
    const where: any = {
      status: { in: ["SUBMITTED", "TRIAGED", "IN_PROGRESS"] },
      updatedAt: { lte: since },
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const cases = await db.case.findMany({
      where,
      include: {
        comments: {
          where: {
            isInternal: false,
            createdAt: { gte: since },
          },
        },
      },
    });

    // Filter cases with no customer comments since the trigger time
    return cases.filter((case_) => case_.comments.length === 0);
  }

  /**
   * Send follow-up
   */
  private async sendFollowUp(case_: Case, rule: FollowUpRule): Promise<void> {
    if (!case_.submittedByEmail) {
      return;
    }

    // Check if follow-up was already sent for this rule
    const existingNotification = await db.caseNotification.findFirst({
      where: {
        caseId: case_.id,
        recipient: case_.submittedByEmail,
        type: rule.template.type === "EMAIL" ? "EMAIL" : "SMS",
        createdAt: {
          gte: new Date(Date.now() - rule.delay - 60 * 60 * 1000), // Within delay window + 1 hour
        },
      },
    });

    if (existingNotification) {
      return; // Already sent
    }

    // Replace template variables
    const subject = rule.template.subject.replace(/{caseNumber}/g, case_.caseNumber);
    const message = rule.template.message.replace(/{caseNumber}/g, case_.caseNumber);
    const actionUrl = rule.template.actionUrl?.replace(/{caseNumber}/g, case_.caseNumber);

    // Send notification
    await caseNotificationsService.sendNotification({
      caseId: case_.id,
      recipient: case_.submittedByEmail,
      type: rule.template.type,
      subject: rule.template.type === "EMAIL" ? subject : undefined,
      message,
      actionUrl,
      actionLabel: rule.template.actionLabel,
      metadata: {
        followUpRuleId: rule.id,
        followUpRuleName: rule.name,
      },
    });

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: case_.tenantId,
      actor_id: "system",
      type: "case.followup.sent",
      occurred_at: new Date().toISOString(),
      correlation_id: case_.id,
      schema_version: "1.0",
      evidence_refs: [],
      payload: {
        case_id: case_.id,
        rule_id: rule.id,
        rule_name: rule.name,
      },
      signatures: [],
    });

    logger.info("Follow-up sent", {
      tenant_id: case_.tenantId,
      case_id: case_.id,
      rule_id: rule.id,
      type: rule.template.type,
    });
  }

  /**
   * Schedule follow-up for specific case
   */
  async scheduleFollowUp(
    caseId: string,
    ruleId: string,
    delayMs: number
  ): Promise<void> {
    // In production, this would use a job queue (e.g., Bull, BullMQ)
    // For now, we'll store it in metadata and process via cron
    const case_ = await db.case.findUnique({
      where: { id: caseId },
    });

    if (!case_) {
      throw new Error("Case not found");
    }

    const scheduledAt = new Date(Date.now() + delayMs);
    const metadata = (case_.metadata as Record<string, unknown>) || {};
    const followUps = (metadata.followUps as Array<unknown>) || [];

    followUps.push({
      ruleId,
      scheduledAt: scheduledAt.toISOString(),
    });

    await db.case.update({
      where: { id: caseId },
      data: {
        metadata: {
          ...metadata,
          followUps,
        } as any,
      },
    });

    logger.info("Follow-up scheduled", {
      case_id: caseId,
      rule_id: ruleId,
      scheduled_at: scheduledAt.toISOString(),
    });
  }
}

export const caseFollowUpsService = new CaseFollowUpsService();
