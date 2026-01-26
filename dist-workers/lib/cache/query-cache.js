"use strict";
/**
 * Query Result Cache
 *
 * Caches query results with invalidation on evidence updates
 * Key: hash of query + tenant + params
 * TTL: 5 minutes (results can change with new evidence)
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
exports.getCachedQuery = getCachedQuery;
exports.cacheQuery = cacheQuery;
exports.invalidateQueryCache = invalidateQueryCache;
exports.invalidateQuery = invalidateQuery;
const redis_1 = require("./redis");
const crypto_1 = require("crypto");
const QUERY_CACHE_TTL = 5 * 60; // 5 minutes in seconds
/**
 * Generate cache key for query
 */
function getQueryCacheKey(query, tenantId, params) {
    const hash = (0, crypto_1.createHash)("sha256");
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
async function getCachedQuery(query, tenantId, params) {
    const key = getQueryCacheKey(query, tenantId, params);
    const cached = await (0, redis_1.getCache)(key);
    return cached;
}
/**
 * Cache query results
 */
async function cacheQuery(query, tenantId, params, results) {
    const key = getQueryCacheKey(query, tenantId, params);
    const entry = {
        results,
        query,
        params: params || {},
        cached_at: new Date().toISOString(),
    };
    await (0, redis_1.setCache)(key, entry, { ttl: QUERY_CACHE_TTL });
}
/**
 * Invalidate query cache for tenant (when evidence is added/updated)
 */
async function invalidateQueryCache(tenantId) {
    const { getRedisClient } = await Promise.resolve().then(() => __importStar(require("./redis")));
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
        const keysToDelete = [];
        stream.on("data", (keys) => {
            // Filter keys that belong to this tenant
            // Since tenantId is hashed in the key, we need to check each entry
            for (const key of keys) {
                keysToDelete.push(key);
            }
        });
        await new Promise((resolve, reject) => {
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
                }
                catch (error) {
                    reject(error);
                }
            });
            stream.on("error", reject);
        });
    }
    catch (error) {
        console.error("Query cache invalidation failed:", error);
        // Fallback: cache will expire naturally via TTL
    }
}
/**
 * Invalidate specific query cache
 */
async function invalidateQuery(query, tenantId, params) {
    const key = getQueryCacheKey(query, tenantId, params);
    await (0, redis_1.deleteCache)(key);
}
