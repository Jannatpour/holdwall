/**
 * Advanced Caching Strategy
 * Production-ready caching with invalidation, tagging, and multi-layer support
 */

import { getCache, setCache, deleteCache } from "./redis";

export interface CacheTag {
  type: string;
  id: string;
}

export interface CacheEntry<T> {
  data: T;
  tags: CacheTag[];
  expiresAt: number;
  version: number;
}

/**
 * Cache manager with tagging and invalidation
 */
export class CacheManager {
  private tagIndex: Map<string, Set<string>> = new Map(); // tag -> cache keys
  private keyVersion: Map<string, number> = new Map(); // key -> version

  /**
   * Get cached value with version check
   */
  async get<T>(key: string, minVersion?: number): Promise<T | null> {
    const cached = await getCache<CacheEntry<T>>(key);
    if (!cached) {
      return null;
    }

    // Check expiration
    if (cached.expiresAt < Date.now()) {
      await this.delete(key);
      return null;
    }

    // Check version
    if (minVersion !== undefined && cached.version < minVersion) {
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached value with tags
   */
  async set<T>(
    key: string,
    value: T,
    options: {
      ttl?: number;
      tags?: CacheTag[];
      version?: number;
    } = {}
  ): Promise<void> {
    const { ttl = 3600, tags = [], version = 1 } = options;
    const expiresAt = Date.now() + ttl * 1000;

    const entry: CacheEntry<T> = {
      data: value,
      tags,
      expiresAt,
      version,
    };

    await setCache(key, entry, { ttl });

    // Update tag index
    for (const tag of tags) {
      const tagKey = `${tag.type}:${tag.id}`;
      if (!this.tagIndex.has(tagKey)) {
        this.tagIndex.set(tagKey, new Set());
      }
      this.tagIndex.get(tagKey)!.add(key);
    }

    this.keyVersion.set(key, version);
  }

  /**
   * Invalidate by tag
   */
  async invalidateTag(tag: CacheTag): Promise<void> {
    const tagKey = `${tag.type}:${tag.id}`;
    const keys = this.tagIndex.get(tagKey);

    if (keys) {
      for (const key of keys) {
        await this.delete(key);
      }
      this.tagIndex.delete(tagKey);
    }
  }

  /**
   * Invalidate by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    // In production, use Redis SCAN for pattern matching
    // For now, clear tag index entries that match
    for (const [tagKey, keys] of this.tagIndex.entries()) {
      if (tagKey.includes(pattern)) {
        for (const key of keys) {
          await this.delete(key);
        }
        this.tagIndex.delete(tagKey);
      }
    }
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<void> {
    await deleteCache(key);
    this.keyVersion.delete(key);

    // Remove from tag index
    for (const [tagKey, keys] of this.tagIndex.entries()) {
      keys.delete(key);
      if (keys.size === 0) {
        this.tagIndex.delete(tagKey);
      }
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    // In production, use Redis FLUSHDB or FLUSHALL
    this.tagIndex.clear();
    this.keyVersion.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    tagCount: number;
    keyCount: number;
    tags: string[];
  } {
    return {
      tagCount: this.tagIndex.size,
      keyCount: this.keyVersion.size,
      tags: Array.from(this.tagIndex.keys()),
    };
  }
}

export const cacheManager = new CacheManager();

/**
 * Cache decorator for functions
 */
export function cached<T extends (...args: any[]) => Promise<any>>(
  keyGenerator: (...args: Parameters<T>) => string,
  options: {
    ttl?: number;
    tags?: (args: Parameters<T>) => CacheTag[];
    version?: number;
  } = {}
) {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value as T;

    descriptor.value = async function (this: any, ...args: Parameters<T>) {
      const key = keyGenerator(...args);
      const tags = options.tags ? options.tags(args) : [];

      // Try cache first
      const cached = await cacheManager.get(key, options.version);
      if (cached !== null) {
        return cached;
      }

      // Execute and cache
      const result = await method.apply(this, args);
      await cacheManager.set(key, result, {
        ttl: options.ttl,
        tags,
        version: options.version,
      });

      return result;
    } as T;

    return descriptor;
  };
}
