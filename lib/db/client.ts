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

  // Prisma 7 client engine requires either a Driver Adapter or Accelerate URL.
  // We standardize on the Postgres driver adapter everywhere.
  //
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
    throw new Error("DATABASE_URL is required in production.");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
