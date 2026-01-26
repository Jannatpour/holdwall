/**
 * Ops: Database migrations (production-safe)
 *
 * Applies Prisma SQL migrations in environments where Prisma CLI cannot access
 * protected/integration-provided DATABASE_URL values.
 *
 * Security:
 * - Production-only
 * - Requires x-canary-token header matching CANARY_TOKEN
 * - Optional IP allowlist via CANARY_IP_ALLOWLIST (comma-separated)
 *
 * Notes:
 * - Uses `pg` directly to execute multi-statement migration SQL.
 * - Tracks applied migrations in Prisma-compatible `_prisma_migrations`.
 */

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { randomUUID, createHash } from "crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const xri = request.headers.get("x-real-ip")?.trim();
  return xff || xri || "unknown";
}

function assertAuthorized(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    throw new Error("Forbidden");
  }

  // Disable by default. Only enable explicitly during an ops window.
  if (process.env.OPS_MIGRATIONS_ENABLED !== "true") {
    // Return "not found" semantics to reduce discoverability.
    throw new Error("NotFound");
  }

  const expected = process.env.CANARY_TOKEN?.trim();
  const provided = request.headers.get("x-canary-token")?.trim();
  if (!expected || !provided || provided !== expected) {
    throw new Error("Unauthorized");
  }

  const allowlist = (process.env.CANARY_IP_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ip = getClientIp(request);
  if (allowlist.length > 0 && !allowlist.includes(ip)) {
    throw new Error("Forbidden");
  }
}

function getPgPool() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  let ssl: false | { rejectUnauthorized: boolean } = false;
  try {
    const parsed = new URL(databaseUrl);
    const hostname = parsed.hostname;
    const isLocalHost =
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
    const forceDisableSsl =
      parsed.searchParams.get("sslmode") === "disable" || parsed.searchParams.get("ssl") === "0";
    if (process.env.NODE_ENV === "production" && !isLocalHost && !forceDisableSsl) {
      ssl = { rejectUnauthorized: false };
    }
  } catch {
    ssl = false;
  }

  return new Pool({
    connectionString: databaseUrl,
    ssl,
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  });
}

