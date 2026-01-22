/**
 * Pipeline Worker
 * Processes events from Kafka for claim extraction, graph updates, forecasts, etc.
 */

import { KafkaConsumer } from "@/lib/events/kafka-consumer";
import type { EventEnvelope } from "@/lib/events/types";
import { db } from "@/lib/db/client";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { ClaimExtractionService } from "@/lib/claims/extraction";
import { DatabaseBeliefGraphService } from "@/lib/graph/belief-implementation";
import { ForecastService } from "@/lib/forecasts/service";
import { logger } from "@/lib/logging/logger";
import { Prisma } from "@prisma/client";

export interface PipelineWorkerConfig {
  groupId: string;
  topics: string[];
  brokers: string[];
}

export class PipelineWorker {
  private consumer: KafkaConsumer | null = null;
  private evidenceVault: DatabaseEvidenceVault;
  private eventStore: DatabaseEventStore;
  private claimExtractor: ClaimExtractionService;
  private beliefGraph: DatabaseBeliefGraphService;
  private forecastService: ForecastService;
  private readonly workerName = "pipeline-worker";

  constructor(config: PipelineWorkerConfig) {
    this.evidenceVault = new DatabaseEvidenceVault();
    this.eventStore = new DatabaseEventStore();
    this.claimExtractor = new ClaimExtractionService(this.evidenceVault, this.eventStore);
    this.beliefGraph = new DatabaseBeliefGraphService();
    // DatabaseBeliefGraphService implements the same interface as BeliefGraphService
    this.forecastService = new ForecastService(this.eventStore, this.beliefGraph as any);

    this.consumer = new KafkaConsumer({
      brokers: config.brokers,
      groupId: config.groupId,
      topics: config.topics,
      fromBeginning: false,
    });
  }

