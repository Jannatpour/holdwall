/**
 * Rate Limiting with Redis
 * Production rate limiting implementation
 */

import type Redis from "ioredis";
import { getRedisClient } from "@/lib/cache/redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const client = getRedisClient();
  if (!client) {
    // If Redis is not available, allow (graceful degradation)
    return {
      allowed: true,
      remaining: limit,
      resetAt: Date.now() + windowSeconds * 1000,
    };
  }

  const redisKey = `ratelimit:${key}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  try {
    // Get current count
    const count = await client.get(redisKey);
    const currentCount = count ? parseInt(count, 10) : 0;

    if (currentCount >= limit) {
      // Check TTL to get reset time
      const ttl = await client.ttl(redisKey);
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + (ttl > 0 ? ttl * 1000 : windowMs),
      };
    }

    // Increment counter
    const pipeline = client.pipeline();
    pipeline.incr(redisKey);
    pipeline.expire(redisKey, windowSeconds);
    await pipeline.exec();

    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      resetAt: now + windowMs,
    };
  } catch (error) {
    console.error("Rate limit check error:", error);
    // On error, allow (fail open)
    return {
      allowed: true,
      remaining: limit,
      resetAt: now + windowMs,
    };
  }
}
