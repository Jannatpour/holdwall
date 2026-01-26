"use strict";
/**
 * Redis Cache
 * Production caching with Redis
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = getRedisClient;
exports.getCache = getCache;
exports.setCache = setCache;
exports.deleteCache = deleteCache;
exports.clearCache = clearCache;
const ioredis_1 = __importDefault(require("ioredis"));
let redis = null;
const memoryCache = new Map();
let loggedMisconfig = false;
function getRedisClient() {
    if (redis) {
        return redis;
    }
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        return null; // Redis is optional
    }
    try {
        // Guardrail: localhost Redis will never work on Vercel/serverless production.
        // Treat it as "not configured" to avoid noisy connection errors during build/runtime.
        try {
            const parsed = new URL(redisUrl);
            const host = parsed.hostname;
            const isLocal = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
            const isServerless = !!process.env.VERCEL;
            if (process.env.NODE_ENV === "production" && isServerless && isLocal) {
                if (!loggedMisconfig) {
                    loggedMisconfig = true;
                    const { logger } = require("@/lib/logging/logger");
                    logger.warn("REDIS_URL points to localhost in production; disabling Redis", {
                        host,
                    });
                }
                return null;
            }
        }
        catch {
            // If parsing fails, proceed and let ioredis validate.
        }
        redis = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });
        redis.on("error", (err) => {
            const { logger } = require("@/lib/logging/logger");
            logger.error("Redis connection error", {
                error: err instanceof Error ? err.message : String(err),
                stack: err instanceof Error ? err.stack : undefined,
            });
        });
        return redis;
    }
    catch (error) {
        const { logger } = require("@/lib/logging/logger");
        logger.warn("Failed to connect to Redis, using in-memory fallback", {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
async function getCache(key) {
    const client = getRedisClient();
    if (!client) {
        const entry = memoryCache.get(key);
        if (!entry)
            return null;
        if (entry.expiresAt !== undefined && entry.expiresAt < Date.now()) {
            memoryCache.delete(key);
            return null;
        }
        try {
            return JSON.parse(entry.value);
        }
        catch {
            return null;
        }
    }
    try {
        const value = await client.get(key);
        return value ? JSON.parse(value) : null;
    }
    catch (error) {
        const { logger } = require("@/lib/logging/logger");
        logger.warn("Cache get error, returning null", {
            key,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
async function setCache(key, value, options) {
    const client = getRedisClient();
    if (!client) {
        try {
            const serialized = JSON.stringify(value);
            const expiresAt = options?.ttl !== undefined ? Date.now() + options.ttl * 1000 : undefined;
            memoryCache.set(key, { value: serialized, expiresAt });
        }
        catch {
            // ignore
        }
        return;
    }
    try {
        const serialized = JSON.stringify(value);
        if (options?.ttl) {
            await client.setex(key, options.ttl, serialized);
        }
        else {
            await client.set(key, serialized);
        }
    }
    catch (error) {
        const { logger } = require("@/lib/logging/logger");
        logger.warn("Cache set error", {
            key,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
async function deleteCache(key) {
    const client = getRedisClient();
    if (!client) {
        memoryCache.delete(key);
        return;
    }
    try {
        await client.del(key);
    }
    catch (error) {
        const { logger } = require("@/lib/logging/logger");
        logger.warn("Cache delete error", {
            key,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
async function clearCache(pattern) {
    const client = getRedisClient();
    if (!client) {
        // Best-effort in-memory clear; pattern is a Redis glob.
        // Support a simple prefix before '*'.
        const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
        for (const key of Array.from(memoryCache.keys())) {
            if (pattern === "*" || key.startsWith(prefix)) {
                memoryCache.delete(key);
            }
        }
        return;
    }
    try {
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
            await client.del(...keys);
        }
    }
    catch (error) {
        const { logger } = require("@/lib/logging/logger");
        logger.warn("Cache clear error", {
            pattern,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
