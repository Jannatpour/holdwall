/**
 * Decision Funnel Domination (DFD)
 * 
 * POS: Controls every decision checkpoint
 * - Awareness: Narrative framing
 * - Research: AI summaries
 * - Comparison: Third-party validators
 * - Decision: Proof dashboards
 * - Post-purchase: Reinforcement loops
 * 
 * Negative content never becomes decisive
 */

import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { ConsensusHijackingService } from "./consensus-hijacking";
import { TrustSubstitutionMechanism } from "./trust-substitution";
import { AIAnswerAuthorityLayer } from "./ai-answer-authority";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

const eventStore = new DatabaseEventStore();
const consensusService = new ConsensusHijackingService();
const trustService = new TrustSubstitutionMechanism();
const aaalService = new AIAnswerAuthorityLayer();

export interface DecisionCheckpointInput {
  tenantId: string;
  stage: "AWARENESS" | "RESEARCH" | "COMPARISON" | "DECISION" | "POST_PURCHASE";
  checkpointId: string;
  name: string;
  description?: string;
  controlType: "NARRATIVE_FRAMING" | "AI_SUMMARY" | "THIRD_PARTY_VALIDATOR" | "PROOF_DASHBOARD" | "REINFORCEMENT_LOOP";
  content: Record<string, any>;
  metrics?: Record<string, any>;
}

export interface FunnelMetrics {
  awarenessControl: number; // 0-1
  researchControl: number;
  comparisonControl: number;
  decisionControl: number;
  postPurchaseControl: number;
  overallControl: number;
}

