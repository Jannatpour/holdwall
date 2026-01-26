"use strict";
/**
 * Embedding Cache
 *
 * Caches embeddings with TTL to avoid redundant API calls
 * Key: hash of text + model name
 * TTL: 24 hours (embeddings are stable)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedEmbedding = getCachedEmbedding;
exports.cacheEmbedding = cacheEmbedding;
exports.invalidateEmbeddingCache = invalidateEmbeddingCache;
const redis_1 = require("./redis");
const crypto_1 = require("crypto");
const EMBEDDING_CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds
/**
 * Generate cache key for embedding
 */
function getEmbeddingCacheKey(text, model) {
    const hash = (0, crypto_1.createHash)("sha256");
    hash.update(text);
    if (model) {
        hash.update(model);
    }
    return `embedding:${hash.digest("hex")}`;
}
/**
 * Get cached embedding
 */
async function getCachedEmbedding(text, model) {
    const key = getEmbeddingCacheKey(text, model);
    const cached = await (0, redis_1.getCache)(key);
    return cached;
}
/**
 * Cache embedding
 */
async function cacheEmbedding(text, embedding, model) {
    const key = getEmbeddingCacheKey(text, model);
    await (0, redis_1.setCache)(key, embedding, { ttl: EMBEDDING_CACHE_TTL });
}
/**
 * Invalidate embedding cache (e.g., when model changes)
 */
async function invalidateEmbeddingCache(model) {
    const { getRedisClient } = await Promise.resolve().then(() => __importStar(require("./redis")));
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
        const keysToDelete = [];
        stream.on("data", (keys) => {
            if (model) {
                // Filter keys for specific model (model is hashed in key, so we'd need to check entries)
                // For simplicity, delete all embedding keys if model specified
                keysToDelete.push(...keys);
            }
            else {
                keysToDelete.push(...keys);
            }
        });
        await new Promise((resolve, reject) => {
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
                }
                catch (error) {
                    reject(error);
                }
            });
            stream.on("error", reject);
        });
    }
    catch (error) {
        console.error("Embedding cache invalidation failed:", error);
        // Fallback: cache will expire naturally via TTL
    }
}
