/**
 * Embedding Cache
 * 
 * Caches embeddings with TTL to avoid redundant API calls
 * Key: hash of text + model name
 * TTL: 24 hours (embeddings are stable)
 */

import { getCache, setCache } from "./redis";
import { createHash } from "crypto";

export interface EmbeddingCacheEntry {
  vector: number[];
  model: string;
  dimensions: number;
  cached_at: string;
}

const EMBEDDING_CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds

/**
 * Generate cache key for embedding
 */
function getEmbeddingCacheKey(text: string, model?: string): string {
  const hash = createHash("sha256");
  hash.update(text);
  if (model) {
    hash.update(model);
  }
  return `embedding:${hash.digest("hex")}`;
}

/**
 * Get cached embedding
 */
export async function getCachedEmbedding(
  text: string,
  model?: string
): Promise<EmbeddingCacheEntry | null> {
  const key = getEmbeddingCacheKey(text, model);
  const cached = await getCache<EmbeddingCacheEntry>(key);
  return cached;
}

/**
 * Cache embedding
 */
export async function cacheEmbedding(
  text: string,
  embedding: EmbeddingCacheEntry,
  model?: string
): Promise<void> {
  const key = getEmbeddingCacheKey(text, model);
  await setCache(key, embedding, { ttl: EMBEDDING_CACHE_TTL });
}

/**
 * Invalidate embedding cache (e.g., when model changes)
 */
export async function invalidateEmbeddingCache(model?: string): Promise<void> {
  const { getRedisClient } = await import("./redis");
  const client = getRedisClient();
  
  if (!client) {
    // Redis not available - cache will expire naturally via TTL
    return;
  }

  try {
    // Use SCAN for production-safe pattern matching
    const pattern = model ? `embedding:*` : `embedding:*`;
    const stream = client.scanStream({
      match: pattern,
      count: 100,
    });

    const keysToDelete: string[] = [];
    
    stream.on("data", (keys: string[]) => {
      if (model) {
        // Filter keys for specific model (model is hashed in key, so we'd need to check entries)
        // For simplicity, delete all embedding keys if model specified
        keysToDelete.push(...keys);
      } else {
        keysToDelete.push(...keys);
      }
    });

    await new Promise<void>((resolve, reject) => {
      stream.on("end", async () => {
        try {
          if (keysToDelete.length > 0) {
            // Delete in batches
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
    console.error("Embedding cache invalidation failed:", error);
    // Fallback: cache will expire naturally via TTL
  }
}
