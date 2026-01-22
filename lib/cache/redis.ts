/**
 * Redis Cache
 * Production caching with Redis
 */

import Redis from "ioredis";

let redis: Redis | null = null;
const memoryCache: Map<string, { value: string; expiresAt?: number }> = new Map();

export function getRedisClient(): Redis | null {
  if (redis) {
    return redis;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null; // Redis is optional
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redis.on("error", (err) => {
      const { logger } = require("@/lib/logging/logger");
      logger.error("Redis connection error", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    });

    return redis;
  } catch (error) {
    const { logger } = require("@/lib/logging/logger");
    logger.warn("Failed to connect to Redis, using in-memory fallback", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

export async function getCache<T>(
  key: string
): Promise<T | null> {
  const client = getRedisClient();
  if (!client) {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== undefined && entry.expiresAt < Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return null;
    }
  }

  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    const { logger } = require("@/lib/logging/logger");
    logger.warn("Cache get error, returning null", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function setCache<T>(
  key: string,
  value: T,
  options?: CacheOptions
): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    try {
      const serialized = JSON.stringify(value);
      const expiresAt =
        options?.ttl !== undefined ? Date.now() + options.ttl * 1000 : undefined;
      memoryCache.set(key, { value: serialized, expiresAt });
    } catch {
      // ignore
    }
    return;
  }

  try {
    const serialized = JSON.stringify(value);
    if (options?.ttl) {
      await client.setex(key, options.ttl, serialized);
    } else {
      await client.set(key, serialized);
    }
  } catch (error) {
    const { logger } = require("@/lib/logging/logger");
    logger.warn("Cache set error", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function deleteCache(key: string): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    memoryCache.delete(key);
    return;
  }

  try {
    await client.del(key);
  } catch (error) {
    const { logger } = require("@/lib/logging/logger");
    logger.warn("Cache delete error", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function clearCache(pattern: string): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    // Best-effort in-memory clear; pattern is a Redis glob.
    // Support a simple prefix before '*'.
    const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
    for (const key of Array.from(memoryCache.keys())) {
      if (pattern === "*" || key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }
    return;
  }

  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (error) {
    const { logger } = require("@/lib/logging/logger");
    logger.warn("Cache clear error", {
      pattern,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
