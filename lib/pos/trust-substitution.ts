/**
 * Trust Substitution Mechanism (TSM)
 * 
 * POS: Substitutes higher-order trust when distrust arises
 * - Independent audits
 * - Public SLAs
 * - Transparent failure reports
 * - External validators
 * 
 * Replaces emotional outrage with rational evaluation
 */

import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { randomUUID } from "crypto";

const eventStore = new DatabaseEventStore();

export interface ExternalValidatorInput {
  tenantId: string;
  name: string;
  type: "INDEPENDENT_AUDIT" | "CERTIFICATION_BODY" | "EXPERT_PANEL" | "RESEARCH_INSTITUTION" | "STANDARDS_ORGANIZATION";
  description?: string;
  url?: string;
  publicKey?: string;
  trustLevel?: number;
}

export interface AuditInput {
  tenantId: string;
  type: "SECURITY" | "COMPLIANCE" | "OPERATIONAL" | "FINANCIAL" | "QUALITY";
  title: string;
  description?: string;
  auditorId?: string;
  findings?: Record<string, any>;
  recommendations?: Record<string, any>;
}

export interface SLAInput {
  tenantId: string;
  name: string;
  description?: string;
  metric: string;
  target: number;
  unit: string;
  period: "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY";
}

export class TrustSubstitutionMechanism {
  /**
   * Register external validator
   */
  async registerValidator(
    input: ExternalValidatorInput
  ): Promise<string> {
    const validator = await db.externalValidator.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        type: input.type,
        description: input.description,
        url: input.url,
        publicKey: input.publicKey,
        trustLevel: input.trustLevel ?? 0.7,
        isActive: true,
      },
    });

    // Emit event
    await eventStore.append({
      event_id: randomUUID(),
      tenant_id: input.tenantId,
      actor_id: "tsm-service",
      type: "tsm.validator.registered",
      occurred_at: new Date().toISOString(),
      correlation_id: randomUUID(),
      schema_version: "1.0",
      evidence_refs: [] as string[],
      payload: {
        validator_id: validator.id,
        name: input.name,
        type: input.type,
        trust_level: validator.trustLevel,
      },
      signatures: [],
    });

    logger.info("External validator registered", {
      tenantId: input.tenantId,
      validatorId: validator.id,
      name: input.name,
      type: input.type,
    });

    return validator.id;
  }

  /**
   * Create audit
   */
  async createAudit(input: AuditInput): Promise<string> {
    const audit = await db.audit.create({
      data: {
        tenantId: input.tenantId,
        type: input.type,
        title: input.title,
        description: input.description,
        auditorId: input.auditorId,
        status: "PLANNED",
        findings: input.findings as any,
        recommendations: input.recommendations as any,
        evidenceRefs: [],
      },
    });

    // Emit event
    await eventStore.append({
      event_id: randomUUID(),
      tenant_id: input.tenantId,
      actor_id: "tsm-service",
      type: "tsm.audit.created",
      occurred_at: new Date().toISOString(),
      correlation_id: randomUUID(),
      schema_version: "1.0",
      evidence_refs: [],
      payload: {
        audit_id: audit.id,
        type: input.type,
        title: input.title,
      },
      signatures: [],
    });

    logger.info("Audit created", {
      tenantId: input.tenantId,
      auditId: audit.id,
      type: input.type,
    });

    return audit.id;
  }

  /**
   * Complete and publish audit
   */
  async completeAudit(
    auditId: string,
    findings: Record<string, any>,
    recommendations: Record<string, any>,
    publicUrl?: string
  ): Promise<string> {
    const audit = await db.audit.findUnique({
      where: { id: auditId },
      select: { tenantId: true, type: true },
    });

    if (!audit) {
      throw new Error(`Audit ${auditId} not found`);
    }

    const url = publicUrl || `/public/audits/${audit.tenantId}/${auditId}`;

    await db.audit.update({
      where: { id: auditId },
      data: {
        status: "PUBLISHED",
        findings: findings as any,
        recommendations: recommendations as any,
        publishedAt: new Date(),
        publicUrl: url,
        completedAt: new Date(),
      },
    });

    // Emit event
    await eventStore.append({
      event_id: randomUUID(),
      tenant_id: audit.tenantId,
      actor_id: "tsm-service",
      type: "tsm.audit.published",
      occurred_at: new Date().toISOString(),
      correlation_id: randomUUID(),
      schema_version: "1.0",
      evidence_refs: [] as string[],
      payload: {
        audit_id: auditId,
        public_url: url,
      },
      signatures: [],
    });

    metrics.increment("tsm.audits.published", {
      tenant_id: audit.tenantId,
      type: audit.type,
    });

    logger.info("Audit published", {
      auditId,
      publicUrl: url,
    });

    return url;
  }

  /**
   * Create SLA
   */
  async createSLA(input: SLAInput): Promise<string> {
    const sla = await db.sLA.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        description: input.description,
        metric: input.metric,
        target: input.target,
        unit: input.unit,
        period: input.period,
        isPublic: false,
      },
    });

    // Emit event
    await eventStore.append({
      event_id: randomUUID(),
      tenant_id: input.tenantId,
      actor_id: "tsm-service",
      type: "tsm.sla.created",
      occurred_at: new Date().toISOString(),
      correlation_id: randomUUID(),
      schema_version: "1.0",
      evidence_refs: [] as string[],
      payload: {
        sla_id: sla.id,
        name: input.name,
        metric: input.metric,
        target: input.target,
      },
      signatures: [],
    });

    logger.info("SLA created", {
      tenantId: input.tenantId,
      slaId: sla.id,
      name: input.name,
    });

    return sla.id;
  }

  /**
   * Update SLA actual value
   */
  async updateSLAMetric(
    slaId: string,
    actual: number
  ): Promise<void> {
    const sla = await db.sLA.findUnique({
      where: { id: slaId },
      select: { tenantId: true, metric: true, target: true },
    });

    if (!sla) {
      throw new Error(`SLA ${slaId} not found`);
    }

    // Update actual value
    await db.sLA.update({
      where: { id: slaId },
      data: { actual, lastUpdated: new Date() },
    });

    // Check if SLA is met
    const isMet = actual >= sla.target;
    metrics.setGauge("tsm.sla.actual", actual, {
      tenant_id: sla.tenantId,
      metric: sla.metric,
      sla_id: slaId,
    });
    metrics.setGauge("tsm.sla.compliance", isMet ? 1 : 0, {
      tenant_id: sla.tenantId,
      metric: sla.metric,
      sla_id: slaId,
    });

    logger.debug("SLA metric updated", {
      slaId,
      actual,
      target: sla.target,
      isMet,
    });
  }

  /**
   * Publish SLA
   */
  async publishSLA(slaId: string, publicUrl?: string): Promise<string> {
    const sla = await db.sLA.findUnique({
      where: { id: slaId },
      select: { tenantId: true },
    });

    if (!sla) {
      throw new Error(`SLA ${slaId} not found`);
    }

    const url = publicUrl || `/public/slas/${sla.tenantId}/${slaId}`;

    // Update SLA to published
    await db.sLA.update({
      where: { id: slaId },
      data: { isPublic: true, publicUrl: url },
    });

    // Emit event
    await eventStore.append({
      event_id: randomUUID(),
      tenant_id: sla.tenantId,
      actor_id: "tsm-service",
      type: "tsm.sla.published",
      occurred_at: new Date().toISOString(),
      correlation_id: randomUUID(),
      schema_version: "1.0",
      evidence_refs: [] as string[],
      payload: {
        sla_id: slaId,
        public_url: url,
      },
      signatures: [],
    });

    logger.info("SLA published", {
      slaId,
      publicUrl: url,
    });

    return url;
  }

  /**
   * Get trust substitution score
   * Measures how well distrust is substituted with higher-order trust
   */
  async getTrustSubstitutionScore(tenantId: string): Promise<{
    validatorScore: number;
    auditScore: number;
    slaScore: number;
    overallScore: number;
  }> {
    try {
      // Query database for validators, audits, and SLAs
      const [validators, audits, slas] = await Promise.allSettled([
        db.externalValidator.findMany({
          where: { tenantId, isActive: true },
        }),
        db.audit.findMany({
          where: { tenantId, publishedAt: { not: null } },
        }),
        db.sLA.findMany({
          where: { tenantId, isPublic: true },
        }),
      ]);

      const validatorsResult = validators.status === "fulfilled" ? validators.value : [];
      const auditsResult = audits.status === "fulfilled" ? audits.value : [];
      const slasResult = slas.status === "fulfilled" ? slas.value : [];

      // Log any failures
      if (validators.status === "rejected") {
        logger.warn("Failed to fetch external validators", {
          tenantId,
          error: validators.reason instanceof Error ? validators.reason.message : String(validators.reason),
        });
      }
      if (audits.status === "rejected") {
        logger.warn("Failed to fetch audits", {
          tenantId,
          error: audits.reason instanceof Error ? audits.reason.message : String(audits.reason),
        });
      }
      if (slas.status === "rejected") {
        logger.warn("Failed to fetch SLAs", {
          tenantId,
          error: slas.reason instanceof Error ? slas.reason.message : String(slas.reason),
        });
      }

      // Validator score: average trust level (default to 0.5 if no validators)
      const validatorScore = validatorsResult.length > 0
        ? validatorsResult.reduce((sum, v) => sum + (v.trustLevel || 0), 0) / validatorsResult.length
        : 0.5;

      // Audit score: number of published audits
      const auditScore = Math.min(1, auditsResult.length / 3);

      // SLA score: percentage of SLAs meeting targets
      const slaCompliance =
        slasResult.length > 0
          ? slasResult.filter((s) => s.actual !== null && s.actual >= s.target).length /
            slasResult.length
          : 0;
      const slaScore = slaCompliance * 0.7 + (slasResult.length > 0 ? 0.3 : 0);

      // Overall score is weighted average
      const overallScore =
        validatorScore * 0.4 + auditScore * 0.3 + slaScore * 0.3;

      return {
        validatorScore,
        auditScore,
        slaScore,
        overallScore,
      };
    } catch (error) {
      logger.error("Failed to get trust substitution score", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return default scores on error
      return {
        validatorScore: 0.5,
        auditScore: 0,
        slaScore: 0,
        overallScore: 0.5,
      };
    }
  }

  /**
   * Generate trust substitution recommendation
   */
  async generateRecommendation(tenantId: string): Promise<string> {
    const score = await this.getTrustSubstitutionScore(tenantId);

    if (score.overallScore >= 0.7) {
      return "Trust substitution is strong. Continue maintaining validators, audits, and SLAs.";
    }

    const recommendations: string[] = [];

    if (score.validatorScore < 0.6) {
      recommendations.push(
        "Register additional external validators to increase trust level."
      );
    }

    if (score.auditScore < 0.5) {
      recommendations.push(
        "Publish independent audits to demonstrate transparency and accountability."
      );
    }

    if (score.slaScore < 0.6) {
      recommendations.push(
        "Create and publish SLAs with transparent metrics to build trust."
      );
    }

    return recommendations.join(" ") || "No specific recommendations.";
  }
}
