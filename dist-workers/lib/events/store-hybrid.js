"use strict";
/**
 * Hybrid Event Store
 *
 * Combines Kafka for streaming with database for queries and lookups.
 * Best of both worlds: real-time streaming + efficient querying.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridEventStore = void 0;
const store_db_1 = require("./store-db");
const store_kafka_1 = require("./store-kafka");
const logger_1 = require("@/lib/logging/logger");
class HybridEventStore {
    constructor(kafkaConfig) {
        this.kafkaStore = null;
        this.dbStore = new store_db_1.DatabaseEventStore();
        this.useKafka = !!kafkaConfig;
        if (kafkaConfig) {
            this.kafkaStore = new store_kafka_1.KafkaEventStore(kafkaConfig);
        }
    }
    /**
     * Append event to both database and Kafka
     */
    async append(event) {
        // Write to database first (for consistency)
        await this.dbStore.append(event);
        // Then publish to Kafka (for streaming)
        if (this.kafkaStore) {
            try {
                await this.kafkaStore.append(event);
            }
            catch (error) {
                // Log but don't fail - database write succeeded
                logger_1.logger.warn("Kafka append failed, but database write succeeded", {
                    error: error instanceof Error ? error.message : String(error),
                    eventId: event.event_id,
                    eventType: event.type,
                });
            }
        }
    }
    /**
     * Get event from database
     */
    async get(event_id) {
        return await this.dbStore.get(event_id);
    }
    /**
     * Query events from database
     */
    async query(filters) {
        return await this.dbStore.query(filters);
    }
    /**
     * Stream events from Kafka (if available) or database (fallback)
     */
    async stream(filters, handler, options) {
        if (this.kafkaStore) {
            // Use Kafka for real-time streaming
            await this.kafkaStore.stream(filters, handler, options);
        }
        else {
            // Fallback to database polling
            await this.dbStore.stream(filters, handler, options);
        }
    }
}
exports.HybridEventStore = HybridEventStore;
