/**
 * Database Client
 * Production-ready Prisma client with connection pooling
 */

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const configuredUrl = process.env.DATABASE_URL;
  const isDockerBuild = process.env.DOCKER_BUILD === "true";
  const isNextBuild =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-export" ||
    process.env.npm_lifecycle_event === "build";
  const isBuildTime = isDockerBuild || isNextBuild;

  const isPlaceholderUrl = !configuredUrl || configuredUrl.includes("placeholder");

  // During build (especially Docker/Next build-time route evaluation), we must not hard-fail
  // if `DATABASE_URL` is unset/placeholder. The build should succeed; runtime will provide the real URL.
  const databaseUrl = !isPlaceholderUrl
    ? configuredUrl
    : isBuildTime
      ? "postgresql://build:build@localhost:5432/build"
      : process.env.NODE_ENV === "production"
        ? null
        : "postgresql://holdwall:holdwall@localhost:5432/holdwall";

  if (!databaseUrl) {
    // In production, we should have a valid DATABASE_URL
    // But we'll create a client that will fail gracefully on first use
    // rather than throwing during module initialization
    if (process.env.NODE_ENV === "production") {
      const { logger } = require("@/lib/logging/logger");
      logger.warn("DATABASE_URL not configured in production. Database operations will fail.");
    }
    // Use a dummy URL that will fail on connection attempt, not on client creation.
    const dummyUrl = "postgresql://dummy:dummy@localhost:5432/dummy";
    const pool = new Pool({
      connectionString: dummyUrl,
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      allowExitOnIdle: process.env.NODE_ENV === "test",
    });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter, log: ["error"] });
  }

  try {
    // Many managed Postgres providers (e.g. Supabase) require TLS from serverless environments.
    // `pg` does not enable SSL by default, so we do it automatically in production for non-local hosts.
    let ssl: false | { rejectUnauthorized: boolean } = false;
    try {
      const parsed = new URL(databaseUrl);
      const hostname = parsed.hostname;
      const isLocalHost =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0";
      const forceDisableSsl =
        parsed.searchParams.get("sslmode") === "disable" ||
        parsed.searchParams.get("ssl") === "0";

      if (process.env.NODE_ENV === "production" && !isLocalHost && !forceDisableSsl) {
        ssl = { rejectUnauthorized: false };
      }
    } catch {
      // If parsing fails, fall back to safe defaults (no SSL unless explicitly enabled).
      ssl = false;
    }

    const isServerless = !!process.env.VERCEL;
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl,
      // Serverless + poolers can get noisy with too many connections.
      max: process.env.NODE_ENV === "production" && isServerless ? 3 : 20,
      idleTimeoutMillis: 30000,
      // Supabase poolers + serverless cold starts can exceed 2s occasionally.
      connectionTimeoutMillis: process.env.NODE_ENV === "production" ? 8000 : 2000,
      // Allow Jest/CLI processes to exit even if idle.
      allowExitOnIdle: process.env.NODE_ENV === "test",
    });
    const adapter = new PrismaPg(pool);

    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
  } catch (error) {
    const { logger } = require("@/lib/logging/logger");
    logger.error("Failed to create Prisma client", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Return a client anyway - it will fail on first use, not during initialization
    const dummyUrl = "postgresql://dummy:dummy@localhost:5432/dummy";
    const pool = new Pool({
      connectionString: dummyUrl,
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      allowExitOnIdle: process.env.NODE_ENV === "test",
    });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter, log: ["error"] });
  }
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

/**
 * Tenant Isolation Enforcement
 * Production-grade tenant isolation helpers to prevent cross-tenant data access
 */

/**
 * Enforce tenant ID in query where clause
 * Throws if tenantId is missing or invalid
 */
export function enforceTenantId(tenantId: string | undefined | null, operation: string = "database query"): string {
  if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
    throw new Error(`Tenant ID required for ${operation}`);
  }
  return tenantId.trim();
}

/**
 * Create tenant-scoped where clause
 * Ensures all queries include tenantId filter
 */
export function withTenantFilter<T extends Record<string, any>>(
  where: T,
  tenantId: string | undefined | null,
  operation: string = "database query"
): T & { tenantId: string } {
  const enforcedTenantId = enforceTenantId(tenantId, operation);
  return {
    ...where,
    tenantId: enforcedTenantId,
  };
}

/**
 * Validate tenant ownership of a resource
 * Returns true if resource belongs to tenant, false otherwise
 */
export async function validateTenantOwnership(
  model: string,
  resourceId: string,
  tenantId: string
): Promise<boolean> {
  try {
    const enforcedTenantId = enforceTenantId(tenantId, `validate ownership of ${model}`);
    
    // Use Prisma's dynamic model access
    const resource = await (db as any)[model].findFirst({
      where: {
        id: resourceId,
        tenantId: enforcedTenantId,
      },
      select: {
        id: true,
      },
    });

    return resource !== null;
  } catch (error) {
    // On error, fail closed (assume not owned)
    return false;
  }
}

/**
 * Get tenant-scoped query helper
 * Returns a function that automatically adds tenantId to queries
 */
export function createTenantScopedQuery(tenantId: string | undefined | null) {
  const enforcedTenantId = enforceTenantId(tenantId, "create tenant-scoped query");

  return {
    /**
     * Add tenant filter to where clause
     */
    where: <T extends Record<string, any>>(where: T): T & { tenantId: string } => {
      return withTenantFilter(where, enforcedTenantId);
    },

    /**
     * Validate resource ownership
     */
    validateOwnership: async (model: string, resourceId: string): Promise<boolean> => {
      return validateTenantOwnership(model, resourceId, enforcedTenantId);
    },

    /**
     * Get tenant ID
     */
    getTenantId: (): string => enforcedTenantId,
  };
}
