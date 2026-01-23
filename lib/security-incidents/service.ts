/**
 * Security Incident Narrative Management Service
 * 
 * Manages security incidents and their narrative governance:
 * - Incident ingestion from security tools (SIEM, SOAR, etc.)
 * - Narrative risk assessment
 * - AI-governed incident explanation generation
 * - AI citation tracking
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { ForecastService } from "@/lib/forecasts/service";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseBeliefGraphService } from "@/lib/graph/belief-implementation";
import { NarrativePreemptionEngine } from "@/lib/pos/narrative-preemption";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { AAALStudioService } from "@/lib/aaal/studio";
import { SecurityIncidentForecasting } from "./forecasting";
import { AIAnswerScraper } from "@/lib/monitoring/ai-answer-scraper";
import type { 
  SecurityIncident, 
  SecurityIncidentType, 
  SecurityIncidentSeverity, 
  SecurityIncidentStatus 
} from "@prisma/client";

export interface SecurityIncidentInput {
  externalId?: string;
  title: string;
  description: string;
  type: SecurityIncidentType;
  severity: SecurityIncidentSeverity;
  detectedAt: Date;
  source?: string;
  sourceMetadata?: Record<string, unknown>;
  evidenceRefs?: string[];
}

export interface NarrativeRiskAssessment {
  narrativeRiskScore: number; // 0-1
  outbreakProbability: number; // 0-1
  recommendedActions: string[];
  urgencyLevel: "low" | "medium" | "high" | "critical";
}

export interface IncidentExplanationDraft {
  title: string;
  summary: string;
  explanation: string;
  rootCause?: string;
  resolution?: string;
  prevention?: string;
  evidenceRefs: string[];
  structuredData?: Record<string, unknown>; // JSON-LD for AI citation
}

export class SecurityIncidentService {
  private forecastService: ForecastService;
  private preemptionEngine: NarrativePreemptionEngine;
  private evidenceVault: DatabaseEvidenceVault;
  private aaalStudio: AAALStudioService;
  private incidentForecasting: SecurityIncidentForecasting;
  private aiAnswerScraper: AIAnswerScraper;

  constructor() {
    const eventStore = new DatabaseEventStore();
    const beliefGraph = new DatabaseBeliefGraphService();
    this.forecastService = new ForecastService(eventStore, beliefGraph as any);
    this.preemptionEngine = new NarrativePreemptionEngine();
    this.evidenceVault = new DatabaseEvidenceVault();
    this.aaalStudio = new AAALStudioService(this.evidenceVault, eventStore);
    this.incidentForecasting = new SecurityIncidentForecasting();
    this.aiAnswerScraper = new AIAnswerScraper();
  }

  /**
   * Create or update security incident
   */
  async createIncident(
    tenantId: string,
    input: SecurityIncidentInput
  ): Promise<SecurityIncident> {
    // Check if incident already exists by externalId
    let incident: SecurityIncident | null = null;
    if (input.externalId) {
      incident = await db.securityIncident.findFirst({
        where: {
          tenantId,
          externalId: input.externalId,
        },
      });
    }

    if (incident) {
      // Update existing incident
      incident = await db.securityIncident.update({
        where: { id: incident.id },
        data: {
          title: input.title,
          description: input.description,
          type: input.type,
          severity: input.severity,
          source: input.source,
          sourceMetadata: input.sourceMetadata as any,
          evidenceRefs: input.evidenceRefs || [],
          updatedAt: new Date(),
        },
      });
      logger.info("Security incident updated", {
        tenant_id: tenantId,
        incident_id: incident.id,
        external_id: input.externalId,
      });
    } else {
      // Create new incident
      incident = await db.securityIncident.create({
        data: {
          tenantId,
          externalId: input.externalId,
          title: input.title,
          description: input.description,
          type: input.type,
          severity: input.severity,
          detectedAt: input.detectedAt,
          source: input.source,
          sourceMetadata: input.sourceMetadata as any,
          evidenceRefs: input.evidenceRefs || [],
          status: "OPEN",
        },
      });
      logger.info("Security incident created", {
        tenant_id: tenantId,
        incident_id: incident.id,
        type: input.type,
        severity: input.severity,
      });
    }

    metrics.increment("security_incidents_created", {
      tenant_id: tenantId,
      type: input.type,
      severity: input.severity,
    });

    // Automatically assess narrative risk
    await this.assessNarrativeRisk(tenantId, incident.id);

    return incident;
  }

  /**
   * Assess narrative risk for a security incident
   */
  async assessNarrativeRisk(
    tenantId: string,
    incidentId: string
  ): Promise<NarrativeRiskAssessment> {
    const incident = await db.securityIncident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new Error("Security incident not found");
    }

    // Use security incident forecasting for enhanced prediction
    const forecast = await this.incidentForecasting.forecastNarrativeOutbreak(
      tenantId,
      incidentId,
      incident.type,
      incident.severity
    );

    const narrativeRiskScore = forecast.narrativeRiskScore;
    const outbreakProbability = forecast.outbreakProbability;

    // Determine urgency from forecast
    let urgencyLevel: "low" | "medium" | "high" | "critical" = "low";
    if (narrativeRiskScore >= 0.8) {
      urgencyLevel = "critical";
    } else if (narrativeRiskScore >= 0.6) {
      urgencyLevel = "high";
    } else if (narrativeRiskScore >= 0.4) {
      urgencyLevel = "medium";
    }

    // Use recommended actions from forecast
    const recommendedActions = forecast.recommendedActions;

    // Update incident with risk assessment
    await db.securityIncident.update({
      where: { id: incidentId },
      data: {
        narrativeRiskScore,
        outbreakProbability,
      },
    });

    const assessment: NarrativeRiskAssessment = {
      narrativeRiskScore,
      outbreakProbability,
      recommendedActions,
      urgencyLevel,
    };

    logger.info("Narrative risk assessed for security incident", {
      tenant_id: tenantId,
      incident_id: incidentId,
      narrative_risk_score: narrativeRiskScore,
      outbreak_probability: outbreakProbability,
      urgency: urgencyLevel,
    });

    metrics.gauge("security_incident_narrative_risk", narrativeRiskScore, {
      tenant_id: tenantId,
      incident_id: incidentId,
      type: incident.type,
      severity: incident.severity,
    });

    return assessment;
  }

  /**
   * Generate AI-governed incident explanation
   */
  async generateIncidentExplanation(
    tenantId: string,
    incidentId: string,
    options?: {
      includeRootCause?: boolean;
      includeResolution?: boolean;
      includePrevention?: boolean;
    }
  ): Promise<IncidentExplanationDraft> {
    const incident = await db.securityIncident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new Error("Security incident not found");
    }

    // Get evidence bundles
    const evidenceRefs = incident.evidenceRefs || [];
    const evidenceResults = await Promise.all(
      evidenceRefs.map((ref) => this.evidenceVault.get(ref))
    );
    const evidenceBundles = evidenceResults.filter((e): e is NonNullable<typeof e> => e !== null);

    // Use AI to generate explanation
    const prompt = this.buildExplanationPrompt(incident, evidenceBundles, options);
    
    // Use LLM provider to generate explanation
    const { LLMProvider } = await import("@/lib/llm/providers");
    const llmProvider = new LLMProvider();
    const modelResponse = await llmProvider.call({
      model: "gpt-4o", // Use GPT-4 for high-quality explanations
      prompt,
      system_prompt: "You are an expert security incident communicator. Generate clear, factual, and transparent explanations for security incidents. Format your response as JSON with keys: title, summary, explanation, rootCause (optional), resolution (optional), prevention (optional).",
      temperature: 0.3, // Lower temperature for factual accuracy
      max_tokens: 2000,
    });

    // Parse AI response into structured explanation
    const explanation = this.parseExplanationResponse(
      modelResponse.text || "",
      incident,
      options
    );

    // Add structured data for AI citation (JSON-LD)
    explanation.structuredData = {
      "@context": "https://schema.org",
      "@type": "Report",
      headline: explanation.title,
      description: explanation.summary,
      datePublished: new Date().toISOString(),
      author: {
        "@type": "Organization",
        name: "Security Team",
      },
      about: {
        "@type": "Thing",
        name: incident.title,
        description: incident.description,
      },
      evidence: evidenceRefs.map((ref) => ({
        "@type": "Evidence",
        identifier: ref,
      })),
    };

    logger.info("Incident explanation generated", {
      tenant_id: tenantId,
      incident_id: incidentId,
      has_root_cause: !!explanation.rootCause,
      has_resolution: !!explanation.resolution,
    });

    return explanation;
  }

  /**
   * Create and publish incident explanation
   */
  async createAndPublishExplanation(
    tenantId: string,
    incidentId: string,
    draft: IncidentExplanationDraft,
    autopilotMode: "RECOMMEND_ONLY" | "AUTO_DRAFT" | "AUTO_ROUTE" | "AUTO_PUBLISH" = "AUTO_ROUTE"
  ): Promise<{ explanationId: string; published: boolean }> {
    const incident = await db.securityIncident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new Error("Security incident not found");
    }

    // Create incident explanation
    const explanation = await db.incidentExplanation.create({
      data: {
        tenantId,
        securityIncidentId: incidentId,
        title: draft.title,
        summary: draft.summary,
        explanation: draft.explanation,
        rootCause: draft.rootCause,
        resolution: draft.resolution,
        prevention: draft.prevention,
        evidenceRefs: draft.evidenceRefs,
        metadata: draft.structuredData as any,
        isPublished: false,
      },
    });

    // Create AAAL artifact for AI citation
    const artifactId = await this.aaalStudio.createDraft(
      tenantId,
      draft.title,
      draft.explanation,
      draft.evidenceRefs
    );

    // Update incident with explanation reference
    await db.securityIncident.update({
      where: { id: incidentId },
      data: {
        explanationId: explanation.id,
      },
    });

    // Handle publishing based on autopilot mode
    let published = false;
    if (autopilotMode === "AUTO_PUBLISH") {
      // Auto-publish (requires policy checks)
      const canPublish = await this.checkPublishingPolicy(tenantId, explanation.id);
      if (canPublish) {
        await this.publishExplanation(tenantId, explanation.id);
        published = true;
      }
    } else if (autopilotMode === "AUTO_ROUTE") {
      // Auto-route to approvals
      await this.routeToApprovals(tenantId, explanation.id, artifactId);
    }
    // AUTO_DRAFT and RECOMMEND_ONLY don't publish

    logger.info("Incident explanation created", {
      tenant_id: tenantId,
      incident_id: incidentId,
      explanation_id: explanation.id,
      artifact_id: artifactId,
      published,
      autopilot_mode: autopilotMode,
    });

    return {
      explanationId: explanation.id,
      published,
    };
  }

  /**
   * Track AI citation for incident explanation
   */
  async trackAICitation(
    tenantId: string,
    incidentId: string
  ): Promise<{ citationRate: number; citations: Array<{ source: string; timestamp: Date }> }> {
    const incident = await db.securityIncident.findUnique({
      where: { id: incidentId },
      include: { 
        explanation: {
          select: {
            id: true,
            title: true,
            summary: true,
            publicUrl: true,
            isPublished: true,
            publishedAt: true,
          },
        },
      },
    });

    if (!incident || !incident.explanation) {
      throw new Error("Security incident or explanation not found");
    }

    // Build queries to check if AI systems cite this incident explanation
    const explanationUrl = incident.explanation.publicUrl || null;
    const incidentTitle = incident.title;
    const queries = [
      `${incidentTitle} security incident`,
      `${incidentTitle} explanation`,
      `What happened with ${incidentTitle}?`,
    ];

    const citations: Array<{ source: string; timestamp: Date }> = [];
    let citationCount = 0;
    const totalQueries = queries.length;

    try {
      // Query multiple AI engines to check for citations
      const engines: Array<"perplexity" | "gemini" | "claude"> = ["perplexity", "gemini"];
      
      for (const query of queries) {
        try {
          const answers = await this.aiAnswerScraper.queryMultipleEngines(query, engines);
          
          for (const answer of answers) {
            // Check if the answer contains citations that match our explanation URL
            if (explanationUrl && answer.citations) {
              let hostname: string | null = null;
              try {
                hostname = new URL(explanationUrl).hostname;
              } catch {
                // Invalid URL, skip hostname matching
              }
              
              const matchingCitations = answer.citations.filter(
                (citation) => citation.url === explanationUrl || 
                citation.url.includes(explanationUrl) ||
                (hostname && citation.url.includes(hostname))
              );
              
              if (matchingCitations.length > 0) {
                citationCount++;
                citations.push({
                  source: answer.engine,
                  timestamp: new Date(answer.timestamp),
                });
              }
            }
            
            // Also check if the answer text mentions the incident or explanation
            const answerText = answer.answer.toLowerCase();
            const mentionsIncident = answerText.includes(incidentTitle.toLowerCase()) ||
              answerText.includes(incident.type.toLowerCase());
            
            if (mentionsIncident && answer.citations && answer.citations.length > 0) {
              // If incident is mentioned and there are citations, count as potential citation
              citationCount += 0.5; // Partial credit for mentions with citations
            }
          }
        } catch (error) {
          logger.warn("Failed to query AI engine for citation tracking", {
            error: error instanceof Error ? error.message : String(error),
            query,
            incident_id: incidentId,
          });
        }
      }

      // Calculate citation rate (0-1) based on queries that returned citations
      const citationRate = totalQueries > 0 
        ? Math.min(1, citationCount / totalQueries)
        : 0;

      // Update incident with citation rate
      await db.securityIncident.update({
        where: { id: incidentId },
        data: {
          aiCitationRate: citationRate,
        },
      });

      logger.info("AI citation tracked for security incident", {
        tenant_id: tenantId,
        incident_id: incidentId,
        citation_rate: citationRate,
        citation_count: citations.length,
        total_queries: totalQueries,
      });

      metrics.gauge("security_incident_ai_citation_rate", citationRate, {
        tenant_id: tenantId,
        incident_id: incidentId,
        type: incident.type,
      });

      return {
        citationRate,
        citations,
      };
    } catch (error) {
      logger.error("Error tracking AI citation", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        tenant_id: tenantId,
        incident_id: incidentId,
      });
      
      // Return zero citation rate on error, but don't fail the request
      return {
        citationRate: 0,
        citations: [],
      };
    }
  }

  /**
   * Get security incidents for tenant
   */
  async getIncidents(
    tenantId: string,
    filters?: {
      type?: SecurityIncidentType;
      severity?: SecurityIncidentSeverity;
      status?: SecurityIncidentStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<SecurityIncident[]> {
    const incidents = await db.securityIncident.findMany({
      where: {
        tenantId,
        ...(filters?.type && { type: filters.type }),
        ...(filters?.severity && { severity: filters.severity }),
        ...(filters?.status && { status: filters.status }),
      },
      orderBy: {
        detectedAt: "desc",
      },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
      include: {
        explanation: true,
      },
    });

    return incidents;
  }

  /**
   * Get security incident by ID
   */
  async getIncident(
    tenantId: string,
    incidentId: string
  ): Promise<SecurityIncident | null> {
    return db.securityIncident.findFirst({
      where: {
        id: incidentId,
        tenantId,
      },
      include: {
        explanation: true,
      },
    });
  }

  /**
   * Update incident status
   */
  async updateStatus(
    tenantId: string,
    incidentId: string,
    status: SecurityIncidentStatus,
    resolvedAt?: Date
  ): Promise<SecurityIncident> {
    const incident = await db.securityIncident.update({
      where: {
        id: incidentId,
        tenantId,
      },
      data: {
        status,
        ...(resolvedAt && { resolvedAt }),
      },
    });

    logger.info("Security incident status updated", {
      tenant_id: tenantId,
      incident_id: incidentId,
      status,
    });

    return incident;
  }

  // Private helper methods

  private buildExplanationPrompt(
    incident: SecurityIncident,
    evidenceBundles: any[],
    options?: {
      includeRootCause?: boolean;
      includeResolution?: boolean;
      includePrevention?: boolean;
    }
  ): string {
    let prompt = `Generate a clear, factual, and transparent explanation for a security incident.

Incident Details:
- Type: ${incident.type}
- Severity: ${incident.severity}
- Title: ${incident.title}
- Description: ${incident.description}
- Detected: ${incident.detectedAt.toISOString()}

Evidence Available: ${evidenceBundles.length} evidence bundles

Requirements:
1. Be transparent and factual
2. Avoid speculation
3. Focus on what is known
4. Use evidence to support claims
5. Maintain trust through honesty

Generate an explanation that includes:
- Summary (2-3 sentences)
- Detailed explanation
${options?.includeRootCause ? "- Root cause analysis\n" : ""}
${options?.includeResolution ? "- Resolution steps taken\n" : ""}
${options?.includePrevention ? "- Prevention measures\n" : ""}

Format as JSON with keys: title, summary, explanation, rootCause (optional), resolution (optional), prevention (optional)`;

    return prompt;
  }

  private parseExplanationResponse(
    response: string,
    incident: SecurityIncident,
    options?: {
      includeRootCause?: boolean;
      includeResolution?: boolean;
      includePrevention?: boolean;
    }
  ): IncidentExplanationDraft {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response);
      return {
        title: parsed.title || `Security Incident: ${incident.title}`,
        summary: parsed.summary || "",
        explanation: parsed.explanation || "",
        rootCause: options?.includeRootCause ? parsed.rootCause : undefined,
        resolution: options?.includeResolution ? parsed.resolution : undefined,
        prevention: options?.includePrevention ? parsed.prevention : undefined,
        evidenceRefs: incident.evidenceRefs || [],
      };
    } catch {
      // If not JSON, treat as plain text
      return {
        title: `Security Incident: ${incident.title}`,
        summary: response.substring(0, 200) + "...",
        explanation: response,
        rootCause: options?.includeRootCause ? undefined : undefined,
        resolution: options?.includeResolution ? undefined : undefined,
        prevention: options?.includePrevention ? undefined : undefined,
        evidenceRefs: incident.evidenceRefs || [],
      };
    }
  }

  private async checkPublishingPolicy(
    tenantId: string,
    explanationId: string
  ): Promise<boolean> {
    // Check if explanation meets publishing policy requirements
    // This would integrate with the policy engine
    // For now, return true for high-severity incidents that need immediate communication
    const explanation = await db.incidentExplanation.findUnique({
      where: { id: explanationId },
      include: {
        securityIncident: true,
      },
    });

    if (!explanation?.securityIncident) {
      return false;
    }

    // High-severity incidents may auto-publish if policy allows
    return explanation.securityIncident.severity === "CRITICAL";
  }

  private async publishExplanation(
    tenantId: string,
    explanationId: string
  ): Promise<void> {
    await db.incidentExplanation.update({
      where: { id: explanationId },
      data: {
        isPublished: true,
        publishedAt: new Date(),
        publicUrl: `/padl/incidents/${explanationId}`, // PADL URL
      },
    });

    logger.info("Incident explanation published", {
      tenant_id: tenantId,
      explanation_id: explanationId,
    });
  }

  private async routeToApprovals(
    tenantId: string,
    explanationId: string,
    artifactId: string
  ): Promise<void> {
    // Create approval request
    // This would integrate with the approval system
    // For now, log the action
    logger.info("Incident explanation routed to approvals", {
      tenant_id: tenantId,
      explanation_id: explanationId,
      artifact_id: artifactId,
    });
  }
}
