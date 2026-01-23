/**
 * Comprehensive System Verification Script
 * 
 * Validates all system components, connections, and functionality end-to-end.
 * This script ensures every part of the system is operational and properly connected.
 * 
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/comprehensive-system-verification.ts
 */

import { db } from "../lib/db/client";
import { getRedisClient } from "../lib/cache/redis";
import { initializeServices, shutdownServices } from "../lib/integration/startup";
import { logger } from "../lib/logging/logger";
import { checkHealth } from "../lib/monitoring/health";

interface VerificationResult {
  component: string;
  status: "pass" | "fail" | "warning";
  message: string;
  details?: any;
}

const results: VerificationResult[] = [];

function recordResult(component: string, status: "pass" | "fail" | "warning", message: string, details?: any) {
  results.push({ component, status, message, details });
  const icon = status === "pass" ? "✅" : status === "fail" ? "❌" : "⚠️";
  console.log(`${icon} ${component}: ${message}`);
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

async function verifyDatabase() {
  try {
    // Test basic connection
    await db.$queryRaw`SELECT 1`;
    recordResult("Database Connection", "pass", "Database connection successful");

    // Test schema integrity
    const userCount = await db.user.count();
    recordResult("Database Schema", "pass", `Schema valid, ${userCount} users found`);

    // Test tenant
    const tenantCount = await db.tenant.count();
    if (tenantCount === 0) {
      recordResult("Database Tenants", "warning", "No tenants found - may need seeding");
    } else {
      recordResult("Database Tenants", "pass", `${tenantCount} tenants found`);
    }
  } catch (error) {
    recordResult("Database Connection", "fail", "Database connection failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function verifyCache() {
  try {
    const redis = getRedisClient();
    if (redis) {
      await redis.ping();
      recordResult("Redis Cache", "pass", "Redis connection successful");
    } else {
      recordResult("Redis Cache", "warning", "Redis not configured, using in-memory fallback");
    }
  } catch (error) {
    recordResult("Redis Cache", "warning", "Redis connection failed, using fallback", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function verifyAuthentication() {
  try {
    // Check if NextAuth is properly configured
    const hasNextAuthSecret = !!process.env.NEXTAUTH_SECRET;
    const hasNextAuthUrl = !!process.env.NEXTAUTH_URL;

    if (hasNextAuthSecret && hasNextAuthUrl) {
      recordResult("Authentication Config", "pass", "NextAuth configuration complete");
    } else {
      recordResult("Authentication Config", "warning", "NextAuth environment variables missing", {
        hasSecret: hasNextAuthSecret,
        hasUrl: hasNextAuthUrl,
      });
    }

    // Check for users with password hashes
    const usersWithPasswords = await db.user.count({
      where: { passwordHash: { not: null } },
    });

    if (usersWithPasswords > 0) {
      recordResult("Authentication Users", "pass", `${usersWithPasswords} users with passwords found`);
    } else {
      recordResult("Authentication Users", "warning", "No users with passwords found - may need seeding");
    }
  } catch (error) {
    recordResult("Authentication", "fail", "Authentication verification failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function verifyServices() {
  try {
    const startupResult = await initializeServices();
    
    if (startupResult.success) {
      recordResult("Service Initialization", "pass", "All services initialized successfully", {
        services: startupResult.services,
      });
    } else {
      recordResult("Service Initialization", "warning", "Services initialized with some errors", {
        services: startupResult.services,
        errors: startupResult.errors,
      });
    }
  } catch (error) {
    recordResult("Service Initialization", "fail", "Service initialization failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function verifyHealthEndpoint() {
  try {
    const health = await checkHealth();
    
    if (health.status === "healthy") {
      recordResult("Health Endpoint", "pass", "Health check passed", {
        status: health.status,
        services: Object.keys(health.services || {}),
      });
    } else {
      recordResult("Health Endpoint", "warning", "Health check returned warnings", {
        status: health.status,
        services: health.services,
      });
    }
  } catch (error) {
    recordResult("Health Endpoint", "fail", "Health check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function verifyEnvironment() {
  const required = [
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
  ];

  const optional = [
    "REDIS_URL",
    "KAFKA_BROKERS",
    "KAFKA_ENABLED",
    "OPENAI_API_KEY",
  ];

  const missing: string[] = [];
  const present: string[] = [];

  for (const key of required) {
    if (process.env[key]) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }

  if (missing.length === 0) {
    recordResult("Environment Variables", "pass", "All required environment variables present", {
      required: present,
    });
  } else {
    recordResult("Environment Variables", "fail", "Missing required environment variables", {
      missing,
      present,
    });
  }

  // Check optional
  const optionalPresent = optional.filter((key) => process.env[key]);
  if (optionalPresent.length > 0) {
    recordResult("Optional Environment Variables", "pass", `${optionalPresent.length} optional variables configured`, {
      present: optionalPresent,
    });
  }
}

async function verifyEmailNormalization() {
  try {
    // Check if any users have mixed-case emails
    const allUsers = await db.user.findMany({
      select: { email: true },
    });

    const mixedCaseEmails = allUsers.filter((user) => {
      const normalized = user.email.trim().toLowerCase();
      return user.email !== normalized;
    });

    if (mixedCaseEmails.length === 0) {
      recordResult("Email Normalization", "pass", "All emails are normalized (lowercase)");
    } else {
      recordResult("Email Normalization", "warning", `${mixedCaseEmails.length} users have mixed-case emails`, {
        count: mixedCaseEmails.length,
        note: "Run normalize-emails-production.ts to fix",
      });
    }
  } catch (error) {
    recordResult("Email Normalization", "fail", "Email normalization check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function main() {
  console.log("🔍 Comprehensive System Verification\n");
  console.log("=".repeat(60));
  console.log("");

  // Run all verifications
  await verifyEnvironment();
  await verifyDatabase();
  await verifyCache();
  await verifyAuthentication();
  await verifyEmailNormalization();
  await verifyServices();
  await verifyHealthEndpoint();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Verification Summary");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.status === "pass").length;
  const warnings = results.filter((r) => r.status === "warning").length;
  const failed = results.filter((r) => r.status === "fail").length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📋 Total: ${results.length}`);

  if (failed > 0) {
    console.log("\n❌ Failed Components:");
    results
      .filter((r) => r.status === "fail")
      .forEach((r) => {
        console.log(`   - ${r.component}: ${r.message}`);
      });
  }

  if (warnings > 0) {
    console.log("\n⚠️  Warnings:");
    results
      .filter((r) => r.status === "warning")
      .forEach((r) => {
        console.log(`   - ${r.component}: ${r.message}`);
      });
  }

  console.log("\n" + "=".repeat(60));

  if (failed === 0) {
    console.log("✅ System verification complete - All critical components operational");
    process.exit(0);
  } else {
    console.log("❌ System verification found critical issues - Please review and fix");
    process.exit(1);
  }
}

main()
  .then(() => {
    shutdownServices().catch(() => {});
  })
  .catch((error) => {
    console.error("❌ Fatal error during verification:", error);
    shutdownServices().catch(() => {});
    process.exit(1);
  })
  .finally(() => {
    db.$disconnect().catch(() => {});
  });
