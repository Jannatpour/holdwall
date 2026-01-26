"use strict";
/**
 * Advanced Caching Strategy
 * Production-ready caching with invalidation, tagging, and multi-layer support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheManager = exports.CacheManager = void 0;
exports.cached = cached;
const redis_1 = require("./redis");
/**
 * Cache manager with tagging and invalidation
 */
class CacheManager {
    constructor() {
        this.tagIndex = new Map(); // tag -> cache keys
        this.keyVersion = new Map(); // key -> version
    }
    /**
     * Get cached value with version check
     */
    async get(key, minVersion) {
        const cached = await (0, redis_1.getCache)(key);
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
    async set(key, value, options = {}) {
        const { ttl = 3600, tags = [], version = 1 } = options;
        const expiresAt = Date.now() + ttl * 1000;
        const entry = {
            data: value,
            tags,
            expiresAt,
            version,
        };
        await (0, redis_1.setCache)(key, entry, { ttl });
        // Update tag index
        for (const tag of tags) {
            const tagKey = `${tag.type}:${tag.id}`;
            if (!this.tagIndex.has(tagKey)) {
                this.tagIndex.set(tagKey, new Set());
            }
            this.tagIndex.get(tagKey).add(key);
        }
        this.keyVersion.set(key, version);
    }
    /**
     * Invalidate by tag
     */
    async invalidateTag(tag) {
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
    async invalidatePattern(pattern) {
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
    async delete(key) {
        await (0, redis_1.deleteCache)(key);
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
    async clear() {
        // In production, use Redis FLUSHDB or FLUSHALL
        this.tagIndex.clear();
        this.keyVersion.clear();
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            tagCount: this.tagIndex.size,
            keyCount: this.keyVersion.size,
            tags: Array.from(this.tagIndex.keys()),
        };
    }
}
exports.CacheManager = CacheManager;
exports.cacheManager = new CacheManager();
/**
 * Cache decorator for functions
 */
function cached(keyGenerator, options = {}) {
    return (target, propertyName, descriptor) => {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            const key = keyGenerator(...args);
            const tags = options.tags ? options.tags(args) : [];
            // Try cache first
            const cached = await exports.cacheManager.get(key, options.version);
            if (cached !== null) {
                return cached;
            }
            // Execute and cache
            const result = await method.apply(this, args);
            await exports.cacheManager.set(key, result, {
                ttl: options.ttl,
                tags,
                version: options.version,
            });
            return result;
        };
        return descriptor;
    };
}
