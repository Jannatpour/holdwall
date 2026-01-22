/**
 * Reranking Cache
 * 
 * Caches reranking results to avoid redundant cross-encoder calls
 * Key: hash of query + document IDs + model
 * TTL: 1 hour (reranking can change with new documents)
 */

import { getCache, setCache } from "./redis";
import { createHash } from "crypto";

export interface RerankingCacheEntry {
  results: Array<{
    id: string;
    score: number;
    rank: number;
  }>;
  model: string;
  cached_at: string;
}

const RERANKING_CACHE_TTL = 60 * 60; // 1 hour in seconds

/**
 * Generate cache key for reranking
 */
function getRerankingCacheKey(
  query: string,
  documentIds: string[],
  model: string
): string {
  const hash = createHash("sha256");
  hash.update(query);
  hash.update(model);
  // Include document IDs in hash (order matters for reranking)
  for (const id of documentIds.sort()) {
    hash.update(id);
  }
  return `rerank:${hash.digest("hex")}`;
}

/**
 * Get cached reranking results
 */
export async function getCachedReranking(
  query: string,
  documentIds: string[],
  model: string
): Promise<RerankingCacheEntry | null> {
  const key = getRerankingCacheKey(query, documentIds, model);
  const cached = await getCache<RerankingCacheEntry>(key);
  return cached;
}

/**
 * Cache reranking results
 */
export async function cacheReranking(
  query: string,
  documentIds: string[],
  model: string,
  results: RerankingCacheEntry
): Promise<void> {
  const key = getRerankingCacheKey(query, documentIds, model);
  await setCache(key, results, { ttl: RERANKING_CACHE_TTL });
}
