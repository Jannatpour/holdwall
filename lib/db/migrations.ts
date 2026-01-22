/**
 * Database Migrations
 * Production migration utilities
 */

import { db } from "./client";

/**
 * Run database migrations
 * 
 * Production-ready migration utilities using Prisma migrate
 * Also supports custom data migrations
 */
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Run Prisma migrations
 */
export async function runPrismaMigrations(): Promise<void> {
  try {
    // Run Prisma migrate deploy (for production) or migrate dev (for development)
    const command = process.env.NODE_ENV === "production"
      ? "npx prisma migrate deploy"
      : "npx prisma migrate dev";

    const { stdout, stderr } = await execAsync(command);
    console.log("Migration output:", stdout);
    if (stderr) {
      console.warn("Migration warnings:", stderr);
    }
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

/**
 * Run custom data migrations
 */
export async function runDataMigrations(): Promise<void> {
  const { db } = await import("./client");
  
  // Create default tenant if none exists
  const tenantCount = await db.tenant.count();
  if (tenantCount === 0) {
    await db.tenant.create({
      data: {
        name: "Default Tenant",
        slug: "default",
      },
    });
    console.log("Created default tenant");
  }

  // Add any other data migrations here
}

/**
 * Run all migrations
 */
export async function runMigrations(): Promise<void> {
  console.log("Running database migrations...");
  
  // Run Prisma schema migrations
  await runPrismaMigrations();
  
  // Run custom data migrations
  await runDataMigrations();
  
  console.log("Migrations completed");
}
