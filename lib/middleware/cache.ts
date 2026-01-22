/**
 * Response Caching Middleware
 * Production-ready HTTP caching with ETag support
 */

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "ioredis";
import { createHash } from "crypto";

let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redis) return redis;
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
    });
    return redis;
  } catch (error) {
    console.error("Failed to connect to Redis for caching:", error);
    return null;
  }
}

// In-memory cache fallback
const memoryCache = new Map<string, { data: any; expires: number; etag: string }>();

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key?: string; // Custom cache key
  vary?: string[]; // Headers to vary on
  revalidate?: number; // Revalidation time in seconds (stale-while-revalidate)
}

export async function getCachedResponse(
  request: NextRequest,
  options: CacheOptions = {}
): Promise<NextResponse | null> {
  const { ttl = 300, key, vary = [] } = options;
  
  // Generate cache key
  const cacheKey = key || generateCacheKey(request, vary);
  
  // Check ETag
  const ifNoneMatch = request.headers.get("if-none-match");
  
  const redisClient = getRedisClient();
  
  if (redisClient) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const { data, etag, expires } = JSON.parse(cached);
        
        if (Date.now() < expires) {
          // Check ETag
          if (ifNoneMatch === etag) {
            return new NextResponse(null, {
              status: 304,
              headers: {
                "ETag": etag,
                "Cache-Control": `public, max-age=${ttl}`,
              },
            });
          }
          
          // Return cached response
          const response = NextResponse.json(data);
          response.headers.set("ETag", etag);
          response.headers.set("Cache-Control", `public, max-age=${ttl}`);
          response.headers.set("X-Cache", "HIT");
          return response;
        }
      }
    } catch (error) {
      console.error("Cache read error:", error);
    }
  }
  
  // Check memory cache
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    if (ifNoneMatch === cached.etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "ETag": cached.etag,
          "Cache-Control": `public, max-age=${ttl}`,
        },
      });
    }
    
    const response = NextResponse.json(cached.data);
    response.headers.set("ETag", cached.etag);
    response.headers.set("Cache-Control", `public, max-age=${ttl}`);
    response.headers.set("X-Cache", "HIT");
    return response;
  }
  
  return null;
}

export async function setCachedResponse(
  request: NextRequest,
  data: any,
  options: CacheOptions = {}
): Promise<void> {
  const { ttl = 300, key, vary = [] } = options;
  
  const cacheKey = key || generateCacheKey(request, vary);
  const etag = generateETag(data);
  const expires = Date.now() + ttl * 1000;
  
  const redisClient = getRedisClient();
  
  if (redisClient) {
    try {
      await redisClient.setex(
        cacheKey,
        ttl,
        JSON.stringify({ data, etag, expires })
      );
    } catch (error) {
      console.error("Cache write error:", error);
    }
  }
  
  // Store in memory cache
  memoryCache.set(cacheKey, { data, etag, expires });
  
  // Clean up old entries periodically
  if (memoryCache.size > 1000) {
    for (const [k, v] of memoryCache.entries()) {
      if (v.expires < Date.now()) {
        memoryCache.delete(k);
      }
    }
  }
}

function generateCacheKey(request: NextRequest, vary: string[]): string {
  const path = request.nextUrl.pathname;
  const query = request.nextUrl.search;
  const user = (request as any).user;
  
  const parts = [path, query];
  
  if (user?.id) {
    parts.push(`user:${user.id}`);
  }
  
  for (const header of vary) {
    const value = request.headers.get(header);
    if (value) {
      parts.push(`${header}:${value}`);
    }
  }
  
  const key = parts.join("|");
  return `cache:${createHash("sha256").update(key).digest("hex")}`;
}

function generateETag(data: any): string {
  const str = JSON.stringify(data);
  return `"${createHash("md5").update(str).digest("hex")}"`;
}

export function createCacheMiddleware(options: CacheOptions = {}) {
  return async (
    request: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> => {
    // Try to get cached response
    const cached = await getCachedResponse(request, options);
    if (cached) {
      return cached;
    }
    
    // Execute handler
    const response = await handler(request);
    
    // Cache successful GET responses
    if (request.method === "GET" && response.status === 200) {
      try {
        const data = await response.clone().json();
        await setCachedResponse(request, data, options);
        
        // Add cache headers
        response.headers.set("Cache-Control", `public, max-age=${options.ttl || 300}`);
        response.headers.set("X-Cache", "MISS");
      } catch {
        // Not JSON, skip caching
      }
    }
    
    return response;
  };
}
