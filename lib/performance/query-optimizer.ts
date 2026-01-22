/**
 * Query Optimizer
 * 
 * Optimizes vector searches and database queries
 * Combines filters, uses indexes, limits result sets
 */

export interface QueryOptimizationOptions {
  limit?: number;
  useIndexes?: boolean;
  combineFilters?: boolean;
  earlyTermination?: boolean;
}

/**
 * Optimize vector search query
 */
export function optimizeVectorQuery(
  query: string,
  filters?: Record<string, unknown>,
  options?: QueryOptimizationOptions
): {
  optimizedQuery: string;
  filters: Record<string, unknown>;
  limit: number;
} {
  const {
    limit = 10,
    combineFilters = true,
  } = options || {};

  // Normalize query
  const optimizedQuery = query.trim().toLowerCase();

  // Combine and normalize filters
  const optimizedFilters: Record<string, unknown> = {};
  if (filters && combineFilters) {
    // Remove empty filters
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") {
        optimizedFilters[key] = value;
      }
    }
  } else if (filters) {
    Object.assign(optimizedFilters, filters);
  }

  return {
    optimizedQuery,
    filters: optimizedFilters,
    limit: Math.min(limit, 100), // Cap at 100 for performance
  };
}

/**
 * Optimize database query filters
 */
export function optimizeDBFilters(
  filters: Record<string, unknown>,
  options?: {
    useIndexes?: boolean;
    maxFilters?: number;
  }
): Record<string, unknown> {
  const {
    useIndexes = true,
    maxFilters = 5,
  } = options || {};

  const optimized: Record<string, unknown> = {};

  // Prioritize indexed fields
  const indexedFields = ["tenantId", "createdAt", "type", "status"];
  const otherFields: Array<[string, unknown]> = [];

  for (const [key, value] of Object.entries(filters)) {
    if (indexedFields.includes(key)) {
      optimized[key] = value;
    } else {
      otherFields.push([key, value]);
    }
  }

  // Add other fields up to maxFilters
  for (let i = 0; i < Math.min(otherFields.length, maxFilters); i++) {
    const [key, value] = otherFields[i];
    optimized[key] = value;
  }

  return optimized;
}

/**
 * Estimate query cost (for query planning)
 */
export function estimateQueryCost(
  queryType: "vector" | "database" | "hybrid",
  options: {
    resultLimit?: number;
    filterCount?: number;
    vectorDimensions?: number;
  }
): number {
  const {
    resultLimit = 10,
    filterCount = 0,
    vectorDimensions = 768,
  } = options;

  let cost = 0;

  switch (queryType) {
    case "vector":
      // Vector search cost: O(n * d) where n = candidates, d = dimensions
      cost = resultLimit * vectorDimensions * 0.001; // Normalized
      break;
    case "database":
      // DB query cost: depends on filters and limit
      cost = filterCount * 0.1 + resultLimit * 0.01;
      break;
    case "hybrid":
      // Combined cost
      cost = (resultLimit * vectorDimensions * 0.001) + (filterCount * 0.1);
      break;
  }

  return cost;
}
