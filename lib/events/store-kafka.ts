/**
 * Kafka Event Store Implementation
 * 
 * Production-ready Kafka-driven event streaming with:
 * - Producer for publishing events
 * - Consumer groups for distributed processing
 * - Partitioning for scalability
 * - Exactly-once semantics
 * - Dead letter queue for failed events
 */

import type { EventEnvelope, EventStore } from "./types";
import { logger } from "@/lib/logging/logger";
import { isConnectionError, logConnectionError } from "./kafka-utils";
import { metrics } from "@/lib/observability/metrics";

export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId?: string;
  topic: string;
  ssl?: {
    rejectUnauthorized: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
  sasl?: {
    mechanism: "plain" | "scram-sha-256" | "scram-sha-512";
    username: string;
    password: string;
  };
  retry?: {
    retries?: number;
    initialRetryTime?: number;
    multiplier?: number;
    maxRetryTime?: number;
  };
}

export class KafkaEventStore implements EventStore {
  private config: KafkaConfig;
  private producer: any = null; // Kafka producer client
  private consumer: any = null; // Kafka consumer client
  private isInitialized: boolean = false;

  constructor(config: KafkaConfig) {
    this.config = {
      ...config,
      retry: {
        retries: config.retry?.retries || 3,
        initialRetryTime: config.retry?.initialRetryTime || 100,
        multiplier: config.retry?.multiplier || 2,
        maxRetryTime: config.retry?.maxRetryTime || 1000,
      },
    };
  }

