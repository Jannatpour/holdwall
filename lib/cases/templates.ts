/**
 * Case Templates Service
 * 
 * Handles pre-filled case templates for common issues.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import type { Case, CaseTemplate, CaseType } from "@prisma/client";

export interface CaseTemplateInput {
  tenantId: string;
  name: string;
  type: CaseType;
  description?: string;
  template: {
    description?: string;
    impact?: string;
    preferredResolution?: string;
    evidenceChecklist?: string[];
    defaultSeverity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    defaultPriority?: "P0" | "P1" | "P2" | "P3";
    metadata?: Record<string, unknown>;
  };
}

/**
 * Case Templates Service
 */
export class CaseTemplatesService {
  /**
   * Create case template
   */
  async createTemplate(input: CaseTemplateInput): Promise<CaseTemplate> {
    const template = await db.caseTemplate.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        type: input.type,
        description: input.description,
        template: input.template as any,
      },
    });

    logger.info("Case template created", {
      tenant_id: input.tenantId,
      template_id: template.id,
      name: input.name,
    });

    metrics.increment("case_templates_created_total", {
      tenant_id: input.tenantId,
      type: input.type,
    });

    return template;
  }

  /**
   * Get templates for tenant
   */
  async getTemplates(tenantId: string, type?: CaseType): Promise<CaseTemplate[]> {
    const where: any = { tenantId };
    if (type) {
      where.type = type;
    }

    return await db.caseTemplate.findMany({
      where,
      orderBy: { usageCount: "desc" },
    });
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string, tenantId: string): Promise<CaseTemplate | null> {
    return await db.caseTemplate.findFirst({
      where: {
        id: templateId,
        tenantId,
      },
    });
  }

  /**
   * Create case from template
   */
  async createCaseFromTemplate(
    templateId: string,
    tenantId: string,
    overrides?: {
      submittedBy?: string;
      submittedByEmail?: string;
      submittedByName?: string;
      description?: string;
      impact?: string;
      preferredResolution?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Case> {
    const template = await this.getTemplate(templateId, tenantId);

    if (!template) {
      throw new Error("Template not found");
    }

    const templateData = template.template as {
      description?: string;
      impact?: string;
      preferredResolution?: string;
      evidenceChecklist?: string[];
      defaultSeverity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      defaultPriority?: "P0" | "P1" | "P2" | "P3";
      metadata?: Record<string, unknown>;
    };

    // Generate case number
    const caseNumber = `CASE-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    // Create case
    const case_ = await db.case.create({
      data: {
        tenantId,
        caseNumber,
        type: template.type,
        status: "SUBMITTED",
        severity: (overrides?.metadata?.severity as any) || templateData.defaultSeverity || "MEDIUM",
        priority: (overrides?.metadata?.priority as any) || templateData.defaultPriority || undefined,
        submittedBy: overrides?.submittedBy || "template",
        submittedByEmail: overrides?.submittedByEmail,
        submittedByName: overrides?.submittedByName,
        description: overrides?.description || templateData.description || "",
        impact: overrides?.impact || templateData.impact,
        preferredResolution: overrides?.preferredResolution || templateData.preferredResolution,
        metadata: {
          ...templateData.metadata,
          ...overrides?.metadata,
          templateId: template.id,
          templateName: template.name,
        } as any,
      },
    });

    // Increment template usage count
    await db.caseTemplate.update({
      where: { id: templateId },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });

    logger.info("Case created from template", {
      tenant_id: tenantId,
      case_id: case_.id,
      template_id: templateId,
    });

    metrics.increment("cases_created_from_template_total", {
      tenant_id: tenantId,
      template_id: templateId,
    });

    return case_;
  }

  /**
   * Get default templates (common financial services cases)
   */
  getDefaultTemplates(): Omit<CaseTemplateInput, "tenantId">[] {
    return [
      {
        name: "Unauthorized Transaction",
        type: "FRAUD_ATO",
        description: "Template for unauthorized transaction reports",
        template: {
          description: "I noticed an unauthorized transaction on my account. The transaction details are: [DATE, AMOUNT, MERCHANT]. I did not authorize this transaction.",
          impact: "Financial loss and potential account compromise",
          defaultSeverity: "HIGH",
          defaultPriority: "P1",
          evidenceChecklist: [
            "Transaction statement",
            "Account activity log",
            "Police report (if applicable)",
          ],
        },
      },
      {
        name: "Payment Not Received",
        type: "OUTAGE_DELAY",
        description: "Template for payment delay reports",
        template: {
          description: "I sent a payment on [DATE] but the recipient has not received it. Transaction ID: [TRANSACTION_ID]. Expected delivery: [DATE].",
          impact: "Delayed payment causing inconvenience",
          defaultSeverity: "MEDIUM",
          defaultPriority: "P2",
          evidenceChecklist: [
            "Transaction receipt",
            "Payment confirmation",
            "Communication with recipient",
          ],
        },
      },
      {
        name: "Account Locked",
        type: "COMPLAINT",
        description: "Template for account lock complaints",
        template: {
          description: "My account has been locked and I cannot access my funds. I need immediate assistance to restore access.",
          impact: "Unable to access funds or make transactions",
          defaultSeverity: "HIGH",
          defaultPriority: "P1",
          evidenceChecklist: [
            "Account verification documents",
            "Identity verification",
          ],
        },
      },
      {
        name: "Refund Request",
        type: "DISPUTE",
        description: "Template for refund requests",
        template: {
          description: "I would like to request a refund for transaction [TRANSACTION_ID] dated [DATE] in the amount of $[AMOUNT]. Reason: [REASON].",
          impact: "Financial impact of refund amount",
          defaultSeverity: "MEDIUM",
          defaultPriority: "P2",
          evidenceChecklist: [
            "Transaction receipt",
            "Proof of purchase",
            "Reason for refund",
          ],
        },
      },
      {
        name: "Fee Dispute",
        type: "DISPUTE",
        description: "Template for fee disputes",
        template: {
          description: "I was charged a fee of $[AMOUNT] on [DATE] that I believe is incorrect. Fee type: [FEE_TYPE]. I would like this fee to be reviewed and refunded if applicable.",
          impact: "Financial impact of disputed fee",
          defaultSeverity: "LOW",
          defaultPriority: "P3",
          evidenceChecklist: [
            "Account statement",
            "Fee notification",
            "Terms and conditions",
          ],
        },
      },
    ];
  }

  /**
   * Seed default templates for tenant
   */
  async seedDefaultTemplates(tenantId: string): Promise<CaseTemplate[]> {
    const defaults = this.getDefaultTemplates();
    const templates: CaseTemplate[] = [];

    for (const defaultTemplate of defaults) {
      // Check if template already exists
      const existing = await db.caseTemplate.findFirst({
        where: {
          tenantId,
          name: defaultTemplate.name,
        },
      });

      if (!existing) {
        const template = await this.createTemplate({
          tenantId,
          ...defaultTemplate,
        });
        templates.push(template);
      }
    }

    logger.info("Default templates seeded", {
      tenant_id: tenantId,
      templates_created: templates.length,
    });

    return templates;
  }

  /**
   * Update template
   */
  async updateTemplate(
    templateId: string,
    tenantId: string,
    updates: Partial<CaseTemplateInput>
  ): Promise<CaseTemplate> {
    const updateData: any = {};

    if (updates.name) {
      updateData.name = updates.name;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }
    if (updates.template) {
      updateData.template = updates.template as any;
    }

    return await db.caseTemplate.update({
      where: {
        id: templateId,
        tenantId,
      },
      data: updateData,
    });
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string, tenantId: string): Promise<void> {
    await db.caseTemplate.delete({
      where: {
        id: templateId,
        tenantId,
      },
    });

    logger.info("Case template deleted", {
      tenant_id: tenantId,
      template_id: templateId,
    });
  }
}

export const caseTemplatesService = new CaseTemplatesService();
