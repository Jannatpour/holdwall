"use strict";
/**
 * Content Change Detector
 *
 * Detects changes in web content to avoid redundant processing and identify updates.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentChangeDetector = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ioredis_1 = __importDefault(require("ioredis"));
class ContentChangeDetector {
    constructor() {
        this.memoryCache = new Map();
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
            try {
                this.redis = new ioredis_1.default(redisUrl);
            }
            catch (error) {
                console.warn("Redis not available, using memory cache for change detection:", error);
                this.redis = null;
            }
        }
        else {
            this.redis = null;
        }
    }
    /**
     * Generate content hash
     */
    generateHash(content) {
        return crypto_1.default.createHash("sha256").update(content).digest("hex");
    }
    /**
     * Record content for a URL
     */
    async recordContent(url, content) {
        const hash = this.generateHash(content);
        const timestamp = Date.now();
        const key = `content_hash:${url}`;
        if (this.redis) {
            await this.redis.setex(key, 86400 * 30, // 30 days TTL
            JSON.stringify({ hash, timestamp }));
        }
        else {
            this.memoryCache.set(url, { url, hash, timestamp });
        }
    }
    /**
     * Check if content has changed
     */
    async hasChanged(url, newContent) {
        const newHash = this.generateHash(newContent);
        const key = `content_hash:${url}`;
        let oldHash = null;
        if (this.redis) {
            const stored = await this.redis.get(key);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    oldHash = parsed.hash;
                }
                catch {
                    // Invalid stored data
                }
            }
        }
        else {
            const stored = this.memoryCache.get(url);
            if (stored) {
                oldHash = stored.hash;
            }
        }
        if (!oldHash) {
            // First time seeing this URL
            await this.recordContent(url, newContent);
            return true; // Consider it "changed" (new content)
        }
        const changed = oldHash !== newHash;
        if (changed) {
            await this.recordContent(url, newContent);
        }
        return changed;
    }
    /**
     * Get last known hash for a URL
     */
    async getLastHash(url) {
        const key = `content_hash:${url}`;
        if (this.redis) {
            const stored = await this.redis.get(key);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    return parsed.hash;
                }
                catch {
                    return null;
                }
            }
        }
        else {
            const stored = this.memoryCache.get(url);
            return stored?.hash || null;
        }
        return null;
    }
    /**
     * Cleanup old entries
     */
    async cleanup(maxAge = 86400 * 30) {
        const cutoff = Date.now() - maxAge * 1000;
        if (this.redis) {
            // Redis TTL handles cleanup automatically
            return;
        }
        // Cleanup memory cache
        for (const [url, hash] of this.memoryCache.entries()) {
            if (hash.timestamp < cutoff) {
                this.memoryCache.delete(url);
            }
        }
    }
}
exports.ContentChangeDetector = ContentChangeDetector;