async function ensurePrismaMigrationsTable(client: { query: (sql: string, params?: any[]) => Promise<any> }) {
  // Prisma's migration tracking table (minimal compatibility).
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    );
  `);
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let buf = "";

  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag: string | null = null;

  const flush = () => {
    const trimmed = buf.trim();
    if (trimmed) statements.push(trimmed);
    buf = "";
  };

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]!;
    const next = sql[i + 1];

    // Handle line comments
    if (!inSingle && !inDouble && !inBlockComment && !dollarTag) {
      if (!inLineComment && ch === "-" && next === "-") {
        inLineComment = true;
      }
    }
    if (inLineComment) {
      buf += ch;
      if (ch === "\n") inLineComment = false;
      continue;
    }

    // Handle block comments
    if (!inSingle && !inDouble && !inLineComment && !dollarTag) {
      if (!inBlockComment && ch === "/" && next === "*") {
        inBlockComment = true;
        buf += ch;
        continue;
      }
      if (inBlockComment && ch === "*" && next === "/") {
        inBlockComment = false;
        buf += ch;
        continue;
      }
    }
    if (inBlockComment) {
      buf += ch;
      continue;
    }

    // Dollar-quoted blocks: $tag$ ... $tag$
    if (!inSingle && !inDouble && !inLineComment && !inBlockComment) {
      if (!dollarTag && ch === "$") {
        const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
        if (m) {
          dollarTag = m[0];
          buf += dollarTag;
          i += dollarTag.length - 1;
          continue;
        }
      } else if (dollarTag && ch === "$") {
        if (sql.slice(i, i + dollarTag.length) === dollarTag) {
          buf += dollarTag;
          i += dollarTag.length - 1;
          dollarTag = null;
          continue;
        }
      }
    }
    if (dollarTag) {
      buf += ch;
      continue;
    }

    // Quotes
    if (!inDouble && ch === "'" && sql[i - 1] !== "\\") inSingle = !inSingle;
    if (!inSingle && ch === "\"" && sql[i - 1] !== "\\") inDouble = !inDouble;

    // Statement terminator
    if (!inSingle && !inDouble && ch === ";") {
      flush();
      continue;
    }

    buf += ch;
  }

  flush();
  return statements;
}

function isIgnorableMigrationError(error: any, statement: string): boolean {
  const code = typeof error?.code === "string" ? error.code : "";
  const message = (error?.message ? String(error.message) : "").toLowerCase();
  const head = statement.trim().slice(0, 64).toUpperCase();

  // Duplicate-type/table/index/constraint/etc.
  if (code === "42710" || code === "42P07" || code === "42701") return true;

  // Common "already exists" phrasing across objects.
  if (message.includes("already exists") && head.startsWith("CREATE")) return true;

  // If a migration tries to drop a constraint that was already dropped by a prior manual change.
  if (message.includes("does not exist") && (head.startsWith("DROP") || head.startsWith("ALTER TABLE"))) {
    // Only ignore if it's about constraints/indexes/types.
    if (message.includes("constraint") || message.includes("index") || message.includes("type")) return true;
  }

  return false;
}

async function listMigrationDirs(): Promise<Array<{ name: string; sqlPath: string }>> {
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });

  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !name.startsWith("."))
    .sort();

  return dirs.map((name) => ({
    name,
    sqlPath: path.join(migrationsDir, name, "migration.sql"),
  }));
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    assertAuthorized(request);

    const pool = getPgPool();
    const client = await pool.connect();

    try {
      await ensurePrismaMigrationsTable(client);

      const appliedRows = await client.query(
        `SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL`
      );
      const applied = new Set<string>(appliedRows.rows.map((r: any) => String(r.migration_name)));

      const migrations = await listMigrationDirs();
      const toApply = migrations.filter((m) => !applied.has(m.name));

      const appliedNow: Array<{ name: string; checksum: string; ms: number }> = [];

      for (const mig of toApply) {
        const sql = await fs.readFile(mig.sqlPath, "utf8");
        const checksum = sha256Hex(sql);
        const startedAt = new Date();
        const migStart = Date.now();

        await client.query("BEGIN");
        try {
          // Execute migration SQL safely (statement-by-statement), allowing idempotent re-runs.
          const statements = splitSqlStatements(sql);
          for (let idx = 0; idx < statements.length; idx++) {
            const stmt = statements[idx]!;
            const sp = `sp_${idx}`;
            try {
              await client.query(`SAVEPOINT ${sp}`);
              await client.query(stmt);
              await client.query(`RELEASE SAVEPOINT ${sp}`);
            } catch (err) {
              if (isIgnorableMigrationError(err, stmt)) {
                // In Postgres, any error aborts the transaction until ROLLBACK.
                // Use savepoints to ignore idempotent "already exists" errors safely.
                try {
                  await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
                  await client.query(`RELEASE SAVEPOINT ${sp}`);
                } catch {
                  // If savepoint cleanup fails, fall back to aborting the migration.
                  throw err;
                }
                continue;
              }
              throw err;
            }
          }
          await client.query(
            `INSERT INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","logs","rolled_back_at","started_at","applied_steps_count")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              randomUUID(),
              checksum,
              new Date(),
              mig.name,
              null,
              null,
              startedAt,
              1,
            ]
          );
          await client.query("COMMIT");
          appliedNow.push({ name: mig.name, checksum, ms: Date.now() - migStart });
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        }
      }

      const duration_ms = Date.now() - start;
      logger.info("Ops migration run completed", {
        duration_ms,
        applied: appliedNow.length,
      });

      return NextResponse.json({
        ok: true,
        duration_ms,
        applied: appliedNow,
        already_applied: migrations.length - toApply.length,
        total_migrations: migrations.length,
      });
    } finally {
      client.release();
      await pool.end().catch(() => undefined);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      message === "NotFound" ? 404 : message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    logger.error("Ops migration run failed", { message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

