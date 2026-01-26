/**
 * Kafka Consumer for Event Processing
 * 
 * Consumes events from Kafka topics and processes them for downstream systems.
 * Supports self-hosted Kafka with partitioning by tenant_id.
 */

import type { EventEnvelope } from "./types";
import { logger } from "@/lib/logging/logger";

export interface KafkaConsumerConfig {
  brokers: string[];
  groupId: string;
  topics: string[];
  fromBeginning?: boolean;
}

export interface KafkaMessage {
  key: string | null;
  value: string;
  partition: number;
  offset: string;
  timestamp: string;
  headers?: Record<string, string>;
}

export class KafkaConsumer {
  private kafka: any = null;
  private consumer: any = null;
  private config: KafkaConsumerConfig;
  private isRunning: boolean = false;

  constructor(config: KafkaConsumerConfig) {
    this.config = config;

    // Lazy load kafkajs
    try {
      const { Kafka } = require("kafkajs");
      const brokers = config.brokers;
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
              mechanism: saslMechanism as any,
              username: saslUsername,
              password: saslPassword,
            }
          : undefined;

      this.kafka = new Kafka({
        clientId: "holdwall-consumer",
        brokers,
        ssl: tlsEnabled ? { rejectUnauthorized: true } : undefined,
        sasl,
        retry: {
          retries: 8,
          initialRetryTime: 100,
          multiplier: 2,
          maxRetryTime: 30000,
        },
      });

      this.consumer = this.kafka.consumer({
        groupId: config.groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
      });
    } catch (error) {
      logger.warn("kafkajs not available. Install with: npm install kafkajs", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Start consuming events
   */
  async start(
    handler: (event: EventEnvelope, message: KafkaMessage) => Promise<void>
  ): Promise<void> {
    if (!this.consumer) {
      throw new Error("Kafka consumer not initialized. Install kafkajs package.");
    }

    if (this.isRunning) {
      throw new Error("Consumer is already running");
    }

    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topics: this.config.topics,
        fromBeginning: this.config.fromBeginning || false,
      });

      this.isRunning = true;

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }: any) => {
          try {
            const value = message.value?.toString();
            if (!value) {
              return;
            }

            const event: EventEnvelope = JSON.parse(value);
            const kafkaMessage: KafkaMessage = {
              key: message.key?.toString() || null,
              value,
              partition,
              offset: message.offset,
              timestamp: message.timestamp || new Date().toISOString(),
              headers: message.headers ? this.parseHeaders(message.headers) : undefined,
            };

            await handler(event, kafkaMessage);
          } catch (error) {
            logger.error("Error processing Kafka message", {
              error: error instanceof Error ? error.message : String(error),
              topic,
              partition,
              offset: message.offset,
              eventId: (event as EventEnvelope | undefined)?.event_id,
              eventType: (event as EventEnvelope | undefined)?.type,
            });
            
            // Handle with DLQ if available
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
                  topic,
                  partition,
                  offset: message.offset,
                  value: message.value?.toString(),
                },
                error instanceof Error ? error : new Error(String(error)),
                0 // Will be tracked by DLQ
              );
            } catch (dlqError) {
              // If DLQ fails, just log
              logger.error("Failed to handle message in DLQ", {
                dlqError: dlqError instanceof Error ? dlqError.message : String(dlqError),
                originalError: error instanceof Error ? error.message : String(error),
                topic,
                partition,
                offset: message.offset,
              });
            }
          }
        },
      });
    } catch (error) {
      this.isRunning = false;
      throw new Error(
        `Kafka consumer start failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Stop consuming events
   */
  async stop(): Promise<void> {
    if (!this.consumer || !this.isRunning) {
      return;
    }

    try {
      await this.consumer.disconnect();
      this.isRunning = false;
    } catch (error) {
      throw new Error(
        `Kafka consumer stop failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Parse Kafka headers
   */
  private parseHeaders(headers: any): Record<string, string> {
    const parsed: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (Buffer.isBuffer(value)) {
        parsed[key] = value.toString("utf-8");
      } else {
        parsed[key] = String(value);
      }
    }
    return parsed;
  }

  /**
   * Get consumer status
   */
  getStatus(): { running: boolean; connected: boolean } {
    return {
      running: this.isRunning,
      connected: this.consumer !== null,
    };
  }
}
