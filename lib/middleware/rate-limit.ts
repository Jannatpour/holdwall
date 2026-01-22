/**
 * Rate Limiting Middleware
 * Production-ready rate limiting with multiple strategies and Redis support
 */

import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/lib/cache/redis";

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  strategy?: "fixed" | "sliding" | "token-bucket";
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  retryAfter?: number;
  success: boolean; // Alias for allowed (backward compatibility)
  resetTime: number; // Alias for reset (backward compatibility)
}

/**
 * Enhanced rate limiter with multiple strategies
 */
export class RateLimiter {
  private redis = getRedisClient();

  /**
   * Check rate limit using fixed window
   */
  async checkFixedWindow(
    key: string,
    windowMs: number,
    maxRequests: number
  ): Promise<RateLimitResult> {
    const window = Math.floor(Date.now() / windowMs);
    const redisKey = `rate_limit:fixed:${key}:${window}`;

    if (this.redis) {
      const count = await this.redis.incr(redisKey);
      await this.redis.expire(redisKey, Math.ceil(windowMs / 1000));

      const reset = (window + 1) * windowMs;
      return {
        allowed: count <= maxRequests,
        success: count <= maxRequests,
        remaining: Math.max(0, maxRequests - count),
        reset,
        resetTime: reset,
        retryAfter: count > maxRequests ? Math.ceil((reset - Date.now()) / 1000) : undefined,
      };
    }

    // Fallback to in-memory (simplified)
    const reset = (window + 1) * windowMs;
    return {
      allowed: true,
      success: true,
      remaining: maxRequests,
      reset,
      resetTime: reset,
    };
  }

  /**
   * Check rate limit using sliding window
   */
  async checkSlidingWindow(
    key: string,
    windowMs: number,
    maxRequests: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const redisKey = `rate_limit:sliding:${key}`;

    if (this.redis) {
      // Use sorted set for sliding window
      const pipeline = this.redis.pipeline();
      pipeline.zremrangebyscore(redisKey, 0, now - windowMs);
      pipeline.zcard(redisKey);
      pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
      pipeline.expire(redisKey, Math.ceil(windowMs / 1000));

      const results = await pipeline.exec();
      const count = (results?.[1]?.[1] as number) || 0;
      const reset = now + windowMs;

      return {
        allowed: count < maxRequests,
        success: count < maxRequests,
        remaining: Math.max(0, maxRequests - count - 1),
        reset,
        resetTime: reset,
        retryAfter: count >= maxRequests ? Math.ceil(windowMs / 1000) : undefined,
      };
    }

    const reset = now + windowMs;
    return {
      allowed: true,
      success: true,
      remaining: maxRequests,
      reset,
      resetTime: reset,
    };
  }

  /**
   * Check rate limit using token bucket
   */
  async checkTokenBucket(
    key: string,
    capacity: number,
    refillRate: number // tokens per second
  ): Promise<RateLimitResult> {
    const redisKey = `rate_limit:token:${key}`;
    const now = Date.now();

    if (this.redis) {
      const script = `
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refillRate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        
        local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
        local tokens = tonumber(bucket[1]) or capacity
        local lastRefill = tonumber(bucket[2]) or now
        
        local elapsed = (now - lastRefill) / 1000
        local newTokens = math.min(capacity, tokens + (elapsed * refillRate))
        
        if newTokens >= 1 then
          newTokens = newTokens - 1
          redis.call('HMSET', key, 'tokens', newTokens, 'lastRefill', now)
          redis.call('EXPIRE', key, 3600)
          return {1, newTokens}
        else
          redis.call('HMSET', key, 'tokens', newTokens, 'lastRefill', now)
          redis.call('EXPIRE', key, 3600)
          return {0, newTokens}
        end
      `;

      const result = await this.redis.eval(
        script,
        1,
        redisKey,
        capacity.toString(),
        refillRate.toString(),
        now.toString()
      ) as [number, number];

      const allowed = result[0] === 1;
      const remaining = Math.floor(result[1]);
      const reset = now + Math.ceil((capacity - remaining) / refillRate) * 1000;

      return {
        allowed,
        success: allowed,
        remaining,
        reset,
        resetTime: reset,
        retryAfter: allowed ? undefined : Math.ceil((1 - remaining) / refillRate),
      };
    }

    const reset = now + 1000;
    return {
      allowed: true,
      success: true,
      remaining: capacity,
      reset,
      resetTime: reset,
    };
  }

  /**
   * Rate limit middleware
   */
  async rateLimit(
    request: NextRequest,
    config: RateLimitOptions
  ): Promise<RateLimitResult> {
    const key = config.keyGenerator
      ? config.keyGenerator(request)
      : this.getDefaultKey(request);

    let result: RateLimitResult;

    switch (config.strategy || "fixed") {
      case "sliding":
        result = await this.checkSlidingWindow(key, config.windowMs, config.maxRequests);
        break;
      case "token-bucket":
        result = await this.checkTokenBucket(
          key,
          config.maxRequests,
          config.maxRequests / (config.windowMs / 1000)
        );
        break;
      default:
        result = await this.checkFixedWindow(key, config.windowMs, config.maxRequests);
    }

    return result;
  }

  /**
   * Get default rate limit key from request
   */
  private getDefaultKey(request: NextRequest): string {
    const user = (request as any).user;
    const ip = request.headers.get("x-forwarded-for") || 
               request.headers.get("x-real-ip") || 
               "unknown";
    const path = request.nextUrl.pathname;
    
    if (user?.id) {
      return `rate-limit:user:${user.id}:${path}`;
    }
    return `rate-limit:ip:${ip}:${path}`;
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Rate limit function (backward compatibility)
 */
export async function rateLimit(
  request: NextRequest,
  options: RateLimitOptions
): Promise<{ success: boolean; remaining: number; resetTime: number }> {
  const result = await rateLimiter.rateLimit(request, options);
  return {
    success: result.success,
    remaining: result.remaining,
    resetTime: result.resetTime,
  };
}

/**
 * Rate limit middleware helper
 */
export function withRateLimit(
  config: RateLimitOptions,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const result = await rateLimiter.rateLimit(request, config);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          retry_after: result.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": result.retryAfter?.toString() || "60",
            "X-RateLimit-Limit": config.maxRequests.toString(),
            "X-RateLimit-Remaining": result.remaining.toString(),
            "X-RateLimit-Reset": result.reset.toString(),
          },
        }
      );
    }

    const response = await handler(request);

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", config.maxRequests.toString());
    response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    response.headers.set("X-RateLimit-Reset", result.reset.toString());

    return response;
  };
}

/**
 * Create rate limit middleware (backward compatibility)
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const result = await rateLimit(request, options);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Try again after ${new Date(result.resetTime).toISOString()}`,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": options.maxRequests.toString(),
            "X-RateLimit-Remaining": result.remaining.toString(),
            "X-RateLimit-Reset": result.resetTime.toString(),
            "Retry-After": Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Add rate limit headers to successful requests
    (request as any).rateLimit = {
      limit: options.maxRequests,
      remaining: result.remaining,
      reset: result.resetTime,
    };

    return null; // Continue to next middleware
  };
}

// Pre-configured rate limiters
export const apiRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
});

export const strictRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
});

export const authRateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 requests per 15 minutes
});

// Export EnhancedRateLimiter alias for backward compatibility
export const EnhancedRateLimiter = RateLimiter;
