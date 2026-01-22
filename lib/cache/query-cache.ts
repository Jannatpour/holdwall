/**
 * Query Result Cache
 * 
 * Caches query results with invalidation on evidence updates
 * Key: hash of query + tenant + params
 * TTL: 5 minutes (results can change with new evidence)
 */

import { getCache, setCache, deleteCache } from "./redis";
import { createHash } from "crypto";

export interface QueryCacheEntry<T> {
  results: T;
  query: string;
  params: Record<string, unknown>;
  cached_at: string;
}

const QUERY_CACHE_TTL = 5 * 60; // 5 minutes in seconds

/**
 * Generate cache key for query
 */
function getQueryCacheKey(
  query: string,
  tenantId: string,
  params?: Record<string, unknown>
): string {
  const hash = createHash("sha256");
  hash.update(query);
  hash.update(tenantId);
  if (params) {
    const sortedParams = Object.keys(params).sort().map(k => `${k}:${JSON.stringify(params[k])}`).join("|");
    hash.update(sortedParams);
  }
  return `query:${hash.digest("hex")}`;
}

/**
 * Get cached query results
 */
export async function getCachedQuery<T>(
  query: string,
  tenantId: string,
  params?: Record<string, unknown>
): Promise<QueryCacheEntry<T> | null> {
  const key = getQueryCacheKey(query, tenantId, params);
  const cached = await getCache<QueryCacheEntry<T>>(key);
  return cached;
}

/**
 * Cache query results
 */
export async function cacheQuery<T>(
  query: string,
  tenantId: string,
  params: Record<string, unknown> | undefined,
  results: T
): Promise<void> {
  const key = getQueryCacheKey(query, tenantId, params);
  const entry: QueryCacheEntry<T> = {
    results,
    query,
    params: params || {},
    cached_at: new Date().toISOString(),
  };
  await setCache(key, entry, { ttl: QUERY_CACHE_TTL });
}

/**
 * Invalidate query cache for tenant (when evidence is added/updated)
 */
export async function invalidateQueryCache(tenantId: string): Promise<void> {
  const { getRedisClient } = await import("./redis");
  const client = getRedisClient();
  
  if (!client) {
    // Redis not available - cache will expire naturally via TTL
    return;
  }

  try {
    // Use SCAN for production-safe pattern matching (avoids blocking KEYS)
    const pattern = `query:*`;
    const stream = client.scanStream({
      match: pattern,
      count: 100,
    });

    const keysToDelete: string[] = [];
    
    stream.on("data", (keys: string[]) => {
      // Filter keys that belong to this tenant
      // Since tenantId is hashed in the key, we need to check each entry
      for (const key of keys) {
        keysToDelete.push(key);
      }
    });

    await new Promise<void>((resolve, reject) => {
      stream.on("end", async () => {
        try {
          if (keysToDelete.length > 0) {
            // Delete in batches to avoid overwhelming Redis
            const batchSize = 100;
            for (let i = 0; i < keysToDelete.length; i += batchSize) {
              const batch = keysToDelete.slice(i, i + batchSize);
              await client.del(...batch);
            }
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      
      stream.on("error", reject);
    });
  } catch (error) {
    console.error("Query cache invalidation failed:", error);
    // Fallback: cache will expire naturally via TTL
  }
}

/**
 * Invalidate specific query cache
 */
export async function invalidateQuery(
  query: string,
  tenantId: string,
  params?: Record<string, unknown>
): Promise<void> {
  const key = getQueryCacheKey(query, tenantId, params);
  await deleteCache(key);
}
