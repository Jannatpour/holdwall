/**
 * Narrative Preemption Engine (NPE)
 * 
 * POS: Predicts future complaints and preemptively addresses them
 * - Customer journey anomaly detection
 * - Sentiment drift analysis
 * - Support ticket clustering
 * - Social discourse forecasting
 * 
 * Pre-publishes explanations before complaints trend
 */

import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { ForecastService } from "@/lib/forecasts/service";
import { DatabaseBeliefGraphService } from "@/lib/graph/belief-implementation";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

const eventStore = new DatabaseEventStore();
const beliefGraph = new DatabaseBeliefGraphService();
const forecastService = new ForecastService(eventStore, beliefGraph as any);

export interface PredictedComplaintInput {
  tenantId: string;
  predictedTopic: string;
  predictedContent: string;
  probability: number;
  confidence: number;
  horizonDays: number;
  triggers: Record<string, any>;
  evidenceRefs?: string[];
}

export interface PreemptiveAction {
  actionId: string;
  type: "artifact" | "explanation" | "rebuttal" | "dashboard";
  content: string;
  evidenceRefs: string[];
}

export class NarrativePreemptionEngine {
  /**
   * Predict future complaints using multiple signals
   */
  async predictComplaints(
    tenantId: string,
    horizonDays: number = 7
  ): Promise<string[]> {
    const predictions: string[] = [];

    // 1. Analyze customer journey anomalies
    const journeyAnomalies = await this.detectJourneyAnomalies(tenantId);
    for (const anomaly of journeyAnomalies) {
      const predictionId = await this.createPrediction({
        tenantId,
        predictedTopic: anomaly.topic,
        predictedContent: anomaly.description,
        probability: anomaly.severity,
        confidence: 0.7,
        horizonDays,
        triggers: { type: "journey_anomaly", anomalyId: anomaly.id },
        evidenceRefs: anomaly.evidenceRefs,
      });
      predictions.push(predictionId);
    }

    // 2. Analyze sentiment drift
    const sentimentDrift = await this.analyzeSentimentDrift(tenantId);
    if (sentimentDrift.driftRate < -0.2) {
      // Significant negative drift
      const predictionId = await this.createPrediction({
        tenantId,
        predictedTopic: "Negative sentiment trend",
        predictedContent: `Sentiment is trending negative with drift rate of ${sentimentDrift.driftRate.toFixed(2)}. This may lead to increased complaints.`,
        probability: Math.abs(sentimentDrift.driftRate),
        confidence: sentimentDrift.confidence,
        horizonDays,
        triggers: {
          type: "sentiment_drift",
          driftRate: sentimentDrift.driftRate,
        },
        evidenceRefs: sentimentDrift.evidenceRefs,
      });
      predictions.push(predictionId);
    }

    // 3. Cluster support tickets
    const ticketClusters = await this.clusterSupportTickets(tenantId);
    for (const cluster of ticketClusters) {
      if (cluster.size >= 5 && cluster.sentiment < 0.4) {
        // Large cluster of negative tickets
        const predictionId = await this.createPrediction({
          tenantId,
          predictedTopic: cluster.topic,
          predictedContent: `Support ticket cluster of ${cluster.size} tickets with negative sentiment (${cluster.sentiment.toFixed(2)}) suggests emerging complaint pattern.`,
          probability: Math.min(1, cluster.size / 20),
          confidence: 0.8,
          horizonDays,
          triggers: {
            type: "support_ticket_cluster",
            clusterId: cluster.id,
            size: cluster.size,
          },
          evidenceRefs: cluster.evidenceRefs,
        });
        predictions.push(predictionId);
      }
    }

    // 4. Social discourse forecasting
    const socialForecast = await this.forecastSocialDiscourse(tenantId);
    if (socialForecast.outbreakProbability > 0.6) {
      const predictionId = await this.createPrediction({
        tenantId,
        predictedTopic: "Social media outbreak risk",
        predictedContent: `High probability (${(socialForecast.outbreakProbability * 100).toFixed(0)}%) of social media outbreak. Preemptive response recommended.`,
        probability: socialForecast.outbreakProbability,
        confidence: socialForecast.confidence,
        horizonDays,
        triggers: {
          type: "social_forecast",
          outbreakProbability: socialForecast.outbreakProbability,
        },
        evidenceRefs: socialForecast.evidenceRefs,
      });
      predictions.push(predictionId);
    }

    // Emit metrics
    metrics.increment("npe.predictions.created", {
      tenant_id: tenantId,
    });

    logger.info("Complaints predicted", {
      tenantId,
      predictionCount: predictions.length,
      horizonDays,
    });

    return predictions;
  }

