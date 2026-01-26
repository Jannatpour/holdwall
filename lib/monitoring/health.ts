/**
 * Health Checks & Monitoring
 * Production health check endpoints
 */

import { db } from "@/lib/db/client";
import { getRedisClient } from "@/lib/cache/redis";
import { checkStagingParity } from "@/lib/environment/staging-parity";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version?: string;
  uptime_seconds: number;
  environment?: "development" | "staging" | "production";
  checks: {
    database: "ok" | "error";
    cache?: "ok" | "error" | "not_configured";
    kafka?: "ok" | "error" | "not_configured" | "not_checked";
    memory: {
      used: number;
      total: number;
      percentage: number;
      status: "ok" | "warning" | "critical";
    };
    disk?: {
      used: number;
      total: number;
      percentage: number;
      status: "ok" | "warning" | "critical";
    };
    external_services?: {
      openai?: "ok" | "error" | "not_configured";
      anthropic?: "ok" | "error" | "not_configured";
    };
    environment?: {
      critical_vars: "ok" | "error" | "warning";
      domain_alignment: "ok" | "error" | "warning";
      secrets: "ok" | "error" | "warning";
    };
    readiness?: {
      database_reachable: boolean;
      critical_env_present: boolean;
      domain_canonical: boolean;
      rate_limiting_available: boolean;
    };
  };
}

// Backwards-compatible alias used by health monitor
export type SystemHealth = HealthStatus;

