/**
 * Kafka Event System - Centralized Exports
 * 
 * Provides unified access to Kafka-related utilities, connection management,
 * and event handling components.
 */

// Core Kafka components
export { KafkaConsumer, type KafkaConsumerConfig, type KafkaMessage } from "./kafka-consumer";
export { KafkaEventStore, type KafkaConfig } from "./store-kafka";
export { EventOutboxPublisher } from "./outbox-publisher";
export { KafkaDLQ } from "./kafka-dlq";

// Connection management
export { KafkaConnectionManager, type ConnectionState } from "./kafka-connection-manager";

// Utilities
export {
  validateBrokerConfig,
  isConnectionError,
  getConnectionErrorDetails,
  logConnectionError,
  createKafkaConfig,
  connectWithRetry,
  type BrokerValidationResult,
} from "./kafka-utils";

// Types
export type { EventEnvelope, EventStore } from "./types";
