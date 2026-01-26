"use strict";
/**
 * Kafka Consumer for Event Processing
 *
 * Consumes events from Kafka topics and processes them for downstream systems.
 * Supports self-hosted Kafka with partitioning by tenant_id.
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
exports.KafkaConsumer = void 0;
const logger_1 = require("@/lib/logging/logger");
class KafkaConsumer {
    constructor(config) {
        this.kafka = null;
        this.consumer = null;
        this.isRunning = false;
        this.config = config;
        // Lazy load kafkajs
        try {
            const { Kafka } = require("kafkajs");
            const brokers = config.brokers;
            const tlsEnabled = process.env.KAFKA_SSL === "true" ||
                process.env.KAFKA_TLS === "true" ||
                brokers.some((b) => String(b).includes(":9094"));
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
        }
        catch (error) {
            logger_1.logger.warn("kafkajs not available. Install with: npm install kafkajs", {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    /**
     * Start consuming events
     */
    async start(handler) {
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
                eachMessage: async ({ topic, partition, message }) => {
                    try {
                        const value = message.value?.toString();
                        if (!value) {
                            return;
                        }
                        const event = JSON.parse(value);
                        const kafkaMessage = {
                            key: message.key?.toString() || null,
                            value,
                            partition,
                            offset: message.offset,
                            timestamp: message.timestamp || new Date().toISOString(),
                            headers: message.headers ? this.parseHeaders(message.headers) : undefined,
                        };
                        await handler(event, kafkaMessage);
                    }
                    catch (error) {
                        logger_1.logger.error("Error processing Kafka message", {
                            error: error instanceof Error ? error.message : String(error),
                            topic,
                            partition,
                            offset: message.offset,
                            eventId: event?.event_id,
                            eventType: event?.type,
                        });
                        // Handle with DLQ if available
                        try {
                            const { KafkaDLQ } = await Promise.resolve().then(() => __importStar(require("./kafka-dlq")));
                            const dlqConfig = {
                                maxRetries: parseInt(process.env.KAFKA_DLQ_MAX_RETRIES || "3", 10),
                                initialRetryDelay: parseInt(process.env.KAFKA_DLQ_INITIAL_DELAY || "1000", 10),
                                maxRetryDelay: parseInt(process.env.KAFKA_DLQ_MAX_DELAY || "60000", 10),
                                retryBackoffMultiplier: parseFloat(process.env.KAFKA_DLQ_BACKOFF || "2"),
                                dlqTopic: process.env.KAFKA_DLQ_TOPIC || "holdwall-dlq",
                                enableDLQ: process.env.KAFKA_DLQ_ENABLED !== "false",
                                retryTopic: process.env.KAFKA_DLQ_RETRY_TOPIC,
                            };
                            const dlq = new KafkaDLQ(dlqConfig);
                            await dlq.handleFailure({
                                topic,
                                partition,
                                offset: message.offset,
                                value: message.value?.toString(),
                            }, error instanceof Error ? error : new Error(String(error)), 0 // Will be tracked by DLQ
                            );
                        }
                        catch (dlqError) {
                            // If DLQ fails, just log
                            logger_1.logger.error("Failed to handle message in DLQ", {
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
        }
        catch (error) {
            this.isRunning = false;
            throw new Error(`Kafka consumer start failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Stop consuming events
     */
    async stop() {
        if (!this.consumer || !this.isRunning) {
            return;
        }
        try {
            await this.consumer.disconnect();
            this.isRunning = false;
        }
        catch (error) {
            throw new Error(`Kafka consumer stop failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Parse Kafka headers
     */
    parseHeaders(headers) {
        const parsed = {};
        for (const [key, value] of Object.entries(headers)) {
            if (Buffer.isBuffer(value)) {
                parsed[key] = value.toString("utf-8");
            }
            else {
                parsed[key] = String(value);
            }
        }
        return parsed;
    }
    /**
     * Get consumer status
     */
    getStatus() {
        return {
            running: this.isRunning,
            connected: this.consumer !== null,
        };
    }
}
exports.KafkaConsumer = KafkaConsumer;
