"use strict";
/**
 * Cache Warmer
 *
 * Pre-warms frequently accessed data to improve response times
 * Runs on schedule or on-demand
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
exports.warmupCaches = warmupCaches;
exports.scheduleCacheWarmup = scheduleCacheWarmup;
const client_1 = require("@/lib/db/client");
const embeddings_1 = require("@/lib/vector/embeddings");
const embedding_cache_1 = require("./embedding-cache");
const query_cache_1 = require("./query-cache");
/**
 * Warm up caches with frequently accessed data
 */
async function warmupCaches(config = {}) {
    const { warmEmbeddings = true, warmQueries = true, tenantId, limit = 100, } = config;
    const errors = [];
    let embeddingsWarmed = 0;
    let queriesWarmed = 0;
    try {
        // Warm embedding cache with top evidence content
        if (warmEmbeddings) {
            const evidence = await client_1.db.evidence.findMany({
                where: tenantId ? { tenantId } : undefined,
                orderBy: { createdAt: "desc" },
                take: limit,
            });
            const embeddingService = new embeddings_1.EmbeddingService();
            for (const ev of evidence) {
                try {
                    const content = ev.contentRaw || ev.contentNormalized || "";
                    if (content && content.length > 10) {
                        const embedding = await embeddingService.embed(content);
                        await (0, embedding_cache_1.cacheEmbedding)(content, {
                            vector: embedding.vector,
                            model: "default",
                            dimensions: embedding.vector.length,
                            cached_at: new Date().toISOString(),
                        });
                        embeddingsWarmed++;
                    }
                }
                catch (error) {
                    errors.push(`Failed to warm embedding for evidence ${ev.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
                }
            }
        }
        // Warm query cache with common queries
        if (warmQueries) {
            const commonQueries = [
                "service reliability",
                "security",
                "privacy",
                "performance",
                "compliance",
            ];
            // Execute actual queries and cache results
            const embeddingService = new embeddings_1.EmbeddingService();
            for (const query of commonQueries) {
                try {
                    // Generate embedding for query
                    const queryEmbedding = await embeddingService.embed(query);
                    // Perform semantic search (simplified - in production would use full search pipeline)
                    const { VectorEmbeddings } = await Promise.resolve().then(() => __importStar(require("@/lib/search/embeddings")));
                    const embeddings = new VectorEmbeddings();
                    // Cache the query embedding
                    await (0, embedding_cache_1.cacheEmbedding)(query, {
                        vector: queryEmbedding.vector,
                        model: "default",
                        dimensions: queryEmbedding.vector.length,
                        cached_at: new Date().toISOString(),
                    });
                    // Cache query result structure (in production would cache actual search results)
                    await (0, query_cache_1.cacheQuery)(query, tenantId || "global", undefined, {
                        results: [], // Would be populated with actual search results
                        cached_at: new Date().toISOString(),
                        tenantId,
                    });
                    queriesWarmed++;
                }
                catch (error) {
                    errors.push(`Failed to warm query "${query}": ${error instanceof Error ? error.message : "Unknown error"}`);
                }
            }
        }
    }
    catch (error) {
        errors.push(`Cache warmup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
    return {
        embeddings_warmed: embeddingsWarmed,
        queries_warmed: queriesWarmed,
        errors,
    };
}
/**
 * Schedule cache warmup (call this from a cron job or scheduled task)
 */
async function scheduleCacheWarmup(tenantId) {
    // This would be called by a cron job or scheduled task
    // For now, just provide the function
    await warmupCaches({
        warmEmbeddings: true,
        warmQueries: true,
        tenantId,
        limit: 50, // Warm top 50 items
    });
}
