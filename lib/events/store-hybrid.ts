/**
 * Hybrid Event Store
 * 
 * Combines Kafka for streaming with database for queries and lookups.
 * Best of both worlds: real-time streaming + efficient querying.
 */

import type { EventEnvelope, EventStore } from "./types";
import { DatabaseEventStore } from "./store-db";
import { KafkaEventStore, type KafkaConfig } from "./store-kafka";
import { logger } from "@/lib/logging/logger";

export class HybridEventStore implements EventStore {
  private dbStore: DatabaseEventStore;
  private kafkaStore: KafkaEventStore | null = null;
  private useKafka: boolean;

  constructor(kafkaConfig?: KafkaConfig) {
    this.dbStore = new DatabaseEventStore();
    this.useKafka = !!kafkaConfig;
    
    if (kafkaConfig) {
      this.kafkaStore = new KafkaEventStore(kafkaConfig);
    }
  }

  /**
   * Append event to both database and Kafka
   */
  async append(event: EventEnvelope): Promise<void> {
    // Write to database first (for consistency)
    await this.dbStore.append(event);

    // Then publish to Kafka (for streaming)
    if (this.kafkaStore) {
      try {
        await this.kafkaStore.append(event);
      } catch (error) {
        // Log but don't fail - database write succeeded
        logger.warn("Kafka append failed, but database write succeeded", {
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
  async get(event_id: string): Promise<EventEnvelope | null> {
    return await this.dbStore.get(event_id);
  }

  /**
   * Query events from database
   */
  async query(filters: {
    tenant_id?: string;
    type?: string;
    correlation_id?: string;
    occurred_after?: string;
    occurred_before?: string;
  }): Promise<EventEnvelope[]> {
    return await this.dbStore.query(filters);
  }

  /**
   * Stream events from Kafka (if available) or database (fallback)
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
    if (this.kafkaStore) {
      // Use Kafka for real-time streaming
      await this.kafkaStore.stream(filters, handler, options);
    } else {
      // Fallback to database polling
      await this.dbStore.stream(filters, handler, options);
    }
  }
}
