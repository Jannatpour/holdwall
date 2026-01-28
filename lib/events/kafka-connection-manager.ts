/**
 * Kafka Connection Manager
 * 
 * Manages Kafka connections with circuit breaker pattern, connection state tracking,
 * and automatic retry with exponential backoff
 */

import { CircuitBreaker } from "@/lib/resilience/circuit-breaker";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import {
  isConnectionError,
  logConnectionError,
  connectWithRetry,
  validateBrokerConfig,
  type BrokerValidationResult,
} from "./kafka-utils";

export interface ConnectionState {
  connected: boolean;
  lastConnectionAttempt?: number;
  lastSuccessTime?: number;
  lastFailureTime?: number;
  failureCount: number;
  circuitBreakerState: "closed" | "open" | "half-open";
}

/**
 * Manages Kafka producer/consumer connections with circuit breaker protection
 */
export class KafkaConnectionManager {
  private circuitBreaker: CircuitBreaker;
  private connectionState: ConnectionState;
  private brokers: string[];
  private clientId: string;
  private kafkaClient: any = null;
  private producer: any = null;
  private consumer: any = null;

  constructor(options: {
    brokers: string[];
    clientId: string;
    circuitBreakerConfig?: {
      failureThreshold?: number;
      successThreshold?: number;
      timeout?: number;
      resetTimeout?: number;
    };
  }) {
    this.brokers = options.brokers;
    this.clientId = options.clientId;
    
    // Validate broker configuration
    const validation = validateBrokerConfig(this.brokers);
    if (!validation.valid) {
      logger.error("Invalid Kafka broker configuration", {
        errors: validation.errors,
        warnings: validation.warnings,
        brokers: this.brokers,
      });
      throw new Error(`Invalid Kafka broker configuration: ${validation.errors.join(", ")}`);
    }
    
    if (validation.warnings.length > 0) {
      logger.warn("Kafka broker configuration warnings", {
        warnings: validation.warnings,
        brokers: this.brokers,
      });
    }

    this.connectionState = {
      connected: false,
      failureCount: 0,
      circuitBreakerState: "closed",
    };

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: options.circuitBreakerConfig?.failureThreshold || 5,
      successThreshold: options.circuitBreakerConfig?.successThreshold || 2,
      timeout: options.circuitBreakerConfig?.timeout || 60000,
      resetTimeout: options.circuitBreakerConfig?.resetTimeout || 300000,
    });
  }

  /**
   * Initialize Kafka client
   */
  initializeKafkaClient(kafkaConfig?: any): void {
    try {
      const { Kafka } = require("kafkajs");
      this.kafkaClient = new Kafka({
        clientId: this.clientId,
        brokers: this.brokers,
        connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || "10000", 10),
        requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || "30000", 10),
        retry: {
          retries: 8,
          initialRetryTime: 100,
          multiplier: 2,
          maxRetryTime: 30000,
        },
        ...kafkaConfig, // Allow override of defaults
      });
    } catch (error) {
      logger.error("Failed to initialize Kafka client", {
        error: error instanceof Error ? error.message : String(error),
        brokers: this.brokers,
      });
      throw error;
    }
  }

  /**
   * Connect producer with circuit breaker protection
   */
  async connectProducer(producerConfig?: any): Promise<void> {
    if (!this.kafkaClient) {
      throw new Error("Kafka client not initialized. Call initializeKafkaClient first.");
    }

    if (this.producer?.isConnected) {
      return; // Already connected
    }

    await this.circuitBreaker.execute(
      async () => {
        if (!this.producer) {
          this.producer = this.kafkaClient.producer(producerConfig || {
            maxInFlightRequests: 1,
            idempotent: true,
            transactionTimeout: 30000,
          });
        }

        await connectWithRetry(
          async () => {
            await this.producer.connect();
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            context: `producer-${this.clientId}`,
            brokers: this.brokers,
          }
        );

        this.updateConnectionState(true);
        metrics.increment("kafka_connections", { type: "producer", client_id: this.clientId });
        logger.info("Kafka producer connected", {
          clientId: this.clientId,
          brokers: this.brokers,
        });
      },
      async () => {
        // Fallback: mark as disconnected but don't throw
        this.updateConnectionState(false);
        logger.warn("Kafka producer connection failed, circuit breaker open", {
          clientId: this.clientId,
          brokers: this.brokers,
        });
        throw new Error("Kafka producer connection failed - circuit breaker open");
      }
    );
  }

  /**
   * Connect consumer with circuit breaker protection
   */
  async connectConsumer(consumerConfig: {
    groupId: string;
    sessionTimeout?: number;
    heartbeatInterval?: number;
  }): Promise<void> {
    if (!this.kafkaClient) {
      throw new Error("Kafka client not initialized. Call initializeKafkaClient first.");
    }

    if (this.consumer?.isConnected) {
      return; // Already connected
    }

    await this.circuitBreaker.execute(
      async () => {
        if (!this.consumer) {
          this.consumer = this.kafkaClient.consumer({
            groupId: consumerConfig.groupId,
            sessionTimeout: consumerConfig.sessionTimeout || 30000,
            heartbeatInterval: consumerConfig.heartbeatInterval || 3000,
          });
        }

        await connectWithRetry(
          async () => {
            await this.consumer.connect();
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            context: `consumer-${this.clientId}`,
            brokers: this.brokers,
          }
        );

        this.updateConnectionState(true);
        metrics.increment("kafka_connections", { type: "consumer", client_id: this.clientId });
        logger.info("Kafka consumer connected", {
          clientId: this.clientId,
          groupId: consumerConfig.groupId,
          brokers: this.brokers,
        });
      },
      async () => {
        // Fallback: mark as disconnected but don't throw
        this.updateConnectionState(false);
        logger.warn("Kafka consumer connection failed, circuit breaker open", {
          clientId: this.clientId,
          brokers: this.brokers,
        });
        throw new Error("Kafka consumer connection failed - circuit breaker open");
      }
    );
  }

  /**
   * Disconnect producer
   */
  async disconnectProducer(): Promise<void> {
    if (this.producer?.isConnected) {
      try {
        await this.producer.disconnect();
        this.updateConnectionState(false);
        logger.info("Kafka producer disconnected", { clientId: this.clientId });
      } catch (error) {
        logger.error("Error disconnecting Kafka producer", {
          error: error instanceof Error ? error.message : String(error),
          clientId: this.clientId,
        });
      }
    }
    this.producer = null;
  }

  /**
   * Disconnect consumer
   */
  async disconnectConsumer(): Promise<void> {
    if (this.consumer?.isConnected) {
      try {
        await this.consumer.disconnect();
        this.updateConnectionState(false);
        logger.info("Kafka consumer disconnected", { clientId: this.clientId });
      } catch (error) {
        logger.error("Error disconnecting Kafka consumer", {
          error: error instanceof Error ? error.message : String(error),
          clientId: this.clientId,
        });
      }
    }
    this.consumer = null;
  }

  /**
   * Get producer instance
   */
  getProducer(): any {
    return this.producer;
  }

  /**
   * Get consumer instance
   */
  getConsumer(): any {
    return this.consumer;
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return {
      ...this.connectionState,
      circuitBreakerState: this.circuitBreaker.getStats().state as "closed" | "open" | "half-open",
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return (
      this.connectionState.connected &&
      (this.producer?.isConnected || this.consumer?.isConnected)
    );
  }

  /**
   * Update connection state
   */
  private updateConnectionState(connected: boolean): void {
    this.connectionState.connected = connected;
    this.connectionState.lastConnectionAttempt = Date.now();
    
    if (connected) {
      this.connectionState.lastSuccessTime = Date.now();
      this.connectionState.failureCount = 0;
    } else {
      this.connectionState.lastFailureTime = Date.now();
      this.connectionState.failureCount++;
    }
  }

  /**
   * Reset connection state (useful for testing or manual recovery)
   */
  reset(): void {
    this.connectionState = {
      connected: false,
      failureCount: 0,
      circuitBreakerState: "closed",
    };
    this.producer = null;
    this.consumer = null;
  }
}
