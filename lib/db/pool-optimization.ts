/**
 * Database Connection Pool Optimization
 * Production-ready connection pooling and query optimization
 */

import { PrismaClient } from "@prisma/client";

/**
 * Optimized Prisma client with connection pooling
 */
export function createOptimizedPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    // Connection pool settings
    // These are set via DATABASE_URL connection string parameters:
    // ?connection_limit=10&pool_timeout=20
  });
}

/**
 * Query optimization helpers
 */
export class QueryOptimizer {
  /**
   * Batch queries for efficiency
   */
  static async batchQueries<T>(
    queries: Array<() => Promise<T>>,
    batchSize: number = 10
  ): Promise<T[]> {
    const results: T[] = [];

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
  static async paginate<T>(
    queryFn: (skip: number, take: number) => Promise<T[]>,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    data: T[];
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> {
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
  static optimizeIncludes(include: Record<string, any>): Record<string, any> {
    // In production, analyze and optimize include patterns
    // For now, return as-is
    return include;
  }
}