  /**
   * Create a predicted complaint record
   */
  private async createPrediction(
    input: PredictedComplaintInput
  ): Promise<string> {
    const prediction = await db.predictedComplaint.create({
      data: {
        tenantId: input.tenantId,
        predictedTopic: input.predictedTopic,
        predictedContent: input.predictedContent,
        probability: input.probability,
        confidence: input.confidence,
        horizonDays: input.horizonDays,
        triggers: input.triggers as any,
        evidenceRefs: input.evidenceRefs || [],
        status: "ACTIVE",
      },
    });

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      actor_id: "npe-service",
      type: "npe.complaint.predicted",
      occurred_at: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      schema_version: "1.0",
      evidence_refs: input.evidenceRefs || [],
      payload: {
        prediction_id: prediction.id,
        topic: input.predictedTopic,
        probability: input.probability,
        horizon_days: input.horizonDays,
      },
      signatures: [],
    });

    return prediction.id;
  }

  /**
   * Detect customer journey anomalies
   */
  private async detectJourneyAnomalies(tenantId: string): Promise<
    Array<{
      id: string;
      topic: string;
      description: string;
      severity: number;
      evidenceRefs: string[];
    }>
  > {
    // Analyze evidence for journey anomalies
    const recentEvidence = await db.evidence.findMany({
      where: {
        tenantId,
        type: "SIGNAL",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      take: 100,
    });

    // Simple anomaly detection: look for negative sentiment spikes
    const anomalies: Array<{
      id: string;
      topic: string;
      description: string;
      severity: number;
      evidenceRefs: string[];
    }> = [];

    for (const evidence of recentEvidence) {
      const metadata = evidence.contentMetadata as any;
      if (metadata?.sentiment && metadata.sentiment < 0.3) {
        anomalies.push({
          id: evidence.id,
          topic: "Negative customer experience",
          description: `Negative sentiment detected in signal: ${evidence.contentRaw?.substring(0, 100)}`,
          severity: 1 - metadata.sentiment,
          evidenceRefs: [evidence.id],
        });
      }
    }

    return anomalies;
  }

  /**
   * Analyze sentiment drift
   */
  private async analyzeSentimentDrift(tenantId: string): Promise<{
    driftRate: number;
    confidence: number;
    evidenceRefs: string[];
  }> {
    // Get recent sentiment data
    const recentEvidence = await db.evidence.findMany({
      where: {
        tenantId,
        type: "SIGNAL",
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      take: 200,
      orderBy: { createdAt: "asc" },
    });

    const sentiments = recentEvidence
      .map((e) => {
        const meta = e.contentMetadata as any;
        return meta?.sentiment as number | undefined;
      })
      .filter((s): s is number => typeof s === "number");

    if (sentiments.length < 10) {
      return { driftRate: 0, confidence: 0, evidenceRefs: [] };
    }

    // Calculate drift using linear regression
    const n = sentiments.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = sentiments.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * sentiments[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const driftRate = slope; // Negative = negative drift

    return {
      driftRate,
      confidence: Math.min(1, sentiments.length / 50),
      evidenceRefs: recentEvidence.map((e) => e.id),
    };
  }

  /**
   * Cluster support tickets
   */
  private async clusterSupportTickets(tenantId: string): Promise<
    Array<{
      id: string;
      topic: string;
      size: number;
      sentiment: number;
      evidenceRefs: string[];
    }>
  > {
    // Get support ticket evidence
    const tickets = await db.evidence.findMany({
      where: {
        tenantId,
        type: "SIGNAL",
        sourceType: "support_ticket",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      take: 100,
    });

    // Simple clustering by topic keywords
    const clusters = new Map<
      string,
      {
        tickets: typeof tickets;
        sentiment: number[];
      }
    >();

    for (const ticket of tickets) {
      const content = ticket.contentNormalized || ticket.contentRaw || "";
      const keywords = this.extractKeywords(content);
      const clusterKey = keywords[0] || "other";

      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, { tickets: [], sentiment: [] });
      }

      const cluster = clusters.get(clusterKey)!;
      cluster.tickets.push(ticket);

      const meta = ticket.contentMetadata as any;
      if (typeof meta?.sentiment === "number") {
        cluster.sentiment.push(meta.sentiment);
      }
    }

    // Convert to cluster format
    return Array.from(clusters.entries()).map(([topic, cluster]) => ({
      id: `cluster-${topic}`,
      topic,
      size: cluster.tickets.length,
      sentiment:
        cluster.sentiment.length > 0
          ? cluster.sentiment.reduce((a, b) => a + b, 0) /
            cluster.sentiment.length
          : 0.5,
      evidenceRefs: cluster.tickets.map((t) => t.id),
    }));
  }

  /**
   * Forecast social discourse
   */
  private async forecastSocialDiscourse(tenantId: string): Promise<{
    outbreakProbability: number;
    confidence: number;
    evidenceRefs: string[];
  }> {
    // Use existing forecast service
    const forecasts = await forecastService.generateForecasts(tenantId);
    const outbreakForecast = forecasts.find((f) => f.type === "outbreak");

    if (outbreakForecast && outbreakForecast.type === "outbreak") {
      const outbreak = outbreakForecast as any; // OutbreakForecast has probability
      return {
        outbreakProbability: outbreak.probability || 0,
        confidence: outbreakForecast.confidence.level,
        evidenceRefs: outbreakForecast.evidence_refs,
      };
    }

    return {
      outbreakProbability: 0,
      confidence: 0,
      evidenceRefs: [],
    };
  }

  /**
   * Generate preemptive action
   */
  async generatePreemptiveAction(
    predictionId: string
  ): Promise<PreemptiveAction | null> {
    const prediction = await db.predictedComplaint.findUnique({
      where: { id: predictionId },
    });

    if (!prediction || prediction.status !== "ACTIVE") {
      return null;
    }

    // Generate appropriate action based on prediction
    const actionType: PreemptiveAction["type"] =
      prediction.probability > 0.8 ? "explanation" : "rebuttal";

    const content = `Preemptive response to predicted complaint: ${prediction.predictedTopic}\n\n${prediction.predictedContent}\n\nWe are proactively addressing this concern to ensure transparency and customer satisfaction.`;

    const action: PreemptiveAction = {
      actionId: `action-${predictionId}`,
      type: actionType,
      content,
      evidenceRefs: prediction.evidenceRefs,
    };

    // Update prediction with action
    await db.predictedComplaint.update({
      where: { id: predictionId },
      data: {
        preemptiveActionId: action.actionId,
      },
    });

    logger.info("Preemptive action generated", {
      predictionId,
      actionId: action.actionId,
      type: actionType,
    });

    return action;
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string): string[] {
    // Simple keyword extraction (in production, use NLP)
    const words = content.toLowerCase().split(/\s+/);
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
    ]);

    return words
      .filter((w) => w.length > 3 && !stopWords.has(w))
      .slice(0, 3);
  }
}
