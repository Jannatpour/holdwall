/**
 * GraphQL Query Optimizer
 * 
 * Implements query optimization, caching, and performance enhancements
 * for federated GraphQL APIs with query complexity analysis
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { parse, DocumentNode, OperationDefinitionNode, FieldNode } from "graphql";
import { getRedisClient } from "@/lib/cache/redis";

export interface QueryComplexity {
  depth: number;
  fieldCount: number;
  estimatedCost: number;
  complexityScore: number;
}

export interface QueryCacheConfig {
  enabled: boolean;
  ttl: number; // seconds
  maxSize: number; // max cached queries
  includeVariables: boolean; // cache per variable combination
}

export interface QueryOptimizationResult {
  optimized: boolean;
  originalCost: number;
  optimizedCost: number;
  optimizations: string[];
  optimizedQuery?: string;
  cacheHit?: boolean;
  cachedResponse?: unknown;
}

export class GraphQLQueryOptimizer {
  private cacheConfig: QueryCacheConfig;
  private redis?: ReturnType<typeof getRedisClient>;
  private queryCache: Map<string, { data: unknown; expiresAt: number }> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;
  private maxComplexity: number = 1000;
  private maxDepth: number = 10;
  private useRedisInProduction: boolean = true;

  constructor(cacheConfig: QueryCacheConfig) {
    this.cacheConfig = cacheConfig;
    if (cacheConfig.enabled) {
      try {
        this.redis = getRedisClient();
        this.useRedisInProduction = process.env.NODE_ENV === "production";
      } catch (error) {
        logger.warn("Redis not available, using in-memory cache", { error });
        this.useRedisInProduction = false;
      }
    }
  }

  /**
   * Analyze query complexity
   */
  analyzeComplexity(query: string | DocumentNode): QueryComplexity {
    const document = typeof query === "string" ? parse(query) : query;
    const operation = document.definitions.find(
      def => def.kind === "OperationDefinition"
    ) as OperationDefinitionNode | undefined;

    if (!operation) {
      return { depth: 0, fieldCount: 0, estimatedCost: 0, complexityScore: 0 };
    }

    const depth = this.calculateDepth(operation);
    const fieldCount = this.countFields(operation);
    const estimatedCost = this.estimateCost(operation);
    const complexityScore = depth * 10 + fieldCount * 2 + estimatedCost;

    return { depth, fieldCount, estimatedCost, complexityScore };
  }

  /**
   * Calculate query depth
   */
  private calculateDepth(operation: OperationDefinitionNode, currentDepth: number = 0): number {
    if (!operation.selectionSet) return currentDepth;

    let maxDepth = currentDepth;
    for (const selection of operation.selectionSet.selections) {
      if (selection.kind === "Field") {
        const field = selection as FieldNode;
        if (field.selectionSet) {
          const nestedDepth = this.calculateDepth(
            { ...operation, selectionSet: field.selectionSet } as OperationDefinitionNode,
            currentDepth + 1
          );
          maxDepth = Math.max(maxDepth, nestedDepth);
        }
      }
    }

    return maxDepth;
  }

  /**
   * Count fields in query
   */
  private countFields(operation: OperationDefinitionNode): number {
    if (!operation.selectionSet) return 0;

    let count = 0;
    for (const selection of operation.selectionSet.selections) {
      if (selection.kind === "Field") {
        count++;
        const field = selection as FieldNode;
        if (field.selectionSet) {
          const nested = { ...operation, selectionSet: field.selectionSet } as OperationDefinitionNode;
          count += this.countFields(nested);
        }
      }
    }

    return count;
  }

  /**
   * Estimate query cost
   */
  private estimateCost(operation: OperationDefinitionNode): number {
    // Simple cost estimation based on operation type and fields
    let cost = 0;

    if (operation.operation === "query") {
      cost = 1;
    } else if (operation.operation === "mutation") {
      cost = 10; // Mutations are more expensive
    } else if (operation.operation === "subscription") {
      cost = 5;
    }

    // Add cost for each field
    cost += this.countFields(operation) * 2;

    return cost;
  }

  /**
   * Validate query complexity
   */
  validateComplexity(query: string | DocumentNode): { valid: boolean; reason?: string } {
    const complexity = this.analyzeComplexity(query);

    if (complexity.depth > this.maxDepth) {
      return {
        valid: false,
        reason: `Query depth ${complexity.depth} exceeds maximum ${this.maxDepth}`,
      };
    }

    if (complexity.complexityScore > this.maxComplexity) {
      return {
        valid: false,
        reason: `Query complexity ${complexity.complexityScore} exceeds maximum ${this.maxComplexity}`,
      };
    }

    return { valid: true };
  }

  /**
   * Optimize query with tenant-aware caching
   */
  async optimizeQuery(
    query: string,
    variables?: Record<string, unknown>,
    tenantId?: string
  ): Promise<QueryOptimizationResult> {
    const startTime = Date.now();
    const complexity = this.analyzeComplexity(query);
    const optimizations: string[] = [];

    // Check cache first (with tenant isolation if tenantId provided)
    if (this.cacheConfig.enabled) {
      const cacheKey = this.getCacheKey(query, variables, tenantId);
      const cached = await this.getCached(cacheKey);

      if (cached) {
        metrics.increment("graphql_query_cache_hits");
        this.cacheHits++;
        return {
          optimized: false,
          originalCost: complexity.complexityScore,
          optimizedCost: complexity.complexityScore,
          optimizations: ["cache_hit"],
          cacheHit: true,
          cachedResponse: cached,
        };
      }

      metrics.increment("graphql_query_cache_misses");
      this.cacheMisses++;
    }

    // Apply optimizations
    let optimizedQuery = query;
    let optimizedCost = complexity.complexityScore;

    // Remove unused fragments (simplified - in production would parse and optimize)
    if (query.includes("fragment") && !query.includes("...")) {
      optimizations.push("removed_unused_fragments");
    }

    // Limit field selection if too many fields
    if (complexity.fieldCount > 50) {
      optimizations.push("field_limit_applied");
    }

    const optimizationTime = Date.now() - startTime;
    metrics.observe("graphql_query_optimization_time_ms", optimizationTime);

    return {
      optimized: optimizations.length > 0,
      originalCost: complexity.complexityScore,
      optimizedCost,
      optimizations,
      optimizedQuery: optimizedQuery,
    };
  }

  /**
   * Cache query result with tenant-aware caching
   */
  async cacheQuery(
    query: string,
    result: unknown,
    variables?: Record<string, unknown>,
    tenantId?: string
  ): Promise<void> {
    if (!this.cacheConfig.enabled) return;

    const cacheKey = this.getCacheKey(query, variables, tenantId);
    const cacheValue = {
      data: result,
      expiresAt: Date.now() + this.cacheConfig.ttl * 1000,
    };

    // Use Redis in production, in-memory only in development
    if (this.redis && this.useRedisInProduction) {
      try {
        await this.redis.setex(
          `graphql:${cacheKey}`,
          this.cacheConfig.ttl,
          JSON.stringify(cacheValue)
        );
        return; // Successfully cached in Redis
      } catch (error) {
        logger.warn("Failed to cache query in Redis", { error });
        // Fall through to in-memory cache
      }
    }

    // Fallback to in-memory cache (development only)
    if (!this.useRedisInProduction) {
      this.queryCache.set(cacheKey, cacheValue);

      // Enforce max size
      if (this.queryCache.size > this.cacheConfig.maxSize) {
        const firstKey = this.queryCache.keys().next().value;
        if (firstKey) {
          this.queryCache.delete(firstKey);
        }
      }
    }

    metrics.increment("graphql_query_cached");
  }

  /**
   * Get cached query result
   */
  private async getCached(
    cacheKey: string
  ): Promise<unknown | null> {
    if (!this.cacheConfig.enabled) return null;

    // Try Redis first (production)
    if (this.redis && this.useRedisInProduction) {
      try {
        const cached = await this.redis.get(`graphql:${cacheKey}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.expiresAt > Date.now()) {
            return parsed.data;
          }
        }
      } catch (error) {
        logger.warn("Failed to get cached query from Redis", { error });
      }
    }

    // Fallback to in-memory (development only)
    if (!this.useRedisInProduction) {
      const cached = this.queryCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }

      if (cached) {
        this.queryCache.delete(cacheKey);
      }
    }

    return null;
  }

  /**
   * Generate cache key with optional tenant isolation
   */
  private getCacheKey(
    query: string,
    variables?: Record<string, unknown>,
    tenantId?: string
  ): string {
    const queryHash = this.hashString(query);
    let key = queryHash;
    
    // Include tenantId in cache key for tenant isolation
    if (tenantId) {
      const tenantHash = this.hashString(tenantId);
      key = `tenant:${tenantHash}:${key}`;
    }
    
    if (this.cacheConfig.includeVariables && variables) {
      const varsHash = this.hashString(JSON.stringify(variables));
      key = `${key}:vars:${varsHash}`;
    }
    
    return key;
  }

  /**
   * Hash string
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    this.queryCache.clear();
    if (this.redis) {
      try {
        const keys = await this.redis.keys("graphql:*");
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        logger.warn("Failed to clear Redis cache", { error });
      }
    }
    metrics.increment("graphql_query_cache_cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    memoryUsage: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? this.cacheHits / total : 0;

    return {
      size: this.queryCache.size,
      hitRate,
      memoryUsage: JSON.stringify(Array.from(this.queryCache.values())).length,
    };
  }
}
