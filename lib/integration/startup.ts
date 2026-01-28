/**
 * Application Startup
 * Initialize all services and perform startup checks
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { healthMonitor } from "./health-monitor";
import { getRedisClient } from "@/lib/cache/redis";
import { db } from "@/lib/db/client";
import { initializeBroadcaster } from "@/lib/events/broadcast-helper";
import { DynamicLoadBalancer, type LoadBalancingConfig } from "@/lib/load-balancing/distributor";
import { enforceStagingParity } from "@/lib/environment/staging-parity";
import { isConnectionError, logConnectionError } from "@/lib/events/kafka-utils";

export interface StartupResult {
  success: boolean;
  services: {
    database: boolean;
    cache: boolean;
    metrics: boolean;
    loadBalancer: boolean;
    kafka: boolean;
    graphql: boolean;
  };
  errors: string[];
}

/**
 * Initialize application services
 */
// Global load balancer instance
let globalLoadBalancer: DynamicLoadBalancer | null = null;

export function getLoadBalancer(): DynamicLoadBalancer | null {
  return globalLoadBalancer;
}

export async function initializeServices(): Promise<StartupResult> {
  const result: StartupResult = {
    success: true,
    services: {
      database: false,
      cache: false,
      metrics: true, // Always available (in-memory)
      loadBalancer: false,
      kafka: false,
      graphql: false,
    },
    errors: [],
  };

  // Enforce staging parity (environment contracts)
  try {
    await enforceStagingParity();
    logger.info("Staging parity check passed");
  } catch (error) {
    result.success = false;
    result.errors.push(`Staging parity check failed: ${error instanceof Error ? error.message : String(error)}`);
    logger.error("Staging parity enforcement failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    // In production/staging, fail startup if parity check fails
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
  }

  // Check database
  try {
    await db.$queryRaw`SELECT 1`;
    result.services.database = true;
    logger.info("Database connection established");
  } catch (error) {
    result.success = false;
    result.errors.push(`Database connection failed: ${error}`);
    logger.error("Database connection failed", { error });
  }

  // Check cache
  try {
    const redis = getRedisClient();
    if (redis) {
      await redis.ping();
      result.services.cache = true;
      logger.info("Redis cache connection established");
    } else {
      logger.warn("Redis cache not configured, using in-memory fallback");
    }
  } catch (error) {
    result.errors.push(`Cache connection failed: ${error}`);
    logger.warn("Cache connection failed, using fallback", { error });
  }

  // Start health monitoring
  if (process.env.NODE_ENV === "production") {
    healthMonitor.start();
    logger.info("Health monitoring started");
  }

  // Initialize entity broadcaster (for WebSocket real-time updates)
  try {
    initializeBroadcaster();
    logger.info("Entity broadcaster initialized");
  } catch (error) {
    logger.warn("Entity broadcaster initialization failed", { error });
  }

  // Initialize Protocol Bridge (unified agent orchestration)
  try {
    const { getProtocolBridge } = await import("@/lib/agents/protocol-bridge");
    const protocolBridge = getProtocolBridge();
    const capabilities = protocolBridge.getProtocolCapabilities();
    logger.info("Protocol Bridge initialized", {
      protocols: Object.keys(capabilities),
      totalCapabilities: Object.values(capabilities).flat().length,
    });
  } catch (error) {
    result.errors.push(`Protocol Bridge initialization failed: ${error}`);
    logger.warn("Protocol Bridge initialization failed", { error });
  }

  // Initialize Dynamic Load Balancer
  try {
    if (process.env.LB_ENABLED !== "false") {
      const config: LoadBalancingConfig = {
        strategy: (process.env.LB_STRATEGY as any) || "least-connections",
        healthCheckInterval: parseInt(process.env.LB_HEALTH_CHECK_INTERVAL || "30000", 10),
        healthCheckTimeout: parseInt(process.env.LB_HEALTH_CHECK_TIMEOUT || "5000", 10),
        maxRetries: 3,
        retryBackoff: 1000,
        enableAutoScaling: process.env.LB_AUTO_SCALING === "true",
        autoScalingPolicy: process.env.LB_AUTO_SCALING === "true" ? {
          minInstances: parseInt(process.env.LB_MIN_INSTANCES || "2", 10),
          maxInstances: parseInt(process.env.LB_MAX_INSTANCES || "10", 10),
          targetLoad: parseFloat(process.env.LB_TARGET_LOAD || "0.7"),
          scaleUpThreshold: parseFloat(process.env.LB_SCALE_UP_THRESHOLD || "0.8"),
          scaleDownThreshold: parseFloat(process.env.LB_SCALE_DOWN_THRESHOLD || "0.3"),
          scaleUpCooldown: parseInt(process.env.LB_SCALE_UP_COOLDOWN || "300000", 10),
          scaleDownCooldown: parseInt(process.env.LB_SCALE_DOWN_COOLDOWN || "600000", 10),
        scaleUpStep: parseInt(process.env.LB_SCALE_UP_STEP || "2", 10),
        scaleDownStep: parseInt(process.env.LB_SCALE_DOWN_STEP || "1", 10),
        } : undefined,
      };
      globalLoadBalancer = new DynamicLoadBalancer(config);
      result.services.loadBalancer = true;
      logger.info("Dynamic load balancer initialized", { strategy: config.strategy });
    } else {
      logger.info("Load balancer disabled via configuration");
    }
  } catch (error) {
    result.errors.push(`Load balancer initialization failed: ${error}`);
    logger.warn("Load balancer initialization failed", { error });
  }

  // Initialize Kafka consumers (if enabled)
  try {
    if (process.env.KAFKA_ENABLED === "true" && process.env.KAFKA_BROKERS) {
      // Kafka consumers are started lazily when needed
      // Just verify Kafka client can be initialized and optionally test connection
      try {
        const { Kafka } = require("kafkajs");
        const brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
          .split(",")
          .map((b: string) => b.trim())
          .filter(Boolean);
        
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

        const kafka = new Kafka({
          clientId: "holdwall-startup-check",
          brokers,
          ssl: tlsEnabled ? { rejectUnauthorized: true } : undefined,
          sasl,
          connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || "10000", 10),
          requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || "30000", 10),
        });
        
        // Test connection if KAFKA_VALIDATE_ON_STARTUP is enabled
        if (process.env.KAFKA_VALIDATE_ON_STARTUP === "true") {
          try {
            const producer = kafka.producer();
            await producer.connect();
            await producer.disconnect();
            logger.info("Kafka connection validated successfully", { brokers });
          } catch (connectError: any) {
            if (isConnectionError(connectError)) {
              logConnectionError(connectError, brokers, "startup-kafka-validate", {
                hint: "Check network connectivity, DNS resolution, and broker hostnames. Application will continue but Kafka features will be unavailable.",
              });
              result.errors.push(
                `Kafka connection failed: ${connectError instanceof Error ? connectError.message : String(connectError)}`
              );
            } else {
              const errorMessage = connectError instanceof Error ? connectError.message : String(connectError);
              logger.warn("Kafka connection test failed", { error: errorMessage, brokers });
              result.errors.push(`Kafka connection test failed: ${errorMessage}`);
            }
          }
        }
        
        result.services.kafka = true;
        logger.info("Kafka client initialized", { 
          brokers,
          validateOnStartup: process.env.KAFKA_VALIDATE_ON_STARTUP === "true",
        });
      } catch (kafkaError) {
        const errorMessage = kafkaError instanceof Error ? kafkaError.message : String(kafkaError);
        logger.warn("Kafka not available, event streaming will use database only", {
          error: errorMessage,
        });
        result.errors.push(`Kafka initialization failed: ${errorMessage}`);
      }
    } else {
      logger.info("Kafka disabled or not configured, using database event store only");
    }
  } catch (error) {
    logger.warn("Kafka initialization check failed", { 
      error: error instanceof Error ? error.message : String(error),
    });
    result.errors.push(`Kafka initialization check failed: ${error}`);
  }

  // Initialize GraphQL federation
  try {
    const { buildFederatedSchema } = await import("@/lib/graphql/federation");
    const schema = buildFederatedSchema();
    if (schema) {
      result.services.graphql = true;
      logger.info("GraphQL federation schema built successfully");
    }
  } catch (error) {
    result.errors.push(`GraphQL federation initialization failed: ${error}`);
    logger.warn("GraphQL federation initialization failed", { error });
  }

  // Record startup metrics
  metrics.increment("application_startups");
  metrics.setGauge("application_services_healthy", result.success ? 1 : 0);

  if (result.success) {
    logger.info("Application services initialized successfully");
  } else {
    logger.error("Application startup completed with errors", { errors: result.errors });
  }

  return result;
}

