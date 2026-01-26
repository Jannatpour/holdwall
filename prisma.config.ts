import dotenv from "dotenv";
import { defineConfig } from "prisma/config";
import path from "node:path";

// Load local env files for Prisma CLI runs.
// Vercel injects environment variables at build/runtime, so this is a no-op there.
dotenv.config({ path: ".env" });
// Do not override already-provided env vars (e.g. sourced production env).
dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    // Prisma ORM v7 reads URLs from prisma.config.ts (not schema.prisma).
    // Use `process.env` directly so `prisma generate` can run even when DATABASE_URL
    // isn't set in lightweight environments (e.g. CI type-check steps).
    url: process.env.DATABASE_URL ?? "",
    // Disable shadow database for development
    shadowDatabaseUrl: undefined,
  },
});
