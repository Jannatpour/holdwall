/**
 * Kafka Utility Functions
 * 
 * Provides helper functions for Kafka connection management, validation, and diagnostics
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

export interface BrokerValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  brokers: Array<{
    hostname: string;
    port: number;
    valid: boolean;
    error?: string;
  }>;
}

/**
 * Validate Kafka broker configuration
 */
export function validateBrokerConfig(brokers: string[]): BrokerValidationResult {
  const result: BrokerValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    brokers: [],
  };

  if (!brokers || brokers.length === 0) {
    result.valid = false;
    result.errors.push("No brokers configured");
    return result;
  }

  for (const broker of brokers) {
    const trimmed = broker.trim();
    if (!trimmed) {
      result.warnings.push("Empty broker entry found");
      continue;
    }

    // Parse hostname:port
    const parts = trimmed.split(":");
    if (parts.length !== 2) {
      result.valid = false;
      result.errors.push(`Invalid broker format: ${trimmed} (expected hostname:port)`);
      result.brokers.push({
        hostname: trimmed,
        port: 0,
        valid: false,
        error: "Invalid format",
      });
      continue;
    }

    const hostname = parts[0].trim();
    const port = parseInt(parts[1].trim(), 10);

    if (!hostname) {
      result.valid = false;
      result.errors.push(`Empty hostname in broker: ${trimmed}`);
      result.brokers.push({
        hostname: trimmed,
        port: 0,
        valid: false,
        error: "Empty hostname",
      });
      continue;
    }

    if (isNaN(port) || port < 1 || port > 65535) {
      result.valid = false;
      result.errors.push(`Invalid port in broker: ${trimmed} (must be 1-65535)`);
      result.brokers.push({
        hostname,
        port: 0,
        valid: false,
        error: "Invalid port",
      });
      continue;
    }

    // Check for common issues
    if (hostname === "localhost" && process.env.NODE_ENV === "production") {
      result.warnings.push(`Using localhost in production: ${trimmed}`);
    }

    if (hostname.includes("amazonaws.com") && !hostname.includes("kafka")) {
      result.warnings.push(`AWS hostname may not be a Kafka broker: ${trimmed}`);
    }

    result.brokers.push({
      hostname,
      port,
      valid: true,
    });
  }

  return result;
}

/**
 * Check if an error is a connection/DNS error
 */
export function isConnectionError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error?.name || "";
  
  return (
    errorMessage.includes("ENOTFOUND") ||
    errorMessage.includes("getaddrinfo") ||
    errorMessage.includes("Connection error") ||
    errorMessage.includes("ECONNREFUSED") ||
    errorMessage.includes("ETIMEDOUT") ||
    errorName === "KafkaJSConnectionError" ||
    errorName === "KafkaJSNonRetriableError"
  );
}

type ConnectionLogState = {
  lastLoggedAt: number;
  suppressed: number;
};

// In-process throttle to prevent log spam when Kafka is unreachable.
// Note: this is intentionally in-memory; if your process is crash-looping,
// fix the caller to retry instead of exiting (see Kafka consumer changes).
const connectionErrorLogState = new Map<string, ConnectionLogState>();

function getConnectionErrorLogThrottleMs(): number {
  const raw = process.env.KAFKA_CONNECTION_ERROR_LOG_THROTTLE_MS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  // Default: 5 minutes
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5 * 60 * 1000;
}

function normalizeConnectionErrorSignature(message: string): string {
  const msg = message || "";
  if (/ENOTFOUND/i.test(msg)) return "ENOTFOUND";
  if (/getaddrinfo/i.test(msg)) return "getaddrinfo";
  if (/ECONNREFUSED/i.test(msg)) return "ECONNREFUSED";
  if (/ETIMEDOUT/i.test(msg)) return "ETIMEDOUT";
  if (/SSL|TLS/i.test(msg)) return "TLS_SSL";
  if (/SASL|auth/i.test(msg)) return "AUTH";
  // Keep it short to avoid cardinality explosion.
  return msg.slice(0, 120);
}

/**
 * Get detailed error information for logging
 */
