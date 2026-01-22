/**
 * Connection Pool
 * 
 * Enhanced connection pooling for database, Redis, and vector DBs
 * Reuses connections to reduce overhead
 */

import Redis from "ioredis";
import { Pool as PGPool } from "pg";
import { logger } from "@/lib/logging/logger";

// Database connection pool (Prisma handles this, but we can add custom pool config)
let pgPool: PGPool | null = null;
let redisPool: Redis | null = null;

/**
 * Get or create PostgreSQL connection pool
 */
export function getPostgresPool(): PGPool | null {
  if (pgPool) {
    return pgPool;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  try {
    // Prisma manages the pool, but we can create a direct pool for custom queries
    // In production, Prisma's connection pooling is usually sufficient
    // This is for cases where direct pg access is needed
    pgPool = new PGPool({
      connectionString: databaseUrl,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pgPool.on("error", (err) => {
      logger.error("PostgreSQL pool error", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    });

    return pgPool;
  } catch (error) {
    logger.error("Failed to create PostgreSQL pool", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Get or create Redis connection (already pooled by ioredis)
 */
export function getRedisPool(): Redis | null {
  if (redisPool) {
    return redisPool;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  try {
    redisPool = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      // Connection pool settings
      enableReadyCheck: true,
      enableOfflineQueue: false,
    });

    redisPool.on("error", (err) => {
      logger.error("Redis pool error", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    });

    return redisPool;
  } catch (error) {
    logger.error("Failed to create Redis pool", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Close all pools (for graceful shutdown)
 */
export async function closePools(): Promise<void> {
  const promises: Promise<void>[] = [];

  if (pgPool) {
    promises.push(pgPool.end().then(() => { pgPool = null; }));
  }

  if (redisPool) {
    promises.push(redisPool.quit().then(() => { redisPool = null; }));
  }

  await Promise.allSettled(promises);
}

/**
 * Health check for connection pools
 */
export async function checkPoolHealth(): Promise<{
  postgres: "ok" | "error" | "not_configured";
  redis: "ok" | "error" | "not_configured";
}> {
  const health: {
    postgres: "ok" | "error" | "not_configured";
    redis: "ok" | "error" | "not_configured";
  } = {
    postgres: "not_configured",
    redis: "not_configured",
  };

  // Check PostgreSQL
  const pg = getPostgresPool();
  if (pg) {
    try {
      await pg.query("SELECT 1");
      health.postgres = "ok";
    } catch {
      health.postgres = "error";
    }
  }

  // Check Redis
  const redis = getRedisPool();
  if (redis) {
    try {
      await redis.ping();
      health.redis = "ok";
    } catch {
      health.redis = "error";
    }
  }

  return health;
}