export async function checkHealth(): Promise<HealthStatus> {
  const startTime = Date.now();
  const normalizeUrl = (value: string | undefined) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.endsWith("/") ? trimmed.replace(/\/+$/, "") : trimmed;
  };

  const checks: HealthStatus["checks"] = {
    database: "error",
    memory: {
      used: 0,
      total: 0,
      percentage: 0,
      status: "ok",
    },
  };

  const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timeoutId: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        }),
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  // Check database
  try {
    // DB connectivity is a hard requirement; latency can vary (cold starts, poolers).
    // Treat any successful query as "ok" and let higher-level SLOs handle latency.
    await withTimeout(db.$queryRaw`SELECT 1`, 4000, "Database health check");
    checks.database = "ok";
  } catch (error) {
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Database health check failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Fallback: If serverless cannot reach Postgres directly, try a lightweight Supabase REST call.
    // This helps distinguish "DB unreachable from Vercel" vs "project fully down".
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
      if (supabaseUrl && serviceRoleKey) {
        const baseUrl = supabaseUrl.replace(/\/+$/, "");
        const resp = await withTimeout(
          fetch(`${baseUrl}/rest/v1/User?select=id&limit=1`, {
            method: "GET",
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              Accept: "application/json",
            },
          }),
          1500,
          "Supabase REST health check"
        );
        if (resp.ok) {
          checks.database = "ok";
        } else {
          checks.database = "error";
        }
      } else {
        checks.database = "error";
      }
    } catch {
      checks.database = "error";
    }
  }

  // Check cache (optional)
  const redis = getRedisClient();
  if (redis) {
    try {
      const cacheStart = Date.now();
      await withTimeout(redis.ping(), 750, "Redis health check");
      const cacheLatency = Date.now() - cacheStart;
      checks.cache = cacheLatency < 100 ? "ok" : "error";
    } catch (error) {
      checks.cache = "error";
    }
  } else {
    checks.cache = "not_configured";
  }

  // Kafka connectivity (optional; disabled by default to keep /api/health fast)
  // Enable explicitly with HEALTH_INCLUDE_KAFKA=true.
  try {
    const kafkaEnabled = process.env.KAFKA_ENABLED === "true";
    const brokers = process.env.KAFKA_BROKERS?.trim();
    if (!kafkaEnabled || !brokers) {
      checks.kafka = "not_configured";
    } else if (process.env.HEALTH_INCLUDE_KAFKA !== "true") {
      checks.kafka = "not_checked";
    } else {
      const { Kafka } = await import("kafkajs");
      const kafka = new Kafka({
        clientId: "holdwall-health-check",
        brokers: brokers.split(",").map((b) => b.trim()).filter(Boolean),
      });
      const producer = kafka.producer();
      await withTimeout(producer.connect(), 1500, "Kafka connect");
      await withTimeout(producer.disconnect(), 1500, "Kafka disconnect");
      checks.kafka = "ok";
    }
  } catch {
    checks.kafka = "error";
  }

  // Check memory
  if (typeof process.memoryUsage === "function") {
    const usage = process.memoryUsage();
    // `heapTotal` is the currently allocated heap, not the process limit.
    // Use V8 heap size limit for an accurate saturation signal.
    let heapLimit = usage.heapTotal || 1;
    try {
      const v8 = await import("node:v8");
      heapLimit = (v8.getHeapStatistics().heap_size_limit as number) || heapLimit;
    } catch {
      // Ignore: V8 stats may be unavailable in some runtimes/bundlers.
    }
    const percentage = (usage.heapUsed / heapLimit) * 100;
    checks.memory = {
      used: usage.heapUsed,
      total: heapLimit,
      percentage,
      status: percentage > 90 ? "critical" : percentage > 75 ? "warning" : "ok",
    };
  }

  // Check external services
  checks.external_services = {};
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await withTimeout(
        fetch("https://api.openai.com/v1/models", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
        }),
        1500,
        "OpenAI health check"
      );
      checks.external_services.openai = response.ok ? "ok" : "error";
    } catch {
      checks.external_services.openai = "error";
    }
  } else {
    checks.external_services.openai = "not_configured";
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await withTimeout(
        fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 1,
            messages: [{ role: "user", content: "test" }],
          }),
        }),
        1500,
        "Anthropic health check"
      );
      checks.external_services.anthropic = response.ok || response.status === 400 ? "ok" : "error";
    } catch {
      checks.external_services.anthropic = "error";
    }
  } else {
    checks.external_services.anthropic = "not_configured";
  }

  // Vercel-ready environment checks
  const criticalEnvVars = [
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
  ];
  const missingCritical = criticalEnvVars.filter((v) => !process.env[v]);
  const envStatus = missingCritical.length === 0 ? "ok" : missingCritical.length === 1 ? "warning" : "error";

  // Domain alignment check (ensure NEXTAUTH_URL matches canonical host)
  // Production canonical host: https://www.holdwall.com
  let domainAlignment: "ok" | "error" | "warning" = "ok";
  const nextAuthUrl = normalizeUrl(process.env.NEXTAUTH_URL);
  if (nextAuthUrl) {
    try {
      const url = new URL(nextAuthUrl);
      // In production, should be https
      if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
        domainAlignment = "warning";
      }
      // Check if URL matches expected canonical domain (www.holdwall.com)
      const canonicalDomain = normalizeUrl(process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL);
      const expectedProductionDomain = "www.holdwall.com";
      
      if (process.env.NODE_ENV === "production") {
        // In production, enforce canonical domain
        if (url.hostname !== expectedProductionDomain && !url.hostname.includes("vercel.app")) {
          // Allow Vercel preview URLs in staging, but warn if not canonical
          domainAlignment = url.hostname.includes("staging") || url.hostname.includes("stage") ? "warning" : "error";
        }
      } else if (canonicalDomain) {
        try {
          const canonicalUrl = new URL(canonicalDomain);
          if (url.hostname !== canonicalUrl.hostname) {
            domainAlignment = "warning";
          }
        } catch {
          // Ignore invalid canonical URL
        }
      }
    } catch {
      domainAlignment = "error";
    }
  } else {
    domainAlignment = "error";
  }

  // Secrets check (ensure secrets are set, not using fallbacks in production)
  let secretsStatus: "ok" | "error" | "warning" = "ok";
  if (process.env.NODE_ENV === "production") {
    if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.includes("fallback")) {
      secretsStatus = "error";
    } else if (!process.env.EVIDENCE_SIGNING_SECRET || !process.env.CSRF_SECRET) {
      secretsStatus = "warning";
    }
  }

  checks.environment = {
    critical_vars: envStatus,
    domain_alignment: domainAlignment,
    secrets: secretsStatus,
  };

  // Readiness contract (for Vercel deployment checks)
  checks.readiness = {
    database_reachable: checks.database === "ok",
    critical_env_present: envStatus === "ok",
    domain_canonical: domainAlignment === "ok",
    rate_limiting_available: checks.cache === "ok" || checks.cache === "not_configured", // Rate limiting can work with in-memory fallback
  };

  // Staging parity checks can be expensive (DB + Redis checks).
  // Do not block the health endpoint unless explicitly requested.
  if (process.env.HEALTH_INCLUDE_PARITY === "true") {
    try {
      await withTimeout(checkStagingParity(), 1500, "Staging parity check");
    } catch (error) {
      const { logger: healthLogger } = await import("@/lib/logging/logger");
      healthLogger.warn("Staging parity check skipped/failed during health check", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Determine overall status
  let status: HealthStatus["status"] = "healthy";
  if (checks.database === "error" || checks.environment?.critical_vars === "error" || checks.environment?.secrets === "error") {
    status = "unhealthy";
  } else if (
    checks.cache === "error" ||
    checks.memory.status === "critical" ||
    checks.environment?.domain_alignment === "error" ||
    (checks.external_services?.openai === "error" && checks.external_services?.anthropic === "error")
  ) {
    status = "degraded";
  }

  // Determine environment
  let environment: "development" | "staging" | "production" | undefined;
  if (process.env.NODE_ENV === "production") {
    const url = nextAuthUrl ? new URL(nextAuthUrl) : null;
    if (url?.hostname?.includes("staging") || url?.hostname?.includes("stage")) {
      environment = "staging";
    } else {
      environment = "production";
    }
  } else {
    environment = "development";
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    uptime_seconds: Math.floor(process.uptime()),
    environment,
    checks,
  };
}