  /**
   * Start processing events
   */
  async start(): Promise<void> {
    if (!this.consumer) {
      throw new Error("Kafka consumer not initialized");
    }

    await this.consumer.start(async (event: EventEnvelope, message) => {
      try {
        const acquired = await this.acquireEvent(event);
        if (!acquired) {
          return;
        }

        await this.processEvent(event);
        await this.markEventCompleted(event);
      } catch (error) {
        logger.error("Error processing event", {
          eventId: event.event_id,
          eventType: event.type,
          tenantId: event.tenant_id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        await this.markEventFailed(event, error);
        // Event will be retried by the consumer / DLQ handler
        throw error;
      }
    });
  }

  /**
   * Stop processing
   */
  async stop(): Promise<void> {
    if (this.consumer) {
      await this.consumer.stop();
    }
  }

  /**
   * Process event based on type
   */
  private async processEvent(event: EventEnvelope): Promise<void> {
    switch (event.type) {
      case "signal.ingested":
        await this.processSignalIngested(event);
        break;
      case "claim.extracted":
        await this.processClaimExtracted(event);
        break;
      case "graph.updated":
        await this.processGraphUpdated(event);
        break;
      case "bge.structural_irrelevance_applied":
      case "consensus.signal.created":
      case "aaal.rebuttal.created":
      case "aaal.incident_explanation.created":
      case "npe.complaint.predicted":
      case "tsm.validator.registered":
      case "tsm.audit.published":
      case "dfd.checkpoint.created":
        // POS events are processed by their respective services
        // These are logged for observability
        logger.debug("POS event received", {
          eventType: event.type,
          tenantId: event.tenant_id,
        });
        break;
      default:
        // Unknown event type, skip
        break;
    }
  }

  /**
   * Process signal.ingested event - extract claims
   */
  private async processSignalIngested(event: EventEnvelope): Promise<void> {
    if (event.evidence_refs.length === 0) {
      return;
    }

    // Get evidence
    const evidence = await this.evidenceVault.get(event.evidence_refs[0]);
    if (!evidence) {
      return;
    }

    // Extract claims from evidence
    const content = evidence.content.normalized || evidence.content.raw || "";
    if (!content.trim()) {
      return;
    }

    try {
      // Extract claims using the service
      const claims = await this.claimExtractor.extractClaims(evidence.evidence_id, {
        use_llm: true,
      });

      // Claims are already stored and events emitted by the extraction service
      // This worker just triggers the extraction
    } catch (error) {
      logger.error("Error extracting claims", {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.event_id,
        evidenceId: (event.payload as any).evidence_id,
        tenantId: event.tenant_id,
      });
      // Don't throw - allow event to be processed by other handlers
    }
  }

  /**
   * Process claim.extracted event - update belief graph
   */
  private async processClaimExtracted(event: EventEnvelope): Promise<void> {
    const claimId = (event.payload as any).claim_id;
    if (!claimId) {
      return;
    }

    try {
      // Update belief graph with new claim
      await this.beliefGraph.upsertNode({
        tenant_id: event.tenant_id,
        type: "claim",
        content: (event.payload as any).text || "",
        trust_score: 0.5, // Default trust score
        decisiveness: 0.5, // Default decisiveness
        actor_weights: {},
        decay_factor: 0.95,
      });

      // Emit graph.updated event
      const graphEvent: EventEnvelope = {
        event_id: crypto.randomUUID(),
        tenant_id: event.tenant_id,
        actor_id: "pipeline-worker",
        type: "graph.updated",
        occurred_at: new Date().toISOString(),
        correlation_id: event.correlation_id,
        causation_id: event.event_id,
        schema_version: "1.0",
        evidence_refs: event.evidence_refs,
        payload: {
          claim_id: claimId,
        },
        signatures: [],
      };

      await this.eventStore.append(graphEvent);
    } catch (error) {
      logger.error("Error updating belief graph", {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.event_id,
        claimId,
        tenantId: event.tenant_id,
      });
    }
  }

  /**
   * Process graph.updated event - generate forecasts
   */
  private async processGraphUpdated(event: EventEnvelope): Promise<void> {
    // Generate forecasts based on graph updates
    try {
      // Get recent graph metrics for forecasting
      const nodes = await this.beliefGraph.getNodes(event.tenant_id, { limit: 100 });
      
      if (nodes.length === 0) {
        return;
      }

      // Extract time series data from graph updates
      const metrics: number[] = [];
      const timestamps: number[] = [];
      
      // Analyze belief strength trends over time
      for (const node of nodes) {
        // Use trust_score * decisiveness as strength metric
        const strength = node.trust_score * node.decisiveness;
        metrics.push(strength);
        timestamps.push(node.updated_at ? new Date(node.updated_at).getTime() : new Date(node.created_at).getTime());
      }

      if (metrics.length >= 5) {
        // Generate drift forecast
        const driftForecast = await this.forecastService.forecastDrift(
          event.tenant_id,
          "belief_strength",
          7, // 7-day horizon
          metrics
        );

        // Store forecast in database
        await this.eventStore.append({
          event_id: crypto.randomUUID(),
          tenant_id: event.tenant_id,
          actor_id: "pipeline-worker",
          type: "forecast.generated",
          occurred_at: new Date().toISOString(),
          correlation_id: event.correlation_id,
          causation_id: event.event_id,
          schema_version: "1.0",
          evidence_refs: driftForecast.evidence_refs || [],
          signatures: [],
          payload: {
            forecast_id: driftForecast.forecast_id,
            type: driftForecast.type,
            target_metric: driftForecast.target_metric,
            value: driftForecast.value,
            horizon_days: driftForecast.horizon_days,
          },
        });
      }
    } catch (error) {
      logger.error("Error generating forecasts", {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.event_id,
        tenantId: event.tenant_id,
      });
    }
  }

  private async acquireEvent(event: EventEnvelope): Promise<boolean> {
    const now = new Date();
    try {
      await db.eventProcessing.create({
        data: {
          tenantId: event.tenant_id,
          worker: this.workerName,
          eventId: event.event_id,
          status: "PROCESSING",
          attempt: 1,
          startedAt: now,
        },
      });
      return true;
    } catch (error) {
      // Unique constraint: decide whether to skip or re-acquire (stale/failed)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await db.eventProcessing.findUnique({
          where: {
            worker_eventId: {
              worker: this.workerName,
              eventId: event.event_id,
            },
          },
        });

        if (!existing) {
          return false;
        }

        if (existing.status === "COMPLETED") {
          return false;
        }

        // If another worker is actively processing and it's not stale, skip.
        const ageMs = now.getTime() - existing.startedAt.getTime();
        const staleMs = 15 * 60 * 1000; // 15 minutes
        if (existing.status === "PROCESSING" && ageMs < staleMs) {
          return false;
        }

        // Re-acquire (stale PROCESSING or FAILED)
        await db.eventProcessing.update({
          where: {
            worker_eventId: {
              worker: this.workerName,
              eventId: event.event_id,
            },
          },
          data: {
            tenantId: event.tenant_id,
            status: "PROCESSING",
            attempt: { increment: 1 },
            startedAt: now,
            completedAt: null,
            lastError: null,
          },
        });
        return true;
      }

      throw error;
    }
  }

  private async markEventCompleted(event: EventEnvelope): Promise<void> {
    await db.eventProcessing.update({
      where: {
        worker_eventId: {
          worker: this.workerName,
          eventId: event.event_id,
        },
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
  }

  private async markEventFailed(event: EventEnvelope, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await db.eventProcessing.update({
      where: {
        worker_eventId: {
          worker: this.workerName,
          eventId: event.event_id,
        },
      },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        lastError: message,
      },
    });
  }
}