export function getConnectionErrorDetails(error: any, brokers: string[]): {
  message: string;
  type: "dns" | "network" | "auth" | "timeout" | "unknown";
  hints: string[];
} {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const hints: string[] = [];
  let type: "dns" | "network" | "auth" | "timeout" | "unknown" = "unknown";

  if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("getaddrinfo")) {
    type = "dns";
    hints.push("DNS resolution failed - check if broker hostnames are correct");
    hints.push("Verify network connectivity and DNS configuration");
    hints.push("For AWS MSK, ensure VPC/DNS settings allow resolution");
  } else if (errorMessage.includes("ECONNREFUSED")) {
    type = "network";
    hints.push("Connection refused - broker may be down or port is incorrect");
    hints.push("Check firewall rules and security groups");
    hints.push("Verify broker is running and accessible");
  } else if (errorMessage.includes("ETIMEDOUT") || errorMessage.includes("timeout")) {
    type = "timeout";
    hints.push("Connection timeout - broker may be slow or unreachable");
    hints.push("Check network latency and firewall rules");
    hints.push("Consider increasing KAFKA_CONNECTION_TIMEOUT");
  } else if (errorMessage.includes("SASL") || errorMessage.includes("authentication")) {
    type = "auth";
    hints.push("Authentication failed - check KAFKA_SASL_* credentials");
    hints.push("Verify SASL mechanism matches broker configuration");
  } else if (errorMessage.includes("SSL") || errorMessage.includes("TLS")) {
    type = "auth";
    hints.push("TLS/SSL error - check certificate configuration");
    hints.push("Verify KAFKA_SSL or KAFKA_TLS settings");
  }

  hints.push(`Configured brokers: ${brokers.join(", ")}`);
  hints.push("Check KAFKA_BROKERS environment variable");

  return {
    message: errorMessage,
    type,
    hints,
  };
}

/**
 * Log connection error with full context
 */
export function logConnectionError(
  error: any,
  brokers: string[],
  context: string,
  additionalInfo?: Record<string, any>
): void {
  const details = getConnectionErrorDetails(error, brokers);

  const now = Date.now();
  const throttleMs = getConnectionErrorLogThrottleMs();
  const signature = normalizeConnectionErrorSignature(details.message);
  const key = `${context}|${details.type}|${brokers.join(",")}|${signature}`;
  const state = connectionErrorLogState.get(key) || { lastLoggedAt: 0, suppressed: 0 };

  if (throttleMs > 0 && now - state.lastLoggedAt < throttleMs) {
    state.suppressed += 1;
    connectionErrorLogState.set(key, state);
    return;
  }
  
  logger.error(`Kafka connection error in ${context}`, {
    error: details.message,
    errorType: details.type,
    brokers,
    hints: details.hints,
    suppressedCountSinceLastLog: state.suppressed || 0,
    throttleMs,
    ...additionalInfo,
    stack: error instanceof Error ? error.stack : undefined,
  });

  connectionErrorLogState.set(key, { lastLoggedAt: now, suppressed: 0 });

  // Increment metrics
  metrics.increment("kafka_connection_errors", {
    error_type: details.type,
    context,
  });
}

/**
 * Create Kafka client configuration with proper timeouts and error handling
 */
export function createKafkaConfig(options: {
  clientId: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: {
    mechanism: string;
    username: string;
    password: string;
  };
}): any {
  const { Kafka } = require("kafkajs");
  
  const tlsEnabled =
    options.ssl ||
    process.env.KAFKA_SSL === "true" ||
    process.env.KAFKA_TLS === "true" ||
    options.brokers.some((b: string) => String(b).includes(":9094"));

  const sasl = options.sasl || (() => {
    const saslMechanism = process.env.KAFKA_SASL_MECHANISM?.trim();
    const saslUsername = process.env.KAFKA_SASL_USERNAME?.trim();
    const saslPassword = process.env.KAFKA_SASL_PASSWORD?.trim();
    return saslMechanism && saslUsername && saslPassword
      ? {
          mechanism: saslMechanism as any,
          username: saslUsername,
          password: saslPassword,
        }
      : undefined;
  })();

  return new Kafka({
    clientId: options.clientId,
    brokers: options.brokers,
    ssl: tlsEnabled ? { rejectUnauthorized: true } : undefined,
    sasl,
    connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || "10000", 10),
    requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || "30000", 10),
    retry: {
      retries: 8,
      initialRetryTime: 100,
      multiplier: 2,
      maxRetryTime: 30000,
    },
  });
}

/**
 * Attempt connection with retry and exponential backoff
 */
export async function connectWithRetry<T>(
  connectFn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    context?: string;
    brokers?: string[];
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    context = "unknown",
    brokers = [],
  } = options;

  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await connectFn();
    } catch (error) {
      lastError = error;
      
      if (isConnectionError(error)) {
        if (attempt < maxRetries) {
          const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
          logger.warn(`Kafka connection attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms`, {
            context,
            brokers,
            error: error instanceof Error ? error.message : String(error),
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } else {
          logConnectionError(error, brokers, context, {
            attempts: attempt + 1,
            finalAttempt: true,
          });
          throw error;
        }
      } else {
        // Non-connection error, don't retry
        throw error;
      }
    }
  }

  throw lastError;
}
