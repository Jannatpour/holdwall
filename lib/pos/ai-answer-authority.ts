/**
 * AI Answer Authority Layer (AAAL)
 * 
 * POS: Optimizes for being cited by AI systems
 * - Structured rebuttal documents
 * - Transparent metrics dashboards
 * - Public incident explanations
 * - Verifiable operational data
 * 
 * AI systems trust clarity + traceability, not marketing
 */

import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

const eventStore = new DatabaseEventStore();

export interface RebuttalDocumentInput {
  tenantId: string;
  title: string;
  content: string;
  targetClaimId?: string;
  targetNodeId?: string;
  evidenceRefs?: string[];
  structuredData?: Record<string, any>; // Structured data for AI citation
}

export interface IncidentExplanationInput {
  tenantId: string;
  incidentId: string;
  title: string;
  summary: string;
  explanation: string;
  rootCause?: string;
  resolution?: string;
  prevention?: string;
  evidenceRefs?: string[];
}

export interface MetricsDashboardInput {
  tenantId: string;
  name: string;
  description?: string;
  metrics: Array<{
    name: string;
    value: number;
    unit: string;
    target?: number;
    trend?: "up" | "down" | "stable";
  }>;
  refreshInterval?: number; // Seconds
}

export class AIAnswerAuthorityLayer {
  /**
   * Create a structured rebuttal document
   * Designed to be cited by AI systems
   */
  async createRebuttalDocument(
    input: RebuttalDocumentInput
  ): Promise<string> {
    // Generate structured data for AI citation
    const structuredData = input.structuredData || {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: input.title,
      articleBody: input.content,
      datePublished: new Date().toISOString(),
      author: {
        "@type": "Organization",
        name: "Holdwall POS",
      },
      ...(input.targetClaimId && {
        about: {
          "@type": "Claim",
          identifier: input.targetClaimId,
        },
      }),
    };

    const document = await db.rebuttalDocument.create({
      data: {
        tenantId: input.tenantId,
        title: input.title,
        content: input.content,
        targetClaimId: input.targetClaimId,
        targetNodeId: input.targetNodeId,
        evidenceRefs: input.evidenceRefs || [],
        structuredData,
      },
    });

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      actor_id: "aaal-service",
      type: "aaal.rebuttal.created",
      occurred_at: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      schema_version: "1.0",
      evidence_refs: input.evidenceRefs || [],
      payload: {
        document_id: document.id,
        target_claim_id: input.targetClaimId,
        target_node_id: input.targetNodeId,
      },
      signatures: [],
    });

    logger.info("Rebuttal document created", {
      tenantId: input.tenantId,
      documentId: document.id,
      targetClaimId: input.targetClaimId,
    });

    return document.id;
  }

  /**
   * Publish rebuttal document to public URL
   */
  async publishRebuttal(
    documentId: string,
    publicUrl?: string
  ): Promise<string> {
    const document = await db.rebuttalDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Rebuttal document ${documentId} not found`);
    }

    // Generate public URL if not provided
    const url =
      publicUrl ||
      `/public/rebuttals/${document.tenantId}/${documentId}`;

    await db.rebuttalDocument.update({
      where: { id: documentId },
      data: {
        publicUrl: url,
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: document.tenantId,
      actor_id: "aaal-service",
      type: "aaal.rebuttal.published",
      occurred_at: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      schema_version: "1.0",
      evidence_refs: document.evidenceRefs,
      payload: {
        document_id: documentId,
        public_url: url,
      },
      signatures: [],
    });

    metrics.increment("aaal.rebuttals.published", {
      tenant_id: document.tenantId,
    });

    logger.info("Rebuttal document published", {
      documentId,
      publicUrl: url,
    });

    return url;
  }

  /**
   * Create incident explanation
   * Transparent, verifiable explanation of incidents
   */
  async createIncidentExplanation(
    input: IncidentExplanationInput
  ): Promise<string> {
    const explanation = await db.incidentExplanation.create({
      data: {
        tenantId: input.tenantId,
        incidentId: input.incidentId,
        title: input.title,
        summary: input.summary,
        explanation: input.explanation,
        rootCause: input.rootCause,
        resolution: input.resolution,
        prevention: input.prevention,
        evidenceRefs: input.evidenceRefs || [],
      },
    });

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      actor_id: "aaal-service",
      type: "aaal.incident_explanation.created",
      occurred_at: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      schema_version: "1.0",
      evidence_refs: input.evidenceRefs || [],
      payload: {
        explanation_id: explanation.id,
        incident_id: input.incidentId,
      },
      signatures: [],
    });

    logger.info("Incident explanation created", {
      tenantId: input.tenantId,
      explanationId: explanation.id,
      incidentId: input.incidentId,
    });

    return explanation.id;
  }

  /**
   * Publish incident explanation
   */
  async publishIncidentExplanation(
    explanationId: string,
    publicUrl?: string
  ): Promise<string> {
    const explanation = await db.incidentExplanation.findUnique({
      where: { id: explanationId },
    });

    if (!explanation) {
      throw new Error(`Incident explanation ${explanationId} not found`);
    }

    const url =
      publicUrl ||
      `/public/incidents/${explanation.tenantId}/${explanation.incidentId}`;

    await db.incidentExplanation.update({
      where: { id: explanationId },
      data: {
        publicUrl: url,
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: explanation.tenantId,
      actor_id: "aaal-service",
      type: "aaal.incident_explanation.published",
      occurred_at: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      schema_version: "1.0",
      evidence_refs: explanation.evidenceRefs,
      payload: {
        explanation_id: explanationId,
        public_url: url,
      },
      signatures: [],
    });

    logger.info("Incident explanation published", {
      explanationId,
      publicUrl: url,
    });

    return url;
  }

  /**
   * Create transparent metrics dashboard
   */
  async createMetricsDashboard(
    input: MetricsDashboardInput
  ): Promise<string> {
    const dashboard = await db.metricsDashboard.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        description: input.description,
        metrics: input.metrics as any,
        refreshInterval: input.refreshInterval || 3600, // Default 1 hour
      },
    });

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      actor_id: "aaal-service",
      type: "aaal.dashboard.created",
      occurred_at: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      schema_version: "1.0",
      evidence_refs: [],
      payload: {
        dashboard_id: dashboard.id,
        name: input.name,
      },
      signatures: [],
    });

    logger.info("Metrics dashboard created", {
      tenantId: input.tenantId,
      dashboardId: dashboard.id,
    });

    return dashboard.id;
  }

  /**
   * Publish metrics dashboard
   */
  async publishMetricsDashboard(
    dashboardId: string,
    publicUrl?: string
  ): Promise<string> {
    const dashboard = await db.metricsDashboard.findUnique({
      where: { id: dashboardId },
    });

    if (!dashboard) {
      throw new Error(`Metrics dashboard ${dashboardId} not found`);
    }

    const url =
      publicUrl || `/public/metrics/${dashboard.tenantId}/${dashboardId}`;

    await db.metricsDashboard.update({
      where: { id: dashboardId },
      data: {
        publicUrl: url,
        isPublic: true,
        lastRefreshed: new Date(),
      },
    });

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: dashboard.tenantId,
      actor_id: "aaal-service",
      type: "aaal.dashboard.published",
      occurred_at: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      schema_version: "1.0",
      evidence_refs: [],
      payload: {
        dashboard_id: dashboardId,
        public_url: url,
      },
      signatures: [],
    });

    logger.info("Metrics dashboard published", {
      dashboardId,
      publicUrl: url,
    });

    return url;
  }

  /**
   * Get AI citation score
   * Measures how likely AI systems are to cite this content
   */
  async getAICitationScore(
    tenantId: string
  ): Promise<{
    rebuttalScore: number;
    incidentScore: number;
    dashboardScore: number;
    overallScore: number;
  }> {
    try {
      const [rebuttals, incidents, dashboards] = await Promise.allSettled([
        db.rebuttalDocument.findMany({
          where: { tenantId, isPublished: true },
        }),
        db.incidentExplanation.findMany({
          where: { tenantId, isPublished: true },
        }),
        db.metricsDashboard.findMany({
          where: { tenantId, isPublic: true },
        }),
      ]);

      const rebuttalsResult = rebuttals.status === "fulfilled" ? rebuttals.value : [];
      const incidentsResult = incidents.status === "fulfilled" ? incidents.value : [];
      const dashboardsResult = dashboards.status === "fulfilled" ? dashboards.value : [];

      // Log any failures
      if (rebuttals.status === "rejected") {
        logger.warn("Failed to fetch rebuttal documents", {
          tenantId,
          error: rebuttals.reason,
        });
      }
      if (incidents.status === "rejected") {
        logger.warn("Failed to fetch incident explanations", {
          tenantId,
          error: incidents.reason,
        });
      }
      if (dashboards.status === "rejected") {
        logger.warn("Failed to fetch metrics dashboards", {
          tenantId,
          error: dashboards.reason,
        });
      }

      // Score based on published content with structured data
      const rebuttalScore = rebuttalsResult.length > 0
        ? Math.min(1, rebuttalsResult.filter((r) => r.structuredData).length / 5)
        : 0;

      const incidentScore = incidentsResult.length > 0
        ? Math.min(1, incidentsResult.length / 3)
        : 0;

      const dashboardScore = dashboardsResult.length > 0
        ? Math.min(1, dashboardsResult.length / 2)
        : 0;

      // Overall score is weighted average
      const overallScore =
        rebuttalScore * 0.4 + incidentScore * 0.3 + dashboardScore * 0.3;

      return {
        rebuttalScore,
        incidentScore,
        dashboardScore,
        overallScore,
      };
    } catch (error) {
      logger.error("Failed to get AI citation score", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return default scores on error
      return {
        rebuttalScore: 0,
        incidentScore: 0,
        dashboardScore: 0,
        overallScore: 0,
      };
    }
  }
}
