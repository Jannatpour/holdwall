"use strict";
/**
 * Reranking Cache
 *
 * Caches reranking results to avoid redundant cross-encoder calls
 * Key: hash of query + document IDs + model
 * TTL: 1 hour (reranking can change with new documents)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedReranking = getCachedReranking;
exports.cacheReranking = cacheReranking;
const redis_1 = require("./redis");
const crypto_1 = require("crypto");
const RERANKING_CACHE_TTL = 60 * 60; // 1 hour in seconds
/**
 * Generate cache key for reranking
 */
function getRerankingCacheKey(query, documentIds, model) {
    const hash = (0, crypto_1.createHash)("sha256");
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
async function getCachedReranking(query, documentIds, model) {
    const key = getRerankingCacheKey(query, documentIds, model);
    const cached = await (0, redis_1.getCache)(key);
    return cached;
}
/**
 * Cache reranking results
 */
async function cacheReranking(query, documentIds, model, results) {
    const key = getRerankingCacheKey(query, documentIds, model);
    await (0, redis_1.setCache)(key, results, { ttl: RERANKING_CACHE_TTL });
}
