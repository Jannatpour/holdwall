/**
 * Financial Services Escalation Enforcer
 * 
 * Automatically applies escalation rules to claims and signals
 * based on Financial Services operating mode configuration
 */

import { db } from "@/lib/db/client";
import { financialServicesMode, FinancialNarrativeCategory } from "./operating-mode";
import { logger } from "@/lib/logging/logger";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { AlertsService } from "@/lib/alerts/service";
import { randomUUID } from "crypto";
import { metrics } from "@/lib/observability/metrics";

const auditLog = new DatabaseAuditLog();
const eventStore = new DatabaseEventStore();
const alertsService = new AlertsService(eventStore);

export interface EscalationResult {
  requiresEscalation: boolean;
  severity: "high" | "medium" | "low";
  routeTo: string[];
  ruleId?: string;
  autoDowngrade?: boolean;
}

export class FinancialServicesEscalationEnforcer {
  /**
   * Check and apply escalation rules to a claim
   */
  async checkAndEscalateClaim(
    tenantId: string,
    claimId: string,
    claimText: string,
    velocity?: number
  ): Promise<EscalationResult> {
    try {
      const config = await financialServicesMode.getConfig(tenantId);

      if (!config.enabled) {
        return {
          requiresEscalation: false,
          severity: "low",
          routeTo: [],
        };
      }

      // Categorize the claim
      const category = await this.categorizeClaim(claimText, config.narrativeCategories);

      // Check escalation rules
      const escalation = await financialServicesMode.checkEscalation(
        tenantId,
        category,
        claimText,
        velocity
      );

      // If escalation required, create alert or route to appropriate team
      if (escalation.requiresEscalation) {
        await this.createEscalationAlert(tenantId, claimId, claimText, escalation, category);
      }

      // Check for auto-downgrade conditions
      const autoDowngrade = await this.checkAutoDowngrade(tenantId, claimText, config);

      return {
        ...escalation,
        autoDowngrade,
      };
    } catch (error) {
      logger.error("Financial Services escalation check failed", {
        error: error instanceof Error ? error.message : String(error),
        tenantId,
        claimId,
      });
      // Return safe default
      return {
        requiresEscalation: false,
        severity: "low",
        routeTo: [],
      };
    }
  }

  /**
   * Check and apply escalation rules to a signal
   */
  async checkAndEscalateSignal(
    tenantId: string,
    signalId: string,
    signalContent: string,
    velocity?: number
  ): Promise<EscalationResult> {
    try {
      const config = await financialServicesMode.getConfig(tenantId);

      if (!config.enabled) {
        return {
          requiresEscalation: false,
          severity: "low",
          routeTo: [],
        };
      }

      // Categorize the signal
      const category = await this.categorizeClaim(signalContent, config.narrativeCategories);

      // Check escalation rules
      const escalation = await financialServicesMode.checkEscalation(
        tenantId,
        category,
        signalContent,
        velocity
      );

      // If escalation required, create alert
      if (escalation.requiresEscalation) {
        await this.createEscalationAlert(tenantId, signalId, signalContent, escalation, category, "signal");
      }

      return escalation;
    } catch (error) {
      logger.error("Financial Services signal escalation check failed", {
        error: error instanceof Error ? error.message : String(error),
        tenantId,
        signalId,
      });
      return {
        requiresEscalation: false,
        severity: "low",
        routeTo: [],
      };
    }
  }

