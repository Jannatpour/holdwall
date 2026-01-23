/**
 * Health Checks & Monitoring
 * Production health check endpoints
 */

import { db } from "@/lib/db/client";
import Redis from "ioredis";

// Get Redis client directly (since it's now private in redis.ts)
function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }
  try {
    return new Redis(redisUrl);
  } catch {
    return null;
  }
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version?: string;
  uptime_seconds: number;
  checks: {
    database: "ok" | "error";
    cache?: "ok" | "error" | "not_configured";
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
  };
}

// Backwards-compatible alias used by health monitor
export type SystemHealth = HealthStatus;

export async function checkHealth(): Promise<HealthStatus> {
  const startTime = Date.now();
  const checks: HealthStatus["checks"] = {
    database: "error",
    memory: {
      used: 0,
      total: 0,
      percentage: 0,
      status: "ok",
    },
  };

  // Check database
  try {
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;
    checks.database = dbLatency < 1000 ? "ok" : "error";
  } catch (error) {
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Database health check failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    checks.database = "error";
  }

  // Check cache (optional)
  const redis = getRedisClient();
  if (redis) {
    try {
      const cacheStart = Date.now();
      await redis.ping();
      const cacheLatency = Date.now() - cacheStart;
      checks.cache = cacheLatency < 100 ? "ok" : "error";
    } catch (error) {
      checks.cache = "error";
    }
  } else {
    checks.cache = "not_configured";
  }

  // Check memory
  if (typeof process.memoryUsage === "function") {
    const usage = process.memoryUsage();
    const percentage = (usage.heapUsed / usage.heapTotal) * 100;
    checks.memory = {
      used: usage.heapUsed,
      total: usage.heapTotal,
      percentage,
      status: percentage > 90 ? "critical" : percentage > 75 ? "warning" : "ok",
    };
  }

  // Check external services
  checks.external_services = {};
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      checks.external_services.openai = response.ok ? "ok" : "error";
    } catch {
      checks.external_services.openai = "error";
    }
  } else {
    checks.external_services.openai = "not_configured";
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
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
        signal: AbortSignal.timeout(5000),
      });
      checks.external_services.anthropic = response.ok || response.status === 400 ? "ok" : "error";
    } catch {
      checks.external_services.anthropic = "error";
    }
  } else {
    checks.external_services.anthropic = "not_configured";
  }

  // Determine overall status
  let status: HealthStatus["status"] = "healthy";
  if (checks.database === "error") {
    status = "unhealthy";
  } else if (
    checks.cache === "error" ||
    checks.memory.status === "critical" ||
    (checks.external_services?.openai === "error" && checks.external_services?.anthropic === "error")
  ) {
    status = "degraded";
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    uptime_seconds: Math.floor(process.uptime()),
    checks,
  };
}
