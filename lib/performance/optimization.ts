/**
 * Performance Optimization
 * Caching, lazy loading, code splitting utilities
 */

import { cache } from "react";
import { getCache, setCache } from "@/lib/cache/redis";
import { cacheManager } from "@/lib/cache/strategy";

/**
 * Memoize function results with cache
 */
export function memoizeWithCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string,
  ttlSeconds?: number
): T {
  return (async (...args: Parameters<T>) => {
    const cacheKey = keyGenerator(...args);
    const cached = await getCache<any>(cacheKey);

    if (cached !== null) {
      return cached;
    }

    const result = await fn(...args);
    await setCache(cacheKey, result, { ttl: ttlSeconds });

    return result;
  }) as T;
}

/**
 * React cache wrapper for server components
 */
export const getCachedData = cache(async <T,>(
  key: string,
  fetcher: () => Promise<T>,
  options: { ttl?: number; tags?: Array<{ type: string; id: string }> } = {}
): Promise<T> => {
  // Try cache first
  const cached = await cacheManager.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch and cache
  const data = await fetcher();
  await cacheManager.set(key, data, {
    ttl: options.ttl || 3600,
    tags: options.tags || [],
  });

  return data;
});

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Debounce with leading edge
 */
export function debounceLeading<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastCallTime = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall >= delay) {
      // Leading edge - call immediately
      fn(...args);
      lastCallTime = now;
    } else {
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Set new timeout for trailing edge
      timeoutId = setTimeout(() => {
        fn(...args);
        lastCallTime = Date.now();
      }, delay - timeSinceLastCall);
    }
  };
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Batch function calls
 */
export function batch<T>(
  fn: (items: T[]) => Promise<void>,
  delay: number = 100,
  maxBatchSize: number = 100
) {
  let queue: T[] = [];
  let timeoutId: NodeJS.Timeout | null = null;

  return (item: T) => {
    queue.push(item);

    if (queue.length >= maxBatchSize) {
      // Flush immediately if batch is full
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      const items = queue.splice(0, maxBatchSize);
      fn(items);
    } else if (!timeoutId) {
      // Schedule flush
      timeoutId = setTimeout(() => {
        const items = queue.splice(0);
        timeoutId = null;
        if (items.length > 0) {
          fn(items);
        }
      }, delay);
    }
  };
}

/**
 * Lazy load component with Suspense boundary
 */
import React from "react";

export function lazyLoad<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(importFn);
}

/**
 * Prefetch data
 */
export async function prefetchData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { ttl?: number } = {}
): Promise<void> {
  const data = await fetcher();
  await setCache(key, data, { ttl: options.ttl || 3600 });
}

/**
 * Prefetch API route for faster loading
 * Uses fetch with cache to warm up the route
 */
export function prefetchApiRoute(
  url: string,
  options: {
    priority?: "high" | "low";
    cache?: RequestCache;
  } = {}
): void {
  if (typeof window === "undefined") return;

  const { priority = "low", cache = "force-cache" } = options;

  // Use requestIdleCallback for low priority, immediate for high
  const execute = () => {
    fetch(url, {
      method: "GET",
      cache,
      headers: {
        "Cache-Control": "public, max-age=60",
        "X-Prefetch": "true",
      },
    }).catch(() => {
      // Silently fail - prefetch is best effort
    });
  };

  if (priority === "high") {
    execute();
  } else if ("requestIdleCallback" in window) {
    requestIdleCallback(execute, { timeout: 2000 });
  } else {
    setTimeout(execute, 100);
  }
}

/**
 * Prefetch multiple API routes in parallel
 */
export function prefetchApiRoutes(
  urls: string[],
  options: {
    priority?: "high" | "low";
    maxConcurrent?: number;
  } = {}
): void {
  const { priority = "low", maxConcurrent = 3 } = options;

  // Batch prefetch requests
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    const batch = urls.slice(i, i + maxConcurrent);
    batch.forEach((url) => prefetchApiRoute(url, { priority }));
  }
}

/**
 * Image optimization helper
 */
export function getOptimizedImageUrl(
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: "webp" | "avif" | "jpg" | "png";
  } = {}
): string {
  const params = new URLSearchParams();
  if (options.width) params.set("w", options.width.toString());
  if (options.height) params.set("h", options.height.toString());
  if (options.quality) params.set("q", options.quality.toString());
  if (options.format) params.set("f", options.format);

  return `${url}?${params.toString()}`;
}
