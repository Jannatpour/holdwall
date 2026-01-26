"use strict";
/**
 * Cache-Augmented Generation (CAG)
 *
 * Pre-loading context into model's "cache" for efficiency
 * and reduced latency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAG = void 0;
class CAG {
    constructor(ragPipeline) {
        this.cache = new Map();
        this.maxCacheSize = 100;
        this.ttl = 3600000; // 1 hour in milliseconds
        this.ragPipeline = ragPipeline;
    }
    /**
     * Get or retrieve context with caching
     */
    async getContext(query, tenantId, options) {
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
    generateCacheKey(query, tenantId) {
        // Simple hash (in production, use proper hashing)
        return `${tenantId}:${query.substring(0, 50).toLowerCase().replace(/\s+/g, "-")}`;
    }
    /**
     * Check if cached context is valid
     */
    isValid(cached) {
        const age = Date.now() - new Date(cached.cachedAt).getTime();
        return age < this.ttl;
    }
    /**
     * Cache context
     */
    cacheContext(key, context) {
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
    evictOldest() {
        let oldestKey = null;
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
    async preloadRelated(query, tenantId) {
        // Extract key terms from query
        const terms = query.split(/\s+/).filter(w => w.length > 4).slice(0, 3);
        // Preload contexts for related terms
        for (const term of terms) {
            const relatedKey = this.generateCacheKey(term, tenantId);
            if (!this.cache.has(relatedKey)) {
                try {
                    await this.getContext(term, tenantId, { useCache: true, preload: false });
                }
                catch (error) {
                    // Ignore preload errors
                }
            }
        }
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Get cache stats
     */
    getCacheStats() {
        const entries = Array.from(this.cache.values());
        const oldest = entries.sort((a, b) => new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime())[0];
        return {
            size: this.cache.size,
            hitRate: 0.5, // Would track actual hit rate in production
            oldestEntry: oldest?.key || null,
        };
    }
}
exports.CAG = CAG;
