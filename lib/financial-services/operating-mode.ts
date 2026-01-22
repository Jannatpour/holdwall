/**
 * Financial Services Operating Mode
 * 
 * Implements the Financial Services playbook with:
 * - Financial-grade governance
 * - Legal approval gates
 * - Higher evidence thresholds
 * - Conservative publishing defaults
 * - Regulatory compliance tracking
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

export interface FinancialServicesConfig {
  enabled: boolean;
  governanceLevel: "standard" | "financial" | "regulated";
  legalApprovalRequired: boolean;
  evidenceThreshold: number; // 0-1, minimum evidence quality required
  conservativePublishing: boolean;
  regulatoryTracking: boolean;
  narrativeCategories: FinancialNarrativeCategory[];
  escalationRules: EscalationRule[];
  day1Completed: boolean;
  day7Completed: boolean;
  day30Completed: boolean;
  onboardingStartedAt?: Date;
  day1CompletedAt?: Date;
  day7CompletedAt?: Date;
  day30CompletedAt?: Date;
}

export type FinancialNarrativeCategory =
  | "scam_fraud"
  | "account_freezes"
  | "hidden_fees"
  | "transaction_failures"
  | "insurance_denials"
  | "data_privacy"
  | "regulatory_allegations"
  | "platform_outages";

export interface EscalationRule {
  id: string;
  name: string;
  condition: string; // e.g., "claim includes 'fraud' + rising velocity"
  severity: "high" | "medium" | "low";
  routeTo: string[]; // ["Risk", "Legal", "Security"]
  autoDowngrade?: string; // e.g., "already resolved"
  enabled: boolean;
}

export class FinancialServicesOperatingMode {
  /**
   * Get or initialize Financial Services configuration for tenant
   */
  async getConfig(tenantId: string): Promise<FinancialServicesConfig> {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const settings = (tenant.settings || {}) as any;
    const fsConfig = settings.financialServices as FinancialServicesConfig | undefined;

    if (fsConfig) {
      return fsConfig;
    }

    // Return default configuration
    return this.getDefaultConfig();
  }

  /**
   * Enable Financial Services operating mode
   */
  async enable(tenantId: string, config?: Partial<FinancialServicesConfig>): Promise<void> {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const currentSettings = (tenant.settings || {}) as any;
    const defaultConfig = this.getDefaultConfig();
    const mergedConfig: FinancialServicesConfig = {
      ...defaultConfig,
      ...config,
      enabled: true,
      onboardingStartedAt: new Date(),
    };

    await db.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...currentSettings,
          financialServices: mergedConfig,
        },
      },
    });

    logger.info("Financial Services operating mode enabled", {
      tenantId,
      governanceLevel: mergedConfig.governanceLevel,
    });

    metrics.increment("financial_services_mode_enabled_total", {
      tenantId,
      governanceLevel: mergedConfig.governanceLevel,
    });
  }

  /**
   * Update configuration
   */
  async updateConfig(
    tenantId: string,
    updates: Partial<FinancialServicesConfig>
  ): Promise<FinancialServicesConfig> {
    const currentConfig = await this.getConfig(tenantId);
    const updatedConfig: FinancialServicesConfig = {
      ...currentConfig,
      ...updates,
    };

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const currentSettings = (tenant.settings || {}) as any;

    await db.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...currentSettings,
          financialServices: updatedConfig,
        },
      },
    });

    logger.info("Financial Services configuration updated", {
      tenantId,
      updates: Object.keys(updates),
    });

    return updatedConfig;
  }

  /**
   * Mark Day 1 as completed
   */
  async completeDay1(tenantId: string): Promise<void> {
    await this.updateConfig(tenantId, {
      day1Completed: true,
      day1CompletedAt: new Date(),
    });

    logger.info("Financial Services Day 1 completed", { tenantId });
    metrics.increment("financial_services_day1_completed_total", { tenantId });
  }

  /**
   * Mark Day 7 as completed
   */
  async completeDay7(tenantId: string): Promise<void> {
    await this.updateConfig(tenantId, {
      day7Completed: true,
      day7CompletedAt: new Date(),
    });

    logger.info("Financial Services Day 7 completed", { tenantId });
    metrics.increment("financial_services_day7_completed_total", { tenantId });
  }

  /**
   * Mark Day 30 as completed
   */
  async completeDay30(tenantId: string): Promise<void> {
    await this.updateConfig(tenantId, {
      day30Completed: true,
      day30CompletedAt: new Date(),
    });

    logger.info("Financial Services Day 30 completed", { tenantId });
    metrics.increment("financial_services_day30_completed_total", { tenantId });
  }

  /**
   * Get current workflow stage
   */
  async getWorkflowStage(tenantId: string): Promise<"day1" | "day7" | "day30" | "complete"> {
    const config = await this.getConfig(tenantId);

    if (!config.enabled) {
      return "day1";
    }

    if (!config.day1Completed) {
      return "day1";
    }

    if (!config.day7Completed) {
      return "day7";
    }

    if (!config.day30Completed) {
      return "day30";
    }

    return "complete";
  }

  /**
   * Check if narrative category requires escalation
   */
  async checkEscalation(
    tenantId: string,
    category: FinancialNarrativeCategory,
    claimText: string,
    velocity?: number
  ): Promise<{
    requiresEscalation: boolean;
    severity: "high" | "medium" | "low";
    routeTo: string[];
  }> {
    const config = await this.getConfig(tenantId);

    if (!config.enabled) {
      return {
        requiresEscalation: false,
        severity: "low",
        routeTo: [],
      };
    }

    // Check escalation rules
    for (const rule of config.escalationRules) {
      if (!rule.enabled) continue;

      // Simple pattern matching (in production, use more sophisticated NLP)
      const conditionMet = this.evaluateCondition(rule.condition, {
        category,
        claimText,
        velocity: velocity || 0,
      });

      if (conditionMet) {
        return {
          requiresEscalation: true,
          severity: rule.severity,
          routeTo: rule.routeTo,
        };
      }
    }

    // Default escalation for high-risk categories
    if (category === "scam_fraud" || category === "regulatory_allegations") {
      return {
        requiresEscalation: true,
        severity: "high",
        routeTo: ["Risk", "Legal"],
      };
    }

    return {
      requiresEscalation: false,
      severity: "low",
      routeTo: [],
    };
  }

  /**
   * Evaluate escalation condition
   */
  private evaluateCondition(
    condition: string,
    context: {
      category: FinancialNarrativeCategory;
      claimText: string;
      velocity: number;
    }
  ): boolean {
    const text = context.claimText.toLowerCase();
    const lowerCondition = condition.toLowerCase();

    // Simple keyword matching (in production, use NLP)
    if (lowerCondition.includes("fraud") && text.includes("fraud")) {
      return true;
    }

    if (lowerCondition.includes("scam") && text.includes("scam")) {
      return true;
    }

    if (lowerCondition.includes("regulator") && text.includes("regulator")) {
      return true;
    }

    if (lowerCondition.includes("data breach") && text.includes("breach")) {
      return true;
    }

    if (lowerCondition.includes("rising velocity") && context.velocity > 10) {
      return true;
    }

    if (lowerCondition.includes("already resolved") && text.includes("resolved")) {
      return true;
    }

    return false;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): FinancialServicesConfig {
    return {
      enabled: false,
      governanceLevel: "financial",
      legalApprovalRequired: true,
      evidenceThreshold: 0.7, // Higher threshold for financial services
      conservativePublishing: true,
      regulatoryTracking: true,
      narrativeCategories: [
        "scam_fraud",
        "account_freezes",
        "hidden_fees",
        "transaction_failures",
        "insurance_denials",
        "data_privacy",
        "regulatory_allegations",
        "platform_outages",
      ],
      escalationRules: [
        {
          id: "fraud-scam-rule",
          name: "Fraud/Scam Escalation",
          condition: "claim includes 'fraud' or 'scam' + rising velocity",
          severity: "high",
          routeTo: ["Risk", "Legal"],
          enabled: true,
        },
        {
          id: "data-breach-rule",
          name: "Data Breach Escalation",
          condition: "topic is 'data breach'",
          severity: "high",
          routeTo: ["Security", "Legal"],
          enabled: true,
        },
        {
          id: "regulator-rule",
          name: "Regulatory Reference",
          condition: "claim references 'regulator'",
          severity: "high",
          routeTo: ["Legal", "Executive"],
          enabled: true,
        },
        {
          id: "resolved-rule",
          name: "Already Resolved",
          condition: "claim indicates 'already resolved'",
          severity: "low",
          routeTo: [],
          autoDowngrade: "downgrade",
          enabled: true,
        },
      ],
      day1Completed: false,
      day7Completed: false,
      day30Completed: false,
    };
  }
}

export const financialServicesMode = new FinancialServicesOperatingMode();
