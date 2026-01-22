/**
 * Cache-Augmented Generation (CAG)
 * 
 * Pre-loading context into model's "cache" for efficiency
 * and reduced latency.
 */

import { RAGPipeline, RAGContext } from "./rag";

export interface CachedContext {
  key: string;
  context: RAGContext;
  cachedAt: string;
  accessCount: number;
  lastAccessed: string;
}

export class CAG {
  private ragPipeline: RAGPipeline;
  private cache: Map<string, CachedContext> = new Map();
  private maxCacheSize: number = 100;
  private ttl: number = 3600000; // 1 hour in milliseconds

  constructor(ragPipeline: RAGPipeline) {
    this.ragPipeline = ragPipeline;
  }

  /**
   * Get or retrieve context with caching
   */
  async getContext(
    query: string,
    tenantId: string,
    options?: {
      useCache?: boolean;
      preload?: boolean;
    }
  ): Promise<RAGContext> {
    const { useCache = true, preload = false } = options || {};
    const cacheKey = this.generateCacheKey(query, tenantId);

    // Check cache
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && this.isValid(cached)) {
        // Update access
        cached.accessCount++;
        cached.lastAccessed = new Date().toISOString();
        return cached.context;
      }
    }

    // Retrieve fresh context
    const context = await this.ragPipeline.buildContext(query, tenantId);

    // Cache it
    if (useCache) {
      this.cacheContext(cacheKey, context);
    }

    // Preload related contexts if requested
    if (preload) {
      await this.preloadRelated(query, tenantId);
    }

    return context;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(query: string, tenantId: string): string {
    // Simple hash (in production, use proper hashing)
    return `${tenantId}:${query.substring(0, 50).toLowerCase().replace(/\s+/g, "-")}`;
  }

  /**
   * Check if cached context is valid
   */
  private isValid(cached: CachedContext): boolean {
    const age = Date.now() - new Date(cached.cachedAt).getTime();
    return age < this.ttl;
  }

  /**
   * Cache context
   */
  private cacheContext(key: string, context: RAGContext): void {
    // Evict old entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      key,
      context,
      cachedAt: new Date().toISOString(),
      accessCount: 1,
      lastAccessed: new Date().toISOString(),
    });
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, cached] of this.cache.entries()) {
      const time = new Date(cached.lastAccessed).getTime();
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Preload related contexts
   */
  private async preloadRelated(
    query: string,
    tenantId: string
  ): Promise<void> {
    // Extract key terms from query
    const terms = query.split(/\s+/).filter(w => w.length > 4).slice(0, 3);

    // Preload contexts for related terms
    for (const term of terms) {
      const relatedKey = this.generateCacheKey(term, tenantId);
      if (!this.cache.has(relatedKey)) {
        try {
          await this.getContext(term, tenantId, { useCache: true, preload: false });
        } catch (error) {
          // Ignore preload errors
        }
      }
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    oldestEntry: string | null;
  } {
    const entries = Array.from(this.cache.values());
    const oldest = entries.sort((a, b) =>
      new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime()
    )[0];

    return {
      size: this.cache.size,
      hitRate: 0.5, // Would track actual hit rate in production
      oldestEntry: oldest?.key || null,
    };
  }
}
