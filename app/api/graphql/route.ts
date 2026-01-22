/**
 * GraphQL API Route
 * 
 * Production-ready GraphQL endpoint with:
 * - Query and mutation support
 * - Error handling
 * - Authentication
 * - Federation support
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { typeDefs } from "@/lib/graphql/schema";
import { resolvers } from "@/lib/graphql/resolvers";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { buildFederatedSchema } from "@/lib/graphql/federation";
import { GraphQLQueryOptimizer, QueryCacheConfig } from "@/lib/graphql/query-optimizer";
import { logger } from "@/lib/logging/logger";

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Lazy schema building to avoid build-time errors
let schemaCache: any = null;
function getSchema() {
  if (!schemaCache) {
    const useFederation = process.env.GRAPHQL_FEDERATION === "true";
    schemaCache = useFederation
      ? buildFederatedSchema()
      : makeExecutableSchema({
          typeDefs,
          resolvers,
        });
  }
  return schemaCache;
}

// Initialize query optimizer
let queryOptimizerCache: GraphQLQueryOptimizer | null = null;
function getQueryOptimizer() {
  if (!queryOptimizerCache) {
    const cacheConfig: QueryCacheConfig = {
      enabled: process.env.GRAPHQL_CACHE_ENABLED !== "false",
      ttl: parseInt(process.env.GRAPHQL_CACHE_TTL || "3600", 10),
      maxSize: parseInt(process.env.GRAPHQL_CACHE_MAX_SIZE || "1000", 10),
      includeVariables: process.env.GRAPHQL_CACHE_INCLUDE_VARIABLES === "true",
    };
    queryOptimizerCache = new GraphQLQueryOptimizer(cacheConfig);
  }
  return queryOptimizerCache;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const body = await request.json();
    const { query: rawQuery, variables, operationName } = body;
    let query = rawQuery;

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const queryOptimizer = getQueryOptimizer();
    const schema = getSchema();

    // Validate query complexity
    const complexityCheck = queryOptimizer.validateComplexity(query);
    if (!complexityCheck.valid) {
      return NextResponse.json(
        { error: complexityCheck.reason },
        { status: 400 }
      );
    }

    // Optimize query and check cache
    const optimization = await queryOptimizer.optimizeQuery(query, variables);
    
    // Return cached result if available
    if (optimization.cacheHit && optimization.cachedResponse) {
      return NextResponse.json(optimization.cachedResponse);
    }

    // Use optimized query if available
    if (optimization.optimized && typeof optimization.optimizedQuery === "string") {
      query = optimization.optimizedQuery;
    }

    // Execute GraphQL query
    const startTime = Date.now();
    const result = await graphql({
      schema,
      source: query,
      variableValues: variables,
      operationName,
      contextValue: {
        user,
        tenantId,
      },
    });
    const duration = Date.now() - startTime;

    // Cache successful queries
    if (result.errors === undefined || result.errors.length === 0) {
      await queryOptimizer.cacheQuery(query, result, variables).catch((error) => {
        logger.warn("Failed to cache GraphQL query", { error });
      });
    }

    // Handle GraphQL errors
    if (result.errors && result.errors.length > 0) {
      logger.error("GraphQL query errors", {
        errors: result.errors.map(e => e.message),
        operationName,
        duration,
      });
      return NextResponse.json(
        {
          errors: result.errors.map((error) => ({
            message: error.message,
            locations: error.locations,
            path: error.path,
          })),
        },
        { status: 200 } // GraphQL returns 200 even with errors
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("GraphQL API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        errors: [
          {
            message: error instanceof Error ? error.message : "Internal server error",
          },
        ],
      },
      { status: 500 }
    );
  }
}

// Support GET for GraphQL Playground
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "GraphQL API",
    endpoint: "/api/graphql",
    method: "POST",
    schema: "Available via introspection query",
  });
}