  /**
   * Categorize claim by financial narrative type
   */
  private async categorizeClaim(
    text: string,
    categories: FinancialNarrativeCategory[]
  ): Promise<FinancialNarrativeCategory> {
    const lowerText = text.toLowerCase();

    // Simple keyword matching (in production, use NLP)
    if (lowerText.includes("scam") || lowerText.includes("fraud")) {
      return "scam_fraud";
    }
    if (lowerText.includes("freeze") || lowerText.includes("frozen") || lowerText.includes("hold")) {
      return "account_freezes";
    }
    if (lowerText.includes("fee") || lowerText.includes("charge") || lowerText.includes("cost")) {
      return "hidden_fees";
    }
    if (lowerText.includes("transaction") && (lowerText.includes("fail") || lowerText.includes("error"))) {
      return "transaction_failures";
    }
    if (lowerText.includes("insurance") && (lowerText.includes("deny") || lowerText.includes("refuse"))) {
      return "insurance_denials";
    }
    if (lowerText.includes("privacy") || lowerText.includes("data") || lowerText.includes("breach")) {
      return "data_privacy";
    }
    if (lowerText.includes("regulator") || lowerText.includes("compliance") || lowerText.includes("violation")) {
      return "regulatory_allegations";
    }
    if (lowerText.includes("outage") || lowerText.includes("down") || lowerText.includes("unavailable")) {
      return "platform_outages";
    }

    // Default
    return "scam_fraud";
  }

  /**
   * Check for auto-downgrade conditions
   */
  private async checkAutoDowngrade(
    tenantId: string,
    text: string,
    config: any
  ): Promise<boolean> {
    for (const rule of config.escalationRules || []) {
      if (!rule.enabled || !rule.autoDowngrade) continue;

      const lowerText = text.toLowerCase();
      const lowerCondition = rule.condition.toLowerCase();

      if (lowerCondition.includes("already resolved") && lowerText.includes("resolved")) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create escalation alert
   */
  private async createEscalationAlert(
    tenantId: string,
    resourceId: string,
    content: string,
    escalation: EscalationResult,
    category: FinancialNarrativeCategory,
    resourceType: "claim" | "signal" = "claim"
  ): Promise<void> {
    try {
      // Get users in the roles that need to be notified
      const routeToRoles = escalation.routeTo.map((r) => r.toUpperCase());
      const users = await db.user.findMany({
        where: {
          tenantId,
          OR: [
            { role: "ADMIN" as any },
            { role: "APPROVER" as any },
          ],
        },
        select: { email: true },
      });

      const recipients = users.map((u) => u.email).filter(Boolean) as string[];

      // Create alert using AlertsService
      const alertId = await alertsService.createAlert(
        tenantId,
        "system",
        escalation.severity === "high" ? "critical" : escalation.severity === "medium" ? "high" : "medium",
        `Financial Services Escalation: ${category}`,
        `High-severity ${category} ${resourceType} requires immediate attention. Route to: ${escalation.routeTo.join(", ")}`,
        [resourceId],
        recipients.length > 0 ? recipients : ["admin@example.com"] // Fallback if no users found
      );

      // Send alert immediately
      await alertsService.sendAlert(alertId);

      // Audit log
      await auditLog.append({
        audit_id: randomUUID(),
        tenant_id: tenantId,
        actor_id: "financial-services-escalation",
        type: "event",
        timestamp: new Date().toISOString(),
        correlation_id: `escalation-${resourceId}-${Date.now()}`,
        causation_id: undefined,
        data: {
          action: "escalation_created",
          alert_id: alertId,
          resource_id: resourceId,
          resource_type: resourceType,
          category,
          severity: escalation.severity,
          route_to: escalation.routeTo,
        } as any,
        evidence_refs: [resourceId],
      });

      // Metrics
      metrics.increment("financial_services_escalation_total", {
        tenantId,
        category,
        severity: escalation.severity,
      });

      logger.info("Financial Services escalation alert created", {
        tenantId,
        alertId,
        resourceId,
        category,
        severity: escalation.severity,
        routeTo: escalation.routeTo,
      });
    } catch (error) {
      logger.error("Failed to create escalation alert", {
        error: error instanceof Error ? error.message : String(error),
        tenantId,
        resourceId,
      });
    }
  }
}

export const escalationEnforcer = new FinancialServicesEscalationEnforcer();