/**
 * Graceful shutdown
 */
export async function shutdownServices(): Promise<void> {
  logger.info("Shutting down services...");

  // Disconnect all Kafka connections
  try {
    // Disconnect outbox publisher
    const { EventOutboxPublisher, disconnectOutboxKafkaProducer } = await import("@/lib/events/outbox-publisher");
    const publisher = new EventOutboxPublisher();
    await publisher.stopBackgroundProcessing();
    await disconnectOutboxKafkaProducer();
    logger.info("Kafka outbox publisher stopped");
  } catch (error) {
    logger.warn("Error stopping Kafka outbox publisher", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Disconnect any active Kafka producers/consumers
  try {
    const { disconnectKafkaProducers } = await import("@/lib/events/store-db");
    await disconnectKafkaProducers();
  } catch (error) {
    logger.warn("Error disconnecting Kafka store producers", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Stop health monitoring
  healthMonitor.stop();

  // Stop load balancer
  if (globalLoadBalancer) {
    try {
      globalLoadBalancer.stop();
      logger.info("Load balancer stopped");
    } catch (error) {
      logger.error("Error stopping load balancer", { error });
    }
  }

  // Close database connections
  try {
    await db.$disconnect();
    logger.info("Database connections closed");
  } catch (error) {
    logger.error("Error closing database connections", { error });
  }

  // Close cache connections
  try {
    const redis = getRedisClient();
    if (redis) {
      redis.disconnect();
      logger.info("Cache connections closed");
    }
  } catch (error) {
    logger.error("Error closing cache connections", { error });
  }

  logger.info("Services shut down complete");
}

// Handle graceful shutdown
if (typeof process !== "undefined") {
  const shouldIgnoreAbortError = (err: unknown) => {
    if (process.env.NODE_ENV === "production") return false;
    if (!err || typeof err !== "object") return false;
    const anyErr = err as any;
    const message = typeof anyErr.message === "string" ? anyErr.message : "";
    const code = typeof anyErr.code === "string" ? anyErr.code : "";
    const name = typeof anyErr.name === "string" ? anyErr.name : "";
    // Next/undici will sometimes surface client disconnects as "aborted"/ECONNRESET.
    return (
      /aborted/i.test(message) ||
      name === "AbortError" ||
      code === "ECONNRESET"
    );
  };

  process.on("uncaughtException", (err) => {
    if (shouldIgnoreAbortError(err)) {
      logger.warn("Ignoring non-production abort error", {
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    logger.error("Uncaught exception", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    // Preserve fail-fast behavior for real errors
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    if (shouldIgnoreAbortError(reason)) {
      logger.warn("Ignoring non-production unhandled abort rejection", {
        error: reason instanceof Error ? reason.message : String(reason),
      });
      return;
    }
    logger.error("Unhandled rejection", {
      error: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  process.on("SIGTERM", async () => {
    await shutdownServices();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    await shutdownServices();
    process.exit(0);
  });
}
