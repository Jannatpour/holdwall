/**
 * Production Event Store Implementation
 * Database-backed event storage with streaming support
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import type { EventEnvelope, EventStore } from "./types";

// Lazy load Kafka producer and DLQ
let kafkaProducer: any = null;
let kafkaClient: any = null;
let kafkaDLQ: any = null;

function getKafkaProducer() {
  if (kafkaProducer) {
    return kafkaProducer;
  }

  try {
    const { Kafka } = require("kafkajs");
    const brokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");
    
    kafkaClient = new Kafka({
      clientId: "holdwall-producer",
      brokers,
      retry: {
        retries: 8,
        initialRetryTime: 100,
        multiplier: 2,
        maxRetryTime: 30000,
      },
    });

    kafkaProducer = kafkaClient.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
    });

    return kafkaProducer;
  } catch (error) {
    logger.warn("kafkajs not available. Kafka publishing disabled.", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function getKafkaDLQ() {
  if (kafkaDLQ) {
    return kafkaDLQ;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { KafkaDLQ } = require("./kafka-dlq");
    const config = {
      maxRetries: parseInt(process.env.KAFKA_DLQ_MAX_RETRIES || "3", 10),
      initialRetryDelay: parseInt(process.env.KAFKA_DLQ_INITIAL_DELAY || "1000", 10),
      maxRetryDelay: parseInt(process.env.KAFKA_DLQ_MAX_DELAY || "60000", 10),
      retryBackoffMultiplier: parseFloat(process.env.KAFKA_DLQ_BACKOFF || "2"),
      dlqTopic: process.env.KAFKA_DLQ_TOPIC || "holdwall-dlq",
      enableDLQ: process.env.KAFKA_DLQ_ENABLED !== "false",
      retryTopic: process.env.KAFKA_DLQ_RETRY_TOPIC,
    } as any;
    kafkaDLQ = new KafkaDLQ(config);
    return kafkaDLQ;
  } catch (error) {
    logger.warn("Kafka DLQ not available", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export class DatabaseEventStore implements EventStore {
  private kafkaEnabled: boolean = false;
  private kafkaTopic: string = "holdwall-events";

  constructor() {
    this.kafkaEnabled = process.env.KAFKA_ENABLED === "true";
    this.kafkaTopic = process.env.KAFKA_EVENTS_TOPIC || "holdwall-events";
  }

  async append(event: EventEnvelope): Promise<void> {
    // 1. Store in Postgres (contract of record)
    const eventRecord = await db.event.create({
      data: {
        id: event.event_id,
        tenantId: event.tenant_id,
        actorId: event.actor_id,
        type: event.type,
        occurredAt: new Date(event.occurred_at),
        correlationId: event.correlation_id,
        causationId: event.causation_id,
        schemaVersion: event.schema_version,
        payload: event.payload as any,
        signatures: event.signatures as any,
        metadata: (event.metadata || {}) as any,
      },
    });

    // Link evidence references
    if (event.evidence_refs.length > 0) {
      await db.eventEvidence.createMany({
        data: event.evidence_refs.map((evidenceId) => ({
          eventId: eventRecord.id,
          evidenceId,
        })),
        skipDuplicates: true,
      });
    }

    // 2. Add to outbox for reliable Kafka publishing
    if (this.kafkaEnabled) {
      await this.addToOutbox(event, eventRecord.id);
    }
  }

  /**
   * Add event to outbox for reliable publishing
   */
  private async addToOutbox(event: EventEnvelope, eventId: string): Promise<void> {
    const partition = this.getPartition(event.tenant_id);

    await db.eventOutbox.create({
      data: {
        eventId,
        tenantId: event.tenant_id,
        topic: this.kafkaTopic,
        partition,
        key: event.tenant_id,
        value: JSON.stringify(event),
        headers: {
          event_type: event.type,
          tenant_id: event.tenant_id,
          correlation_id: event.correlation_id,
          schema_version: event.schema_version,
        } as any,
      },
    });

    // Try to publish immediately (non-blocking)
    this.publishToKafka(event).catch((error) => {
      logger.warn("Immediate Kafka publish failed, will retry via outbox", {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.event_id,
        eventType: event.type,
      });
    });
  }

  /**
   * Publish event to Kafka topic
   */
  private async publishToKafka(event: EventEnvelope): Promise<void> {
    const producer = getKafkaProducer();
    if (!producer) {
      return; // Kafka not available, skip silently
    }

    try {
      // Ensure producer is connected
      if (!producer.isConnected) {
        await producer.connect();
      }

      // Partition by tenant_id for better distribution
      const partition = this.getPartition(event.tenant_id);

      await producer.send({
        topic: this.kafkaTopic,
        messages: [
          {
            key: event.tenant_id, // Partition key
            value: JSON.stringify(event),
            partition,
            headers: {
              event_type: event.type,
              tenant_id: event.tenant_id,
              correlation_id: event.correlation_id,
              schema_version: event.schema_version,
            },
          },
        ],
      });
    } catch (error) {
      // Log error but don't fail the append operation
      // Postgres is the source of truth, Kafka is for streaming
      logger.error("Kafka publish failed (event still stored in DB)", {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.event_id,
        eventType: event.type,
      });
    }
  }

  /**
   * Get partition number for tenant_id
   * Uses consistent hashing to ensure same tenant always goes to same partition
   */
  private getPartition(tenantId: string): number {
    const numPartitions = parseInt(process.env.KAFKA_PARTITIONS || "3", 10);
    // Simple hash-based partitioning
    let hash = 0;
    for (let i = 0; i < tenantId.length; i++) {
      hash = ((hash << 5) - hash) + tenantId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % numPartitions;
  }

  async get(event_id: string): Promise<EventEnvelope | null> {
    const result = await db.event.findUnique({
      where: { id: event_id },
      include: {
        evidenceRefs: {
          include: {
            evidence: true,
          },
        },
      },
    });

    if (!result) {
      return null;
    }

    return {
      event_id: result.id,
      tenant_id: result.tenantId,
      actor_id: result.actorId,
      type: result.type,
      occurred_at: result.occurredAt.toISOString(),
      correlation_id: result.correlationId,
      causation_id: result.causationId || undefined,
      schema_version: result.schemaVersion,
      evidence_refs: result.evidenceRefs.map((ref) => ref.evidenceId),
      payload: result.payload as Record<string, unknown>,
      signatures: (result.signatures as any) || [],
      metadata: (result.metadata as Record<string, unknown>) || undefined,
    };
  }

  async query(filters: {
    tenant_id?: string;
    type?: string;
    correlation_id?: string;
    occurred_after?: string;
    occurred_before?: string;
  }): Promise<EventEnvelope[]> {
    const where: any = {};

    if (filters.tenant_id) {
      where.tenantId = filters.tenant_id;
    }
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.correlation_id) {
      where.correlationId = filters.correlation_id;
    }
    if (filters.occurred_after || filters.occurred_before) {
      where.occurredAt = {};
      if (filters.occurred_after) {
        where.occurredAt.gte = new Date(filters.occurred_after);
      }
      if (filters.occurred_before) {
        where.occurredAt.lte = new Date(filters.occurred_before);
      }
    }

    const results = await db.event.findMany({
      where,
      include: {
        evidenceRefs: true,
      },
      orderBy: { occurredAt: "desc" },
    });

    return results.map((result) => ({
      event_id: result.id,
      tenant_id: result.tenantId,
      actor_id: result.actorId,
      type: result.type,
      occurred_at: result.occurredAt.toISOString(),
      correlation_id: result.correlationId,
      causation_id: result.causationId || undefined,
      schema_version: result.schemaVersion,
      evidence_refs: result.evidenceRefs.map((ref) => ref.evidenceId),
      payload: result.payload as Record<string, unknown>,
      signatures: (result.signatures as any) || [],
      metadata: (result.metadata as Record<string, unknown>) || undefined,
    }));
  }

  async stream(
    filters: {
      tenant_id?: string;
      type?: string;
    },
    handler: (event: EventEnvelope) => Promise<void>,
    options?: {
      signal?: AbortSignal; // For cancellation
    }
  ): Promise<void> {
    // If Kafka is enabled, use Kafka consumer for real-time streaming
    if (this.kafkaEnabled) {
      await this.streamFromKafka(filters, handler, options);
      return;
    }

    // Fallback: Poll Postgres (for development or when Kafka unavailable)
    const where: any = {};

    if (filters.tenant_id) {
      where.tenantId = filters.tenant_id;
    }
    if (filters.type) {
      where.type = filters.type;
    }

    // Poll for new events
    let lastEventId: string | null = null;
    let shouldContinue = true;
    let pollTimeout: NodeJS.Timeout | null = null;

    // Handle abort signal
    if (options?.signal) {
      options.signal.addEventListener("abort", () => {
        shouldContinue = false;
        if (pollTimeout) clearTimeout(pollTimeout);
      });
    }

    const poll = async () => {
      if (!shouldContinue || options?.signal?.aborted) {
        return;
      }

      const whereClause: any = { ...where };
      if (lastEventId) {
        whereClause.id = { gt: lastEventId };
      }

      try {
        const events = await db.event.findMany({
          where: whereClause,
          include: {
            evidenceRefs: true,
          },
          orderBy: { occurredAt: "asc" },
          take: 100,
        });

        for (const result of events) {
          if (!shouldContinue || options?.signal?.aborted) break;

          const event: EventEnvelope = {
            event_id: result.id,
            tenant_id: result.tenantId,
            actor_id: result.actorId,
            type: result.type,
            occurred_at: result.occurredAt.toISOString(),
            correlation_id: result.correlationId,
            causation_id: result.causationId || undefined,
            schema_version: result.schemaVersion,
            evidence_refs: result.evidenceRefs.map((ref) => ref.evidenceId),
            payload: result.payload as Record<string, unknown>,
            signatures: (result.signatures as any) || [],
            metadata: (result.metadata as Record<string, unknown>) || undefined,
          };

          try {
            await handler(event);
            lastEventId = result.id;
          } catch (error) {
            logger.warn("Error in stream handler", { error: (error as Error).message });
            // Continue processing other events
          }
        }

        // Continue polling if should continue
        if (shouldContinue && !options?.signal?.aborted) {
          pollTimeout = setTimeout(poll, 1000);
        }
      } catch (error) {
        logger.error("Error polling events", { error: (error as Error).message });
        // Retry after delay
        if (shouldContinue && !options?.signal?.aborted) {
          pollTimeout = setTimeout(poll, 5000);
        }
      }
    };

    // Start polling
    poll();

    // Return a promise that resolves when streaming stops
    // In practice, this runs indefinitely until the connection is closed
    return new Promise((resolve) => {
      if (options?.signal) {
        options.signal.addEventListener("abort", () => {
          shouldContinue = false;
          if (pollTimeout) clearTimeout(pollTimeout);
          resolve();
        });
      }
      // Promise never resolves unless aborted, keeping the stream alive
    });
  }

  /**
   * Stream events from Kafka
   */
  private async streamFromKafka(
    filters: {
      tenant_id?: string;
      type?: string;
    },
    handler: (event: EventEnvelope) => Promise<void>,
    options?: {
      signal?: AbortSignal;
    }
  ): Promise<void> {
    const { KafkaConsumer } = await import("./kafka-consumer");
    const brokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");
    const groupId = `holdwall-stream-${filters.tenant_id || "all"}`;
    const topics = [this.kafkaTopic];

    const consumer = new KafkaConsumer({
      brokers,
      groupId,
      topics,
      fromBeginning: false, // Only new events
    });

    // Handle abort signal
    if (options?.signal) {
      options.signal.addEventListener("abort", async () => {
        try {
          await consumer.stop();
        } catch (error) {
          logger.warn("Error stopping Kafka consumer", { error: (error as Error).message });
        }
      });
    }

    await consumer.start(async (event, message) => {
      // Check if aborted
      if (options?.signal?.aborted) {
        await consumer.stop();
        return;
      }

      // Apply filters
      if (filters.tenant_id && event.tenant_id !== filters.tenant_id) {
        return;
      }
      if (filters.type && event.type !== filters.type) {
        return;
      }

      await handler(event);
    });

    // Keep consumer running until aborted
    // In production, this would be managed by a service/worker process
    return new Promise((resolve) => {
      if (options?.signal) {
        options.signal.addEventListener("abort", async () => {
          try {
            await consumer.stop();
          } catch (error) {
            logger.warn("Error stopping Kafka consumer on abort", { error: (error as Error).message });
          }
          resolve();
        });
      }
      // Promise never resolves unless aborted
    });
  }
}
