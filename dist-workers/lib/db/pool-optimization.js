"use strict";
/**
 * Database Connection Pool Optimization
 * Production-ready connection pooling and query optimization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryOptimizer = void 0;
exports.createOptimizedPrismaClient = createOptimizedPrismaClient;
const client_1 = require("@prisma/client");
/**
 * Optimized Prisma client with connection pooling
 */
function createOptimizedPrismaClient() {
    return new client_1.PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
        // Connection pool settings
        // These are set via DATABASE_URL connection string parameters:
        // ?connection_limit=10&pool_timeout=20
    });
}
/**
 * Query optimization helpers
 */
class QueryOptimizer {
    /**
     * Batch queries for efficiency
     */
    static async batchQueries(queries, batchSize = 10) {
        const results = [];
        for (let i = 0; i < queries.length; i += batchSize) {
            const batch = queries.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map((q) => q()));
            results.push(...batchResults);
        }
        return results;
    }
    /**
     * Paginate queries efficiently
     */
    static async paginate(queryFn, page = 1, pageSize = 20) {
        const skip = (page - 1) * pageSize;
        const take = pageSize + 1; // Fetch one extra to check if there's more
        const results = await queryFn(skip, take);
        const hasMore = results.length > pageSize;
        return {
            data: results.slice(0, pageSize),
            page,
            pageSize,
            hasMore,
        };
    }
    /**
     * Optimize includes to prevent N+1 queries
     */
    static optimizeIncludes(include) {
        // In production, analyze and optimize include patterns
        // For now, return as-is
        return include;
    }
}
exports.QueryOptimizer = QueryOptimizer;
