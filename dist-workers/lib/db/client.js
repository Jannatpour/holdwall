"use strict";
/**
 * Database Client
 * Production-ready Prisma client with connection pooling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const globalForPrisma = globalThis;
function createPrismaClient() {
    const configuredUrl = process.env.DATABASE_URL;
    const isDockerBuild = process.env.DOCKER_BUILD === "true";
    const isNextBuild = process.env.NEXT_PHASE === "phase-production-build" ||
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
            console.warn("DATABASE_URL not configured in production. Database operations will fail.");
        }
        // Use a dummy URL that will fail on connection attempt, not on client creation.
        const dummyUrl = "postgresql://dummy:dummy@localhost:5432/dummy";
        const pool = new pg_1.Pool({
            connectionString: dummyUrl,
            max: 2,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
            allowExitOnIdle: process.env.NODE_ENV === "test",
        });
        const adapter = new adapter_pg_1.PrismaPg(pool);
        return new client_1.PrismaClient({ adapter, log: ["error"] });
    }
    try {
        // Many managed Postgres providers (e.g. Supabase) require TLS from serverless environments.
        // `pg` does not enable SSL by default, so we do it automatically in production for non-local hosts.
        let ssl = false;
        try {
            const parsed = new URL(databaseUrl);
            const hostname = parsed.hostname;
            const isLocalHost = hostname === "localhost" ||
                hostname === "127.0.0.1" ||
                hostname === "0.0.0.0";
            const forceDisableSsl = parsed.searchParams.get("sslmode") === "disable" ||
                parsed.searchParams.get("ssl") === "0";
            if (process.env.NODE_ENV === "production" && !isLocalHost && !forceDisableSsl) {
                ssl = { rejectUnauthorized: false };
            }
        }
        catch {
            // If parsing fails, fall back to safe defaults (no SSL unless explicitly enabled).
            ssl = false;
        }
        const isServerless = !!process.env.VERCEL;
        const pool = new pg_1.Pool({
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
        const adapter = new adapter_pg_1.PrismaPg(pool);
        return new client_1.PrismaClient({
            adapter,
            log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
        });
    }
    catch (error) {
        console.error("Failed to create Prisma client:", error);
        // Return a client anyway - it will fail on first use, not during initialization
        const dummyUrl = "postgresql://dummy:dummy@localhost:5432/dummy";
        const pool = new pg_1.Pool({
            connectionString: dummyUrl,
            max: 2,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
            allowExitOnIdle: process.env.NODE_ENV === "test",
        });
        const adapter = new adapter_pg_1.PrismaPg(pool);
        return new client_1.PrismaClient({ adapter, log: ["error"] });
    }
}
exports.db = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = exports.db;
}