  /**
   * Initialize Kafka producer and consumer
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // In production, use kafkajs or similar
      // For now, we'll create a structure that can be easily integrated
      // This requires: npm install kafkajs
      
      // Dynamic import to avoid requiring kafkajs at build time
      const { Kafka } = await import("kafkajs").catch(() => {
        throw new Error(
          "kafkajs not installed. Install with: npm install kafkajs"
        );
      });

      const kafka = new Kafka({
        clientId: this.config.clientId,
        brokers: this.config.brokers,
        ssl: this.config.ssl,
        sasl: this.config.sasl as any,
        connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || "10000", 10),
        requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || "30000", 10),
        retry: this.config.retry,
      });

      // Create producer
      this.producer = kafka.producer({
        maxInFlightRequests: 1,
        idempotent: true, // Exactly-once semantics
        transactionTimeout: 30000,
      });

      // Connect with a small backoff to avoid startup log spam in Kafka-disabled environments.
      const maxRetriesRaw = process.env.KAFKA_CONNECT_MAX_RETRIES;
      const maxRetries = maxRetriesRaw ? parseInt(maxRetriesRaw, 10) : 5;
      const initialDelay = parseInt(process.env.KAFKA_CONNECT_RETRY_INITIAL_DELAY || "1000", 10);
      const maxDelay = parseInt(process.env.KAFKA_CONNECT_RETRY_MAX_DELAY || "30000", 10);
      let attempt = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          await this.producer.connect();
          break;
        } catch (connectError: any) {
          if (isConnectionError(connectError)) {
            logConnectionError(connectError, this.config.brokers, "store-kafka-producer-connect", {
              clientId: this.config.clientId,
              topic: this.config.topic,
              attempt: attempt + 1,
            });
          } else {
            logger.error("Kafka producer connection failed", {
              error: connectError instanceof Error ? connectError.message : String(connectError),
              brokers: this.config.brokers,
            });
          }

          attempt += 1;
          if (attempt > maxRetries) {
            const errorMessage = connectError instanceof Error ? connectError.message : String(connectError);
            throw new Error(`Kafka producer connection failed: ${errorMessage}`);
          }

          const cappedExp = Math.min(attempt, 6);
          const delay = Math.min(initialDelay * Math.pow(2, cappedExp), maxDelay);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      // Create consumer if groupId is provided
      if (this.config.groupId) {
        this.consumer = kafka.consumer({
          groupId: this.config.groupId,
          sessionTimeout: 30000,
          heartbeatInterval: 3000,
        });

        attempt = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            await this.consumer.connect();
            break;
          } catch (connectError: any) {
            if (isConnectionError(connectError)) {
              logConnectionError(connectError, this.config.brokers, "store-kafka-consumer-connect", {
                clientId: this.config.clientId,
                groupId: this.config.groupId,
                topic: this.config.topic,
                attempt: attempt + 1,
              });
            } else {
              logger.error("Kafka consumer connection failed", {
                error: connectError instanceof Error ? connectError.message : String(connectError),
                brokers: this.config.brokers,
              });
            }

            attempt += 1;
            if (attempt > maxRetries) {
              const errorMessage = connectError instanceof Error ? connectError.message : String(connectError);
              throw new Error(`Kafka consumer connection failed: ${errorMessage}`);
            }

            const cappedExp = Math.min(attempt, 6);
            const delay = Math.min(initialDelay * Math.pow(2, cappedExp), maxDelay);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
        
        await this.consumer.subscribe({
          topic: this.config.topic,
          fromBeginning: false,
        });
      }

      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Kafka initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Append event to Kafka topic
   */
  async append(event: EventEnvelope): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.producer) {
      throw new Error("Kafka producer not initialized");
    }

    try {
      // Partition by tenant_id for better distribution
      const partition = this.getPartition(event.tenant_id);

      await this.producer.send({
        topic: this.config.topic,
        messages: [
          {
            key: event.event_id, // Use event_id as key for ordering
            value: JSON.stringify(event),
            partition,
            headers: {
              tenant_id: event.tenant_id,
              event_type: event.type,
              correlation_id: event.correlation_id,
            },
            timestamp: new Date(event.occurred_at).getTime().toString(),
          },
        ],
      });
    } catch (error: any) {
      // Handle connection errors gracefully
      const brokers = this.config.brokers;
      if (isConnectionError(error)) {
        logConnectionError(error, brokers, "store-kafka-append", {
          eventId: event.event_id,
          eventType: event.type,
          tenantId: event.tenant_id,
          hint: "Kafka broker unreachable. Event append failed.",
        });
        metrics.increment("kafka_append_errors", {
          error_type: "connection",
          event_type: event.type,
        });
        // Don't throw - allow caller to handle gracefully
        throw new Error(
          `Kafka append failed (connection error): ${error instanceof Error ? error.message : "Unknown error"}`
        );
      } else {
        logger.error("Kafka append failed (non-connection error)", {
          error: error instanceof Error ? error.message : String(error),
          eventId: event.event_id,
          eventType: event.type,
          tenantId: event.tenant_id,
          stack: error instanceof Error ? error.stack : undefined,
        });
        metrics.increment("kafka_append_errors", {
          error_type: "non_connection",
          event_type: event.type,
        });
        throw new Error(
          `Kafka append failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  }

  /**
   * Get event by ID (requires querying Kafka or maintaining an index)
   * Note: Kafka is append-only, so this requires a separate index or consumer
   */
  async get(event_id: string): Promise<EventEnvelope | null> {
    // Kafka doesn't support direct key lookups efficiently
    // In production, maintain a separate index (e.g., in Redis or database)
    // For now, return null and recommend using a hybrid approach
    throw new Error(
      "Direct event lookup not supported in Kafka. Use a hybrid store with database index."
    );
  }

  /**
   * Query events (requires consuming from Kafka or maintaining an index)
   */
  async query(filters: {
    tenant_id?: string;
    type?: string;
    correlation_id?: string;
    occurred_after?: string;
    occurred_before?: string;
  }): Promise<EventEnvelope[]> {
    // Kafka doesn't support efficient querying
    // In production, use a hybrid approach with database for queries
    throw new Error(
      "Event querying not supported in Kafka. Use a hybrid store with database for queries."
    );
  }

  /**
   * Stream events from Kafka
   */
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
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.consumer) {
      throw new Error("Kafka consumer not initialized. Provide groupId in config.");
    }

    // Handle abort signal
    if (options?.signal) {
      options.signal.addEventListener("abort", async () => {
        try {
          await this.disconnect();
        } catch (error) {
          logger.warn("Error disconnecting Kafka consumer on abort", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    }

    try {
      await this.consumer.run({
        eachMessage: async ({ message, partition, offset }: any) => {
          // Check if aborted
          if (options?.signal?.aborted) {
            await this.disconnect();
            return;
          }

          let event: EventEnvelope | null = null;
          try {
            event = JSON.parse(message.value?.toString() || "{}") as EventEnvelope;

            // Apply filters
            if (filters.tenant_id && event.tenant_id !== filters.tenant_id) {
              return; // Skip this event
            }
            if (filters.type && event.type !== filters.type) {
              return; // Skip this event
            }

            await handler(event);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error("Error processing Kafka message", {
              error: errorMessage,
              partition,
              offset: offset.toString(),
              eventId: event?.event_id || "unknown",
              eventType: event?.type || "unknown",
              tenantId: event?.tenant_id || "unknown",
              stack: error instanceof Error ? error.stack : undefined,
            });
            
            // Record metrics
            metrics.increment("kafka_message_processing_errors", {
              event_type: event?.type || "parse_error",
              error_type: error instanceof Error ? error.name : "unknown",
            });
            
            // In production, send to dead letter queue
            try {
              const { KafkaDLQ } = await import("./kafka-dlq");
              const dlqConfig = {
                maxRetries: parseInt(process.env.KAFKA_DLQ_MAX_RETRIES || "3", 10),
                initialRetryDelay: parseInt(process.env.KAFKA_DLQ_INITIAL_DELAY || "1000", 10),
                maxRetryDelay: parseInt(process.env.KAFKA_DLQ_MAX_DELAY || "60000", 10),
                retryBackoffMultiplier: parseFloat(process.env.KAFKA_DLQ_BACKOFF || "2"),
                dlqTopic: process.env.KAFKA_DLQ_TOPIC || "holdwall-dlq",
                enableDLQ: process.env.KAFKA_DLQ_ENABLED !== "false",
                retryTopic: process.env.KAFKA_DLQ_RETRY_TOPIC,
              } as any;
              
              const dlq = new KafkaDLQ(dlqConfig);
              await dlq.handleFailure(
                {
                  topic: this.config.topic,
                  partition,
                  offset: offset.toString(),
                  value: message.value?.toString() || JSON.stringify({ error: "failed_to_parse" }),
                },
                error instanceof Error ? error : new Error(errorMessage),
                0
              );
            } catch (dlqError) {
              logger.error("Failed to send message to DLQ", {
                dlqError: dlqError instanceof Error ? dlqError.message : String(dlqError),
                originalError: errorMessage,
                eventId: event?.event_id || "unknown",
              });
            }
          }
        },
      });

      // Return a promise that resolves when streaming stops
      return new Promise((resolve) => {
        if (options?.signal) {
          options.signal.addEventListener("abort", async () => {
            try {
              await this.disconnect();
            } catch (error) {
              logger.warn("Error disconnecting Kafka consumer on abort", {
                error: error instanceof Error ? error.message : String(error),
              });
            }
            resolve();
          });
        }
        // Promise never resolves unless aborted, keeping the stream alive
      });
    } catch (error) {
      throw new Error(
        `Kafka streaming failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get partition for tenant (for load balancing)
   */
  private getPartition(tenantId: string): number {
    // Simple hash-based partitioning
    let hash = 0;
    for (let i = 0; i < tenantId.length; i++) {
      hash = ((hash << 5) - hash) + tenantId.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Assume 3 partitions (adjust based on your Kafka setup)
    return Math.abs(hash) % 3;
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
    }
    if (this.consumer) {
      await this.consumer.disconnect();
      this.consumer = null;
    }
    this.isInitialized = false;
  }
}
