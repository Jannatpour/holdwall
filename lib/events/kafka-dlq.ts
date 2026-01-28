/**
 * Kafka Dead Letter Queue (DLQ)
 * 
 * Handles failed message processing with retry logic, exponential backoff,
 * and dead letter queue routing for Kafka event workflows
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { isConnectionError, logConnectionError } from "./kafka-utils";

export interface DLQMessage {
  id: string;
  originalTopic: string;
  originalPartition: number;
  originalOffset: string;
  originalMessage: unknown;
  failureReason: string;
  failureCount: number;
  firstFailureAt: Date;
  lastFailureAt: Date;
  nextRetryAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface DLQConfig {
  maxRetries: number;
  initialRetryDelay: number; // ms
  maxRetryDelay: number; // ms
  retryBackoffMultiplier: number;
  dlqTopic: string;
  enableDLQ: boolean;
  retryTopic?: string;
}

export class KafkaDLQ {
  private config: DLQConfig;
  private dlqMessages: Map<string, DLQMessage> = new Map();
  private retryScheduler?: NodeJS.Timeout;

  constructor(config: DLQConfig) {
    this.config = config;
    if (config.enableDLQ) {
      this.startRetryScheduler();
    }
  }

  /**
   * Handle failed message
   */
  async handleFailure(
    message: {
      topic: string;
      partition: number;
      offset: string;
      value: unknown;
    },
    error: Error,
    failureCount: number = 0
  ): Promise<void> {
    const messageId = `${message.topic}-${message.partition}-${message.offset}`;
    const existing = this.dlqMessages.get(messageId);

    const now = new Date();
    const dlqMessage: DLQMessage = existing
      ? {
          ...existing,
          failureCount: failureCount + 1,
          lastFailureAt: now,
          failureReason: error.message,
        }
      : {
          id: messageId,
          originalTopic: message.topic,
          originalPartition: message.partition,
          originalOffset: message.offset,
          originalMessage: message.value,
          failureReason: error.message,
          failureCount: failureCount + 1,
          firstFailureAt: now,
          lastFailureAt: now,
        };

    // Check if we should retry or send to DLQ
    if (dlqMessage.failureCount <= this.config.maxRetries) {
      // Schedule retry
      const retryDelay = this.calculateRetryDelay(dlqMessage.failureCount);
      dlqMessage.nextRetryAt = new Date(Date.now() + retryDelay);

      this.dlqMessages.set(messageId, dlqMessage);

      logger.warn("Message failed, scheduled for retry", {
        messageId,
        failureCount: dlqMessage.failureCount,
        retryDelay,
        error: error.message,
      });

      metrics.increment("kafka_dlq_retry_scheduled", {
        topic: message.topic,
        failure_count: dlqMessage.failureCount.toString(),
      });
    } else {
      // Send to DLQ
      await this.sendToDLQ(dlqMessage);
      this.dlqMessages.delete(messageId);

      logger.error("Message sent to DLQ after max retries", {
        messageId,
        failureCount: dlqMessage.failureCount,
        error: error.message,
      });

      metrics.increment("kafka_dlq_messages_sent", { topic: message.topic });
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(failureCount: number): number {
    const delay = Math.min(
      this.config.initialRetryDelay * Math.pow(this.config.retryBackoffMultiplier, failureCount - 1),
      this.config.maxRetryDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    return delay + jitter;
  }

  /**
   * Send message to dead letter queue
   */
  private async sendToDLQ(dlqMessage: DLQMessage): Promise<void> {
    if (!this.config.enableDLQ) {
      logger.warn("DLQ disabled, message discarded", { messageId: dlqMessage.id });
      return;
    }

    try {
      const dlqPayload = {
        ...dlqMessage,
        dlqTimestamp: new Date().toISOString(),
      };

      // Publish to Kafka DLQ topic
      try {
        const { Kafka } = await import("kafkajs");
        
        const kafkaBrokers = (process.env.KAFKA_BROKERS || "localhost:9092")
          .split(",")
          .map((b) => b.trim())
          .filter(Boolean);
        const tlsEnabled =
          process.env.KAFKA_SSL === "true" ||
          process.env.KAFKA_TLS === "true" ||
          kafkaBrokers.some((b) => String(b).includes(":9094"));

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
        const kafka = new Kafka({
          clientId: process.env.KAFKA_CLIENT_ID || "holdwall-dlq",
          brokers: kafkaBrokers,
          ssl: tlsEnabled ? { rejectUnauthorized: true } : undefined,
          sasl,
          connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || "10000", 10),
          requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || "30000", 10),
        });

        const producer = kafka.producer();
        try {
          await producer.connect();
        } catch (connectError: any) {
          if (isConnectionError(connectError)) {
            logConnectionError(connectError, kafkaBrokers, "dlq-producer-connect", {
              hint: "Check network connectivity, DNS resolution, and broker hostnames. Ensure KAFKA_BROKERS is correctly configured.",
            });
          }
          throw connectError;
        }

        await producer.send({
          topic: this.config.dlqTopic,
          messages: [
            {
              key: dlqMessage.id,
              value: JSON.stringify(dlqPayload),
              headers: {
                "original-topic": dlqMessage.originalTopic,
                "original-partition": dlqMessage.originalPartition.toString(),
                "original-offset": dlqMessage.originalOffset,
                "failure-count": dlqMessage.failureCount.toString(),
                "failure-reason": dlqMessage.failureReason,
              },
            },
          ],
        });

        await producer.disconnect();

        logger.error("Message sent to DLQ", {
          messageId: dlqMessage.id,
          originalTopic: dlqMessage.originalTopic,
          failureCount: dlqMessage.failureCount,
          dlqTopic: this.config.dlqTopic,
        });

        metrics.increment("kafka_dlq_messages_total", {
          original_topic: dlqMessage.originalTopic,
        });
      } catch (kafkaError: any) {
        if (kafkaError.code === "MODULE_NOT_FOUND" || kafkaError.message?.includes("Cannot find module")) {
          logger.warn("kafkajs not installed, logging DLQ message locally", {
            messageId: dlqMessage.id,
            note: "Install kafkajs for production DLQ support: npm install kafkajs",
          });
          // Fall through to local logging
        } else {
          if (isConnectionError(kafkaError)) {
            const kafkaBrokers = (process.env.KAFKA_BROKERS || "localhost:9092")
              .split(",")
              .map((b) => b.trim())
              .filter(Boolean);
            logConnectionError(kafkaError, kafkaBrokers, "dlq-send", {
              messageId: dlqMessage.id,
              hint: "Kafka broker unreachable. DLQ message will be logged locally. Check network connectivity and KAFKA_BROKERS configuration.",
            });
            // Fall through to local logging instead of throwing
          } else {
            throw kafkaError;
          }
        }
      }
    } catch (error) {
      logger.error("Failed to send message to DLQ", {
        messageId: dlqMessage.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      metrics.increment("kafka_dlq_send_failures");
    }
  }

  /**
   * Start retry scheduler
   */
  private startRetryScheduler(): void {
    this.retryScheduler = setInterval(() => {
      this.processRetries();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Process scheduled retries
   */
  private async processRetries(): Promise<void> {
    const now = new Date();
    const readyToRetry = Array.from(this.dlqMessages.values())
      .filter(msg => msg.nextRetryAt && msg.nextRetryAt <= now);

    for (const message of readyToRetry) {
      try {
        logger.info("Retrying failed message", {
          messageId: message.id,
          failureCount: message.failureCount,
        });

        metrics.increment("kafka_dlq_retry_attempts", {
          original_topic: message.originalTopic,
        });

        // Republish to retry topic or original topic
        try {
          const { Kafka } = await import("kafkajs");
          
          const kafkaBrokers = process.env.KAFKA_BROKERS?.split(",") || ["localhost:9092"];
          const kafka = new Kafka({
            clientId: process.env.KAFKA_CLIENT_ID || "holdwall-dlq-retry",
            brokers: kafkaBrokers,
            connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || "10000", 10),
            requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || "30000", 10),
          });

          const producer = kafka.producer();
          try {
            await producer.connect();
          } catch (connectError: any) {
            if (isConnectionError(connectError)) {
              logConnectionError(connectError, kafkaBrokers, "dlq-retry-producer-connect", {
                hint: "Check network connectivity, DNS resolution, and broker hostnames. Ensure KAFKA_BROKERS is correctly configured.",
              });
            }
            throw connectError;
          }

          const retryTopic = this.config.retryTopic || message.originalTopic;
          await producer.send({
            topic: retryTopic,
            messages: [
              {
                key: message.id,
                value: JSON.stringify(message.originalMessage),
                headers: {
                  "retry-count": message.failureCount.toString(),
                  "original-topic": message.originalTopic,
                  "original-partition": message.originalPartition.toString(),
                  "original-offset": message.originalOffset,
                },
              },
            ],
          });

          await producer.disconnect();

          logger.info("Message republished for retry", {
            messageId: message.id,
            retryTopic,
            failureCount: message.failureCount,
          });

          // Remove from retry queue after successful republish
          this.dlqMessages.delete(message.id);
        } catch (kafkaError: any) {
          if (kafkaError.code === "MODULE_NOT_FOUND" || kafkaError.message?.includes("Cannot find module")) {
            logger.warn("kafkajs not installed, skipping retry republish", {
              messageId: message.id,
              note: "Install kafkajs for production retry support: npm install kafkajs",
            });
            // Remove from queue even if Kafka not available (to prevent infinite retries)
            this.dlqMessages.delete(message.id);
          } else {
            // Kafka error - keep message in queue for next retry
            logger.error("Retry republish failed", {
              messageId: message.id,
              error: kafkaError.message,
            });
            // Don't delete - will retry again
          }
        }
      } catch (error) {
        logger.error("Retry failed", {
          messageId: message.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        metrics.increment("kafka_dlq_retry_failures");
      }
    }
  }

  /**
   * Get DLQ statistics
   */
  getStatistics(): {
    totalMessages: number;
    pendingRetries: number;
    messagesByTopic: Record<string, number>;
  } {
    const messages = Array.from(this.dlqMessages.values());
    const messagesByTopic: Record<string, number> = {};

    for (const message of messages) {
      messagesByTopic[message.originalTopic] = (messagesByTopic[message.originalTopic] || 0) + 1;
    }

    return {
      totalMessages: messages.length,
      pendingRetries: messages.filter(m => m.nextRetryAt).length,
      messagesByTopic,
    };
  }

  /**
   * Stop retry scheduler
   */
  stop(): void {
    if (this.retryScheduler) {
      clearInterval(this.retryScheduler);
      this.retryScheduler = undefined;
    }
  }
}
