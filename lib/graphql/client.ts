/**
 * GraphQL Client
 * 
 * Production-ready GraphQL client utility for making queries and mutations
 * from React components and server-side code.
 */

"use client";

import { useSession } from "next-auth/react";

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
    extensions?: Record<string, unknown>;
  }>;
}

export interface GraphQLError extends Error {
  errors?: GraphQLResponse["errors"];
  response?: Response;
}

/**
 * Execute a GraphQL query or mutation
 */
export async function graphqlRequest<T = unknown>(
  request: GraphQLRequest
): Promise<GraphQLResponse<T>> {
  const response = await fetch("/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    credentials: "include",
  });

  if (!response.ok) {
    const error: GraphQLError = new Error(
      `GraphQL request failed: ${response.statusText}`
    );
    error.response = response;
    throw error;
  }

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors && result.errors.length > 0) {
    const error: GraphQLError = new Error(
      result.errors.map((e) => e.message).join(", ")
    );
    error.errors = result.errors;
    throw error;
  }

  return result;
}

/**
 * React hook for GraphQL queries
 */
export function useGraphQL() {
  const { data: session } = useSession();

  const query = async <T = unknown>(
    request: GraphQLRequest
  ): Promise<T | null> => {
    if (!session?.user) {
      throw new Error("Not authenticated");
    }

    const result = await graphqlRequest<T>(request);
    return result.data ?? null;
  };

  const mutate = async <T = unknown>(
    request: GraphQLRequest
  ): Promise<T | null> => {
    if (!session?.user) {
      throw new Error("Not authenticated");
    }

    const result = await graphqlRequest<T>(request);
    return result.data ?? null;
  };

  return { query, mutate, isAuthenticated: !!session?.user };
}

/**
 * Server-side GraphQL client (for use in server components/API routes)
 */
export async function serverGraphQLRequest<T = unknown>(
  request: GraphQLRequest,
  headers?: HeadersInit
): Promise<GraphQLResponse<T>> {
  const response = await fetch(
    typeof window === "undefined"
      ? `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/graphql`
      : "/api/graphql",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const error: GraphQLError = new Error(
      `GraphQL request failed: ${response.statusText}`
    );
    error.response = response;
    throw error;
  }

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors && result.errors.length > 0) {
    const error: GraphQLError = new Error(
      result.errors.map((e) => e.message).join(", ")
    );
    error.errors = result.errors;
    throw error;
  }

  return result;
}