export class DecisionFunnelDomination {
  /**
   * Create decision checkpoint
   */
  async createCheckpoint(
    input: DecisionCheckpointInput
  ): Promise<string> {
    const checkpoint = await db.decisionCheckpoint.create({
      data: {
        tenantId: input.tenantId,
        stage: input.stage,
        checkpointId: input.checkpointId,
        name: input.name,
        description: input.description,
        controlType: input.controlType,
        content: input.content as any,
        metrics: input.metrics as any,
        isActive: true,
      },
    });

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      actor_id: "dfd-service",
      type: "dfd.checkpoint.created",
      occurred_at: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      schema_version: "1.0",
      evidence_refs: [],
      payload: {
        checkpoint_id: checkpoint.id,
        stage: input.stage,
        control_type: input.controlType,
      },
      signatures: [],
    });

    logger.info("Decision checkpoint created", {
      tenantId: input.tenantId,
      checkpointId: checkpoint.id,
      stage: input.stage,
    });

    return checkpoint.id;
  }

  /**
   * Get control content for a decision stage
   */
  async getControlContent(
    tenantId: string,
    stage: DecisionCheckpointInput["stage"]
  ): Promise<Record<string, any> | null> {
    const checkpoint = await db.decisionCheckpoint.findFirst({
      where: {
        tenantId,
        stage,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!checkpoint) {
      return null;
    }

    // Enhance content based on control type
    const enhancedContent = await this.enhanceControlContent(
      tenantId,
      checkpoint.controlType,
      checkpoint.content as Record<string, any>
    );

    return enhancedContent;
  }

  /**
   * Enhance control content with real data
   */
  private async enhanceControlContent(
    tenantId: string,
    controlType: DecisionCheckpointInput["controlType"],
    baseContent: Record<string, any>
  ): Promise<Record<string, any>> {
    switch (controlType) {
      case "NARRATIVE_FRAMING":
        // Add consensus signals
        const consensusMetrics = await consensusService.getConsensusMetrics(
          tenantId
        );
        return {
          ...baseContent,
          consensus: {
            strength: consensusMetrics.consensusStrength,
            signals: consensusMetrics.totalSignals,
          },
        };

      case "AI_SUMMARY":
        // Add AI citation score
        const citationScore = await aaalService.getAICitationScore(tenantId);
        return {
          ...baseContent,
          aiCitationScore: citationScore.overallScore,
          authoritativeSources: citationScore.overallScore > 0.7,
        };

      case "THIRD_PARTY_VALIDATOR":
        // Add validators
        const validators = await db.externalValidator.findMany({
          where: { tenantId, isActive: true },
          take: 5,
        });
        return {
          ...baseContent,
          validators: validators.map((v) => ({
            name: v.name,
            type: v.type,
            trustLevel: v.trustLevel,
          })),
        };

      case "PROOF_DASHBOARD":
        // Add SLA metrics
        const slas = await db.sLA.findMany({
          where: { tenantId, isPublic: true },
          take: 5,
        });
        return {
          ...baseContent,
          slas: slas.map((s) => ({
            name: s.name,
            metric: s.metric,
            target: s.target,
            actual: s.actual,
            unit: s.unit,
            compliance: s.actual !== null && s.actual >= s.target,
          })),
        };

      case "REINFORCEMENT_LOOP":
        // Add trust substitution score
        const trustScore = await trustService.getTrustSubstitutionScore(
          tenantId
        );
        return {
          ...baseContent,
          trustScore: trustScore.overallScore,
          trustLevel: trustScore.overallScore > 0.7 ? "high" : "medium",
        };

      default:
        return baseContent;
    }
  }

  /**
   * Get funnel metrics
   */
  async getFunnelMetrics(tenantId: string): Promise<FunnelMetrics> {
    try {
      const checkpoints = await db.decisionCheckpoint.findMany({
        where: { tenantId, isActive: true },
      });

    // Calculate control for each stage
    const awarenessCheckpoints = checkpoints.filter(
      (c) => c.stage === "AWARENESS"
    );
    const researchCheckpoints = checkpoints.filter(
      (c) => c.stage === "RESEARCH"
    );
    const comparisonCheckpoints = checkpoints.filter(
      (c) => c.stage === "COMPARISON"
    );
    const decisionCheckpoints = checkpoints.filter(
      (c) => c.stage === "DECISION"
    );
    const postPurchaseCheckpoints = checkpoints.filter(
      (c) => c.stage === "POST_PURCHASE"
    );

    // Control score = presence of checkpoint (1.0) + quality metrics
    const awarenessControl =
      awarenessCheckpoints.length > 0
        ? Math.min(1, 0.7 + awarenessCheckpoints.length * 0.1)
        : 0;
    const researchControl =
      researchCheckpoints.length > 0
        ? Math.min(1, 0.7 + researchCheckpoints.length * 0.1)
        : 0;
    const comparisonControl =
      comparisonCheckpoints.length > 0
        ? Math.min(1, 0.7 + comparisonCheckpoints.length * 0.1)
        : 0;
    const decisionControl =
      decisionCheckpoints.length > 0
        ? Math.min(1, 0.7 + decisionCheckpoints.length * 0.1)
        : 0;
    const postPurchaseControl =
      postPurchaseCheckpoints.length > 0
        ? Math.min(1, 0.7 + postPurchaseCheckpoints.length * 0.1)
        : 0;

    // Overall control is average
    const overallControl =
      (awarenessControl +
        researchControl +
        comparisonControl +
        decisionControl +
        postPurchaseControl) /
      5;

    const funnelMetrics: FunnelMetrics = {
      awarenessControl,
      researchControl,
      comparisonControl,
      decisionControl,
      postPurchaseControl,
      overallControl,
    };

    // Emit metrics
    Object.entries(funnelMetrics).forEach(([key, value]) => {
      if (typeof value === "number") {
        metrics.setGauge(`dfd.${key}`, value, { tenant_id: tenantId });
      }
    });

    return funnelMetrics;
    } catch (error) {
      logger.error("Failed to get funnel metrics", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return default metrics on error
      return {
        awarenessControl: 0,
        researchControl: 0,
        comparisonControl: 0,
        decisionControl: 0,
        postPurchaseControl: 0,
        overallControl: 0,
      };
    }
  }

  /**
   * Setup complete funnel control
   */
  async setupCompleteFunnel(tenantId: string): Promise<string[]> {
    const checkpointIds: string[] = [];

    // 1. Awareness: Narrative framing
    const awarenessId = await this.createCheckpoint({
      tenantId,
      stage: "AWARENESS",
      checkpointId: "awareness-narrative",
      name: "Awareness Narrative Framing",
      description: "Controls narrative framing at awareness stage",
      controlType: "NARRATIVE_FRAMING",
      content: {
        primaryNarrative: "Trusted and reliable",
        supportingNarratives: ["Transparent", "Accountable", "Innovative"],
      },
    });
    checkpointIds.push(awarenessId);

    // 2. Research: AI summaries
    const researchId = await this.createCheckpoint({
      tenantId,
      stage: "RESEARCH",
      checkpointId: "research-ai-summary",
      name: "AI Summary Control",
      description: "Controls AI-generated summaries during research",
      controlType: "AI_SUMMARY",
      content: {
        summaryTemplate: "Evidence-backed, transparent, and reliable",
        citationSources: ["rebuttals", "incidents", "dashboards"],
      },
    });
    checkpointIds.push(researchId);

    // 3. Comparison: Third-party validators
    const comparisonId = await this.createCheckpoint({
      tenantId,
      stage: "COMPARISON",
      checkpointId: "comparison-validators",
      name: "Third-Party Validator Control",
      description: "Controls third-party validation during comparison",
      controlType: "THIRD_PARTY_VALIDATOR",
      content: {
        validatorTypes: ["INDEPENDENT_AUDIT", "CERTIFICATION_BODY"],
        minTrustLevel: 0.7,
      },
    });
    checkpointIds.push(comparisonId);

    // 4. Decision: Proof dashboards
    const decisionId = await this.createCheckpoint({
      tenantId,
      stage: "DECISION",
      checkpointId: "decision-proof-dashboard",
      name: "Proof Dashboard Control",
      description: "Controls proof dashboards at decision stage",
      controlType: "PROOF_DASHBOARD",
      content: {
        requiredMetrics: ["uptime", "response_time", "compliance"],
        minSLACompliance: 0.95,
      },
    });
    checkpointIds.push(decisionId);

    // 5. Post-purchase: Reinforcement loops
    const postPurchaseId = await this.createCheckpoint({
      tenantId,
      stage: "POST_PURCHASE",
      checkpointId: "post-purchase-reinforcement",
      name: "Post-Purchase Reinforcement",
      description: "Controls reinforcement loops after purchase",
      controlType: "REINFORCEMENT_LOOP",
      content: {
        reinforcementTriggers: ["usage", "satisfaction", "milestones"],
        trustSignals: ["validators", "audits", "slas"],
      },
    });
    checkpointIds.push(postPurchaseId);

    logger.info("Complete funnel control setup", {
      tenantId,
      checkpointCount: checkpointIds.length,
    });

    return checkpointIds;
  }
}
