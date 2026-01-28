/**
 * Event Outbox Publisher
 * Reliably publishes events from outbox to Kafka
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import {
  isConnectionError,
  logConnectionError,
  createKafkaConfig,
  type BrokerValidationResult,
} from "./kafka-utils";
import type { EventEnvelope } from "./types";

// Lazy load Kafka producer
let kafkaProducer: any = null;
let kafkaClient: any = null;

function getKafkaProducer() {
  if (kafkaProducer) {
    return kafkaProducer;
  }

  try {
    const brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
      .split(",")
      .map((b: string) => b.trim())
      .filter(Boolean);

    const tlsEnabled =
      process.env.KAFKA_SSL === "true" ||
      process.env.KAFKA_TLS === "true" ||
      brokers.some((b: string) => String(b).includes(":9094"));

    const saslMechanism = process.env.KAFKA_SASL_MECHANISM?.trim();
    const saslUsername = process.env.KAFKA_SASL_USERNAME?.trim();
    const saslPassword = process.env.KAFKA_SASL_PASSWORD?.trim();
    const sasl =
      saslMechanism && saslUsername && saslPassword
        ? {
            mechanism: saslMechanism as "plain" | "scram-sha-256" | "scram-sha-512",
            username: saslUsername,
            password: saslPassword,
          }
        : undefined;

    kafkaClient = createKafkaConfig({
      clientId: "holdwall-outbox-publisher",
      brokers,
      ssl: tlsEnabled,
      sasl,
    });

    kafkaProducer = kafkaClient.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
    });

    return kafkaProducer;
  } catch (error) {
    logger.warn("kafkajs not available. Outbox publishing disabled.", {
      error: error instanceof Error ? error.message : String(error),
    });
    metrics.increment("kafka_producer_init_failures");
    return null;
  }
}

export class EventOutboxPublisher {
  private kafkaEnabled: boolean = false;
  private kafkaTopic: string = "holdwall-events";
  private batchSize: number = 100;
  private maxRetries: number = 3;
  private backgroundProcessingTimeout: NodeJS.Timeout | null = null;
  private isBackgroundProcessing: boolean = false;

  constructor() {
    this.kafkaEnabled = process.env.KAFKA_ENABLED === "true";
    this.kafkaTopic = process.env.KAFKA_EVENTS_TOPIC || "holdwall-events";
    this.batchSize = parseInt(process.env.OUTBOX_BATCH_SIZE || "100", 10);
    this.maxRetries = parseInt(process.env.OUTBOX_MAX_RETRIES || "3", 10);
  }

  /**
   * Process outbox entries and publish to Kafka
   */
  async processOutbox(): Promise<{ published: number; failed: number }> {
    if (!this.kafkaEnabled) {
      return { published: 0, failed: 0 };
    }

    const producer = getKafkaProducer();
    if (!producer) {
      return { published: 0, failed: 0 };
    }

    // Ensure producer is connected
    if (!producer.isConnected) {
      try {
        await producer.connect();
      } catch (error: unknown) {
        const brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
          .split(",")
          .map((b: string) => b.trim())
          .filter(Boolean);
        
        if (isConnectionError(error)) {
          logConnectionError(error, brokers, "outbox-publisher-connect", {
            operation: "producer_connect",
          });
        } else {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error("Failed to connect Kafka producer", {
            error: errorMessage,
            brokers,
            stack: error instanceof Error ? error.stack : undefined,
          });
          metrics.increment("kafka_producer_connection_errors", {
            error_type: "unknown",
          });
        }
        return { published: 0, failed: 0 };
      }
    }

    // Fetch unpublished entries
    const outboxEntries = await db.eventOutbox.findMany({
      where: {
        published: false,
        retryCount: { lt: this.maxRetries },
      },
      take: this.batchSize,
      orderBy: { createdAt: "asc" },
    });

    if (outboxEntries.length === 0) {
      return { published: 0, failed: 0 };
    }

    let published = 0;
    let failed = 0;

    // Group entries by topic for batch sending
    const entriesByTopic = new Map<string, typeof outboxEntries>();
    for (const entry of outboxEntries) {
      const topic = entry.topic || this.kafkaTopic;
      if (!entriesByTopic.has(topic)) {
        entriesByTopic.set(topic, []);
      }
      entriesByTopic.get(topic)!.push(entry);
    }

    // Process each topic batch
    for (const [topic, entries] of entriesByTopic) {
      try {
        // Prepare batch messages
        const messages = await Promise.all(
          entries.map(async (entry) => {
            const event: EventEnvelope = JSON.parse(entry.value);
            const partition = entry.partition ?? this.getPartition(event.tenant_id);
            
            return {
              key: entry.key || event.tenant_id,
              value: entry.value,
              partition,
              headers: (entry.headers as Record<string, string>) || {
                event_type: event.type,
                tenant_id: event.tenant_id,
                correlation_id: event.correlation_id,
                schema_version: event.schema_version,
              },
            };
          })
        );

        // Send batch
        await producer.send({
          topic,
          messages,
        });

        // Mark all as published atomically
        const entryIds = entries.map((e) => e.id);
        await db.eventOutbox.updateMany({
          where: {
            id: { in: entryIds },
            published: false, // Idempotency check
          },
          data: {
            published: true,
            publishedAt: new Date(),
          },
        });

        published += entries.length;
        metrics.increment("kafka_outbox_published", {
          topic,
          count: entries.length.toString(),
        });
      } catch (error: unknown) {
        // Handle batch failure - process individually for better error tracking
        const brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
          .split(",")
          .map((b: string) => b.trim())
          .filter(Boolean);

        if (isConnectionError(error)) {
          logConnectionError(error, brokers, "outbox-publisher-send", {
            topic,
            batch_size: entries.length,
          });
        }

        // Fall back to individual processing
        for (const entry of entries) {
          try {
            const event: EventEnvelope = JSON.parse(entry.value);
            const partition = entry.partition ?? this.getPartition(event.tenant_id);

            await producer.send({
              topic,
              messages: [
                {
                  key: entry.key || event.tenant_id,
                  value: entry.value,
                  partition,
                  headers: (entry.headers as Record<string, string>) || {
                    event_type: event.type,
                    tenant_id: event.tenant_id,
                    correlation_id: event.correlation_id,
                    schema_version: event.schema_version,
                  },
                },
              ],
            });

            // Mark as published with idempotency check
            const updateResult = await db.eventOutbox.updateMany({
              where: {
                id: entry.id,
                published: false, // Idempotency check
              },
              data: {
                published: true,
                publishedAt: new Date(),
              },
            });

            if (updateResult.count > 0) {
              published++;
              metrics.increment("kafka_outbox_published", { topic });
            }
          } catch (individualError: unknown) {
            // Increment retry count
            await db.eventOutbox.update({
              where: { id: entry.id },
              data: {
                retryCount: { increment: 1 },
                lastError: individualError instanceof Error ? individualError.message : String(individualError),
              },
            });

            failed++;
            const errorMessage = individualError instanceof Error ? individualError.message : String(individualError);
            
            if (isConnectionError(individualError)) {
              logConnectionError(individualError, brokers, "outbox-publisher-individual", {
                entryId: entry.id,
                topic,
              });
            } else {
              logger.error("Failed to publish outbox entry", {
                entryId: entry.id,
                error: errorMessage,
                retryCount: entry.retryCount + 1,
                topic,
              });
              metrics.increment("kafka_outbox_publish_errors", {
                error_type: "non_connection",
                topic,
              });
            }
          }
        }
      }
    }

    if (failed > 0) {
      metrics.increment("kafka_outbox_batch_failures", {
        failed_count: failed.toString(),
      });
    }

    return { published, failed };
  }

  /**
   * Get partition number for tenant_id
   */
  private getPartition(tenantId: string): number {
    const numPartitions = parseInt(process.env.KAFKA_PARTITIONS || "3", 10);
    let hash = 0;
    for (let i = 0; i < tenantId.length; i++) {
      hash = ((hash << 5) - hash) + tenantId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % numPartitions;
  }

  /**
   * Start background processing (call this from a worker)
   */
  async startBackgroundProcessing(intervalMs: number = 5000): Promise<void> {
    if (!this.kafkaEnabled) {
      logger.info("Kafka not enabled, background processing skipped");
      return;
    }

    if (this.isBackgroundProcessing) {
      logger.warn("Background processing already running");
      return;
    }

    this.isBackgroundProcessing = true;
    logger.info("Starting background outbox processing", { intervalMs });

    const process = async () => {
      if (!this.isBackgroundProcessing) {
        return; // Stop processing if flag is false
      }

      try {
        await this.processOutbox();
      } catch (error) {
        logger.error("Error processing outbox", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }

      // Schedule next run if still processing
      if (this.isBackgroundProcessing) {
        this.backgroundProcessingTimeout = setTimeout(process, intervalMs);
      }
    };

    // Start processing
    process();
  }

  /**
   * Stop background processing
   */
  async stopBackgroundProcessing(): Promise<void> {
    if (!this.isBackgroundProcessing) {
      return;
    }

    logger.info("Stopping background outbox processing");
    this.isBackgroundProcessing = false;

    if (this.backgroundProcessingTimeout) {
      clearTimeout(this.backgroundProcessingTimeout);
      this.backgroundProcessingTimeout = null;
    }

    // Disconnect Kafka producer if connected
    const producer = getKafkaProducer();
    if (producer && producer.isConnected) {
      try {
        await producer.disconnect();
        logger.info("Kafka outbox producer disconnected");
      } catch (error) {
        logger.error("Error disconnecting Kafka outbox producer", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

/**
 * Export for graceful shutdown
 */
export async function disconnectOutboxKafkaProducer(): Promise<void> {
  const producer = getKafkaProducer();
  if (producer?.isConnected) {
    try {
      await producer.disconnect();
      kafkaProducer = null;
      kafkaClient = null;
      logger.info("Kafka outbox producer disconnected");
    } catch (error) {
      logger.warn("Error disconnecting Kafka outbox producer", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
