"use strict";
/**
 * Event Outbox Publisher
 * Reliably publishes events from outbox to Kafka
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventOutboxPublisher = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
// Lazy load Kafka producer
let kafkaProducer = null;
let kafkaClient = null;
function getKafkaProducer() {
    if (kafkaProducer) {
        return kafkaProducer;
    }
    try {
        const { Kafka } = require("kafkajs");
        const brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
            .split(",")
            .map((b) => b.trim())
            .filter(Boolean);
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
        kafkaClient = new Kafka({
            clientId: "holdwall-outbox-publisher",
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
        kafkaProducer = kafkaClient.producer({
            maxInFlightRequests: 1,
            idempotent: true,
            transactionTimeout: 30000,
        });
        return kafkaProducer;
    }
    catch (error) {
        logger_1.logger.warn("kafkajs not available. Outbox publishing disabled.", {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
class EventOutboxPublisher {
    constructor() {
        this.kafkaEnabled = false;
        this.kafkaTopic = "holdwall-events";
        this.batchSize = 100;
        this.maxRetries = 3;
        this.backgroundProcessingTimeout = null;
        this.isBackgroundProcessing = false;
        this.kafkaEnabled = process.env.KAFKA_ENABLED === "true";
        this.kafkaTopic = process.env.KAFKA_EVENTS_TOPIC || "holdwall-events";
        this.batchSize = parseInt(process.env.OUTBOX_BATCH_SIZE || "100", 10);
        this.maxRetries = parseInt(process.env.OUTBOX_MAX_RETRIES || "3", 10);
    }
    /**
     * Process outbox entries and publish to Kafka
     */
    async processOutbox() {
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
            }
            catch (error) {
                logger_1.logger.error("Failed to connect Kafka producer", {
                    error: error instanceof Error ? error.message : String(error),
                });
                return { published: 0, failed: 0 };
            }
        }
        // Fetch unpublished entries
        const outboxEntries = await client_1.db.eventOutbox.findMany({
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
        // Publish in batches
        for (const entry of outboxEntries) {
            try {
                const event = JSON.parse(entry.value);
                const partition = entry.partition ?? this.getPartition(event.tenant_id);
                await producer.send({
                    topic: entry.topic || this.kafkaTopic,
                    messages: [
                        {
                            key: entry.key || event.tenant_id,
                            value: entry.value,
                            partition,
                            headers: entry.headers || {
                                event_type: event.type,
                                tenant_id: event.tenant_id,
                                correlation_id: event.correlation_id,
                                schema_version: event.schema_version,
                            },
                        },
                    ],
                });
                // Mark as published
                await client_1.db.eventOutbox.update({
                    where: { id: entry.id },
                    data: {
                        published: true,
                        publishedAt: new Date(),
                    },
                });
                published++;
            }
            catch (error) {
                // Increment retry count
                await client_1.db.eventOutbox.update({
                    where: { id: entry.id },
                    data: {
                        retryCount: { increment: 1 },
                        lastError: error instanceof Error ? error.message : String(error),
                    },
                });
                failed++;
                logger_1.logger.error("Failed to publish outbox entry", {
                    entryId: entry.id,
                    error: error instanceof Error ? error.message : String(error),
                    retryCount: entry.retryCount + 1,
                });
            }
        }
        return { published, failed };
    }
    /**
     * Get partition number for tenant_id
     */
    getPartition(tenantId) {
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
    async startBackgroundProcessing(intervalMs = 5000) {
        if (!this.kafkaEnabled) {
            logger_1.logger.info("Kafka not enabled, background processing skipped");
            return;
        }
        if (this.isBackgroundProcessing) {
            logger_1.logger.warn("Background processing already running");
            return;
        }
        this.isBackgroundProcessing = true;
        logger_1.logger.info("Starting background outbox processing", { intervalMs });
        const process = async () => {
            if (!this.isBackgroundProcessing) {
                return; // Stop processing if flag is false
            }
            try {
                await this.processOutbox();
            }
            catch (error) {
                logger_1.logger.error("Error processing outbox", {
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
    async stopBackgroundProcessing() {
        if (!this.isBackgroundProcessing) {
            return;
        }
        logger_1.logger.info("Stopping background outbox processing");
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
                logger_1.logger.info("Kafka producer disconnected");
            }
            catch (error) {
                logger_1.logger.error("Error disconnecting Kafka producer", {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
}
exports.EventOutboxPublisher = EventOutboxPublisher;
