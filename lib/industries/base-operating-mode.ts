/**
 * Base Industry Operating Mode
 * 
 * Extensible base class for industry-specific operating modes.
 * Currently implemented: Financial Services
 * Future: Healthcare, Legal, etc.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

export interface BaseIndustryConfig {
  enabled: boolean;
  industry: IndustryType;
  governanceLevel: "standard" | "enhanced" | "regulated";
  legalApprovalRequired: boolean;
  evidenceThreshold: number; // 0-1, minimum evidence quality required
  conservativePublishing: boolean;
  regulatoryTracking: boolean;
  narrativeCategories: string[];
  escalationRules: EscalationRule[];
  workflowMilestones: WorkflowMilestone[];
  onboardingStartedAt?: Date;
}

export type IndustryType = "financial_services" | "healthcare" | "legal" | "general";

export interface EscalationRule {
  id: string;
  name: string;
  condition: string;
  severity: "high" | "medium" | "low";
  routeTo: string[];
  autoDowngrade?: string;
  enabled: boolean;
}

export interface WorkflowMilestone {
  id: string;
  stage: string;
  name: string;
  description: string;
  completed: boolean;
  completedAt?: Date;
  requiredActions: string[];
  completedActions: string[];
}

export abstract class BaseIndustryOperatingMode<T extends BaseIndustryConfig> {
  protected abstract industryType: IndustryType;
  protected abstract defaultConfig(): T;

  /**
   * Get or initialize industry configuration for tenant
   */
  async getConfig(tenantId: string): Promise<T> {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const settings = (tenant.settings || {}) as any;
    const industryConfig = settings[this.industryType] as T | undefined;

    if (industryConfig) {
      return industryConfig;
    }

    return this.defaultConfig();
  }

  /**
   * Enable industry operating mode
   */
  async enable(tenantId: string, config?: Partial<T>): Promise<void> {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const currentSettings = (tenant.settings || {}) as any;
    const defaultConfig = this.defaultConfig();
    const mergedConfig: T = {
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
          [this.industryType]: mergedConfig,
        },
      },
    });

    logger.info(`${this.industryType} operating mode enabled`, {
      tenantId,
      governanceLevel: mergedConfig.governanceLevel,
    });

    metrics.increment(`${this.industryType}_mode_enabled_total`, {
      tenantId,
      governanceLevel: mergedConfig.governanceLevel,
    });
  }

  /**
   * Update configuration
   */
  async updateConfig(tenantId: string, updates: Partial<T>): Promise<T> {
    const currentConfig = await this.getConfig(tenantId);
    const updatedConfig: T = {
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
          [this.industryType]: updatedConfig,
        },
      },
    });

    logger.info(`${this.industryType} configuration updated`, {
      tenantId,
      updates: Object.keys(updates),
    });

    return updatedConfig;
  }

  /**
   * Check if narrative category requires escalation
   */
  abstract checkEscalation(
    tenantId: string,
    category: string,
    claimText: string,
    velocity?: number
  ): Promise<{
    requiresEscalation: boolean;
    severity: "high" | "medium" | "low";
    routeTo: string[];
  }>;

  /**
   * Get industry-specific narrative categories
   */
  abstract getNarrativeCategories(): string[];

  /**
   * Get industry-specific escalation rules
   */
  abstract getEscalationRules(): EscalationRule[];
}
