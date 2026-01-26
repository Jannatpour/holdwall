"use strict";
/**
 * Kafka Dead Letter Queue (DLQ)
 *
 * Handles failed message processing with retry logic, exponential backoff,
 * and dead letter queue routing for Kafka event workflows
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaDLQ = void 0;
const logger_1 = require("@/lib/logging/logger");
const metrics_1 = require("@/lib/observability/metrics");
class KafkaDLQ {
    constructor(config) {
        this.dlqMessages = new Map();
        this.config = config;
        if (config.enableDLQ) {
            this.startRetryScheduler();
        }
    }
    /**
     * Handle failed message
     */
    async handleFailure(message, error, failureCount = 0) {
        const messageId = `${message.topic}-${message.partition}-${message.offset}`;
        const existing = this.dlqMessages.get(messageId);
        const now = new Date();
        const dlqMessage = existing
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
            logger_1.logger.warn("Message failed, scheduled for retry", {
                messageId,
                failureCount: dlqMessage.failureCount,
                retryDelay,
                error: error.message,
            });
            metrics_1.metrics.increment("kafka_dlq_retry_scheduled", {
                topic: message.topic,
                failure_count: dlqMessage.failureCount.toString(),
            });
        }
        else {
            // Send to DLQ
            await this.sendToDLQ(dlqMessage);
            this.dlqMessages.delete(messageId);
            logger_1.logger.error("Message sent to DLQ after max retries", {
                messageId,
                failureCount: dlqMessage.failureCount,
                error: error.message,
            });
            metrics_1.metrics.increment("kafka_dlq_messages_sent", { topic: message.topic });
        }
    }
    /**
     * Calculate retry delay with exponential backoff
     */
    calculateRetryDelay(failureCount) {
        const delay = Math.min(this.config.initialRetryDelay * Math.pow(this.config.retryBackoffMultiplier, failureCount - 1), this.config.maxRetryDelay);
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.3 * delay;
        return delay + jitter;
    }
    /**
     * Send message to dead letter queue
     */
    async sendToDLQ(dlqMessage) {
        if (!this.config.enableDLQ) {
            logger_1.logger.warn("DLQ disabled, message discarded", { messageId: dlqMessage.id });
            return;
        }
        try {
            const dlqPayload = {
                ...dlqMessage,
                dlqTimestamp: new Date().toISOString(),
            };
            // Publish to Kafka DLQ topic
            try {
                const { Kafka } = await Promise.resolve().then(() => __importStar(require("kafkajs")));
                const kafkaBrokers = (process.env.KAFKA_BROKERS || "localhost:9092")
                    .split(",")
                    .map((b) => b.trim())
                    .filter(Boolean);
                const tlsEnabled = process.env.KAFKA_SSL === "true" ||
                    process.env.KAFKA_TLS === "true" ||
                    kafkaBrokers.some((b) => String(b).includes(":9094"));
                const saslMechanism = process.env.KAFKA_SASL_MECHANISM?.trim();
                const saslUsername = process.env.KAFKA_SASL_USERNAME?.trim();
                const saslPassword = process.env.KAFKA_SASL_PASSWORD?.trim();
                const sasl = saslMechanism && saslUsername && saslPassword
                    ? {
                        mechanism: saslMechanism,
                        username: saslUsername,
                        password: saslPassword,
                    }
                    : undefined;
                const kafka = new Kafka({
                    clientId: process.env.KAFKA_CLIENT_ID || "holdwall-dlq",
                    brokers: kafkaBrokers,
                    ssl: tlsEnabled ? { rejectUnauthorized: true } : undefined,
                    sasl,
                });
                const producer = kafka.producer();
                await producer.connect();
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
                logger_1.logger.error("Message sent to DLQ", {
                    messageId: dlqMessage.id,
                    originalTopic: dlqMessage.originalTopic,
                    failureCount: dlqMessage.failureCount,
                    dlqTopic: this.config.dlqTopic,
                });
                metrics_1.metrics.increment("kafka_dlq_messages_total", {
                    original_topic: dlqMessage.originalTopic,
                });
            }
            catch (kafkaError) {
                if (kafkaError.code === "MODULE_NOT_FOUND" || kafkaError.message?.includes("Cannot find module")) {
                    logger_1.logger.warn("kafkajs not installed, logging DLQ message locally", {
                        messageId: dlqMessage.id,
                        note: "Install kafkajs for production DLQ support: npm install kafkajs",
                    });
                    // Fall through to local logging
                }
                else {
                    throw kafkaError;
                }
            }
        }
        catch (error) {
            logger_1.logger.error("Failed to send message to DLQ", {
                messageId: dlqMessage.id,
                error: error instanceof Error ? error.message : "Unknown error",
            });
            metrics_1.metrics.increment("kafka_dlq_send_failures");
        }
    }
    /**
     * Start retry scheduler
     */
    startRetryScheduler() {
        this.retryScheduler = setInterval(() => {
            this.processRetries();
        }, 5000); // Check every 5 seconds
    }
    /**
     * Process scheduled retries
     */
    async processRetries() {
        const now = new Date();
        const readyToRetry = Array.from(this.dlqMessages.values())
            .filter(msg => msg.nextRetryAt && msg.nextRetryAt <= now);
        for (const message of readyToRetry) {
            try {
                logger_1.logger.info("Retrying failed message", {
                    messageId: message.id,
                    failureCount: message.failureCount,
                });
                metrics_1.metrics.increment("kafka_dlq_retry_attempts", {
                    original_topic: message.originalTopic,
                });
                // Republish to retry topic or original topic
                try {
                    const { Kafka } = await Promise.resolve().then(() => __importStar(require("kafkajs")));
                    const kafkaBrokers = process.env.KAFKA_BROKERS?.split(",") || ["localhost:9092"];
                    const kafka = new Kafka({
                        clientId: process.env.KAFKA_CLIENT_ID || "holdwall-dlq-retry",
                        brokers: kafkaBrokers,
                    });
                    const producer = kafka.producer();
                    await producer.connect();
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
                    logger_1.logger.info("Message republished for retry", {
                        messageId: message.id,
                        retryTopic,
                        failureCount: message.failureCount,
                    });
                    // Remove from retry queue after successful republish
                    this.dlqMessages.delete(message.id);
                }
                catch (kafkaError) {
                    if (kafkaError.code === "MODULE_NOT_FOUND" || kafkaError.message?.includes("Cannot find module")) {
                        logger_1.logger.warn("kafkajs not installed, skipping retry republish", {
                            messageId: message.id,
                            note: "Install kafkajs for production retry support: npm install kafkajs",
                        });
                        // Remove from queue even if Kafka not available (to prevent infinite retries)
                        this.dlqMessages.delete(message.id);
                    }
                    else {
                        // Kafka error - keep message in queue for next retry
                        logger_1.logger.error("Retry republish failed", {
                            messageId: message.id,
                            error: kafkaError.message,
                        });
                        // Don't delete - will retry again
                    }
                }
            }
            catch (error) {
                logger_1.logger.error("Retry failed", {
                    messageId: message.id,
                    error: error instanceof Error ? error.message : "Unknown error",
                });
                metrics_1.metrics.increment("kafka_dlq_retry_failures");
            }
        }
    }
    /**
     * Get DLQ statistics
     */
    getStatistics() {
        const messages = Array.from(this.dlqMessages.values());
        const messagesByTopic = {};
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
    stop() {
        if (this.retryScheduler) {
            clearInterval(this.retryScheduler);
            this.retryScheduler = undefined;
        }
    }
}
exports.KafkaDLQ = KafkaDLQ;
