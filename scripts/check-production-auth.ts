#!/usr/bin/env tsx
/**
 * Production Authentication Diagnostic Script
 * 
 * Checks authentication configuration and database connectivity
 * Run this script to diagnose authentication issues in production
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { validateAuthConfig, getAuthConfigErrorMessage } from "../lib/auth/config-validator";
import { db } from "../lib/db/client";
import { logger } from "../lib/logging/logger";

async function checkDatabaseConnection() {
  console.log("\n📊 Checking Database Connection...\n");
  
  try {
    // Test basic connection
    await db.$queryRaw`SELECT 1`;
    console.log("✅ Database connection: SUCCESS");
    
    // Check if User table exists
    try {
      const userCount = await db.user.count();
      console.log(`✅ User table exists: ${userCount} users found`);
    } catch (error) {
      console.log("❌ User table check failed:", error instanceof Error ? error.message : String(error));
      console.log("   → Run database migrations: npx prisma migrate deploy");
      return false;
    }
    
    // Check if Tenant table exists
    try {
      const tenantCount = await db.tenant.count();
      console.log(`✅ Tenant table exists: ${tenantCount} tenants found`);
      
      // Check for default tenant
      const defaultTenant = await db.tenant.findFirst({
        where: { slug: "default" },
      });
      
      if (!defaultTenant) {
        console.log("⚠️  Default tenant not found - will be created on first signup");
      } else {
        console.log("✅ Default tenant exists");
      }
    } catch (error) {
      console.log("❌ Tenant table check failed:", error instanceof Error ? error.message : String(error));
      console.log("   → Run database migrations: npx prisma migrate deploy");
      return false;
    }
    
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log("❌ Database connection: FAILED");
    console.log(`   Error: ${errorMessage}`);
    
    if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
      console.log("\n   → Check DATABASE_URL connection string");
      console.log("   → Verify database server is running and accessible");
    } else if (errorMessage.includes("denied access") || errorMessage.includes("password")) {
      console.log("\n   → Check database credentials in DATABASE_URL");
      console.log("   → Verify user has proper permissions");
    } else if (errorMessage.includes("does not exist") || errorMessage.includes("relation")) {
      console.log("\n   → Database schema not set up");
      console.log("   → Run: npx prisma migrate deploy");
    }
    
    return false;
  }
}

async function checkNextAuthConfig() {
  console.log("\n🔐 Checking NextAuth Configuration...\n");
  
  const configStatus = validateAuthConfig();
  
  if (configStatus.valid) {
    console.log("✅ Authentication configuration: VALID");
    
    // Show configured values (masked)
    console.log("\nConfigured variables:");
    if (process.env.DATABASE_URL) {
      const dbUrl = process.env.DATABASE_URL;
      const masked = dbUrl.replace(/:[^:@]+@/, ":****@");
      console.log(`  ✅ DATABASE_URL: ${masked}`);
    }
    if (process.env.NEXTAUTH_SECRET) {
      const secret = process.env.NEXTAUTH_SECRET;
      const masked = secret.length > 8 ? `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}` : "****";
      console.log(`  ✅ NEXTAUTH_SECRET: ${masked} (${secret.length} chars)`);
    }
    if (process.env.NEXTAUTH_URL) {
      console.log(`  ✅ NEXTAUTH_URL: ${process.env.NEXTAUTH_URL}`);
    }
    
    if (configStatus.warnings.length > 0) {
      console.log("\n⚠️  Warnings:");
      configStatus.warnings.forEach((warning) => {
        console.log(`  • ${warning}`);
      });
    }
    
    return true;
  } else {
    console.log("❌ Authentication configuration: INVALID");
    console.log("\n" + getAuthConfigErrorMessage(configStatus));
    return false;
  }
}

async function testSignupFlow() {
  console.log("\n🧪 Testing Signup Flow...\n");
  
  try {
    // Test database write capability
    const testEmail = `test-${Date.now()}@example.com`;
    
    // Check if we can create a tenant (required for signup)
    let tenant = await db.tenant.findFirst({
      where: { slug: "default" },
    });
    
    if (!tenant) {
      console.log("⚠️  Default tenant not found, testing creation...");
      try {
        tenant = await db.tenant.create({
          data: {
            name: "Default Tenant",
            slug: "default",
          },
        });
        console.log("✅ Default tenant created successfully");
      } catch (error) {
        console.log("❌ Failed to create default tenant:", error instanceof Error ? error.message : String(error));
        return false;
      }
    }
    
    // Test user creation (then delete it)
    try {
      const testUser = await db.user.create({
        data: {
          email: testEmail,
          name: "Test User",
          passwordHash: "test-hash",
          tenantId: tenant.id,
          role: "USER",
        },
      });
      
      console.log("✅ User creation: SUCCESS");
      
      // Clean up test user
      await db.user.delete({
        where: { id: testUser.id },
      });
      console.log("✅ Test user cleaned up");
      
      return true;
    } catch (error) {
      console.log("❌ User creation failed:", error instanceof Error ? error.message : String(error));
      return false;
    }
  } catch (error) {
    console.log("❌ Signup flow test failed:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function main() {
  console.log("🔍 Production Authentication Diagnostic");
  console.log("=" .repeat(60));
  
  const results = {
    config: false,
    database: false,
    signup: false,
  };
  
  // Check configuration
  results.config = await checkNextAuthConfig();
  
  // Check database connection
  if (results.config) {
    results.database = await checkDatabaseConnection();
  } else {
    console.log("\n⚠️  Skipping database check - configuration invalid");
  }
  
  // Test signup flow
  if (results.config && results.database) {
    results.signup = await testSignupFlow();
  } else {
    console.log("\n⚠️  Skipping signup flow test - prerequisites not met");
  }
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 Summary");
  console.log("=".repeat(60));
  console.log(`Configuration: ${results.config ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Database: ${results.database ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Signup Flow: ${results.signup ? "✅ PASS" : "❌ FAIL"}`);
  
  if (results.config && results.database && results.signup) {
    console.log("\n✅ All checks passed! Authentication should work correctly.");
    process.exit(0);
  } else {
    console.log("\n❌ Some checks failed. Please fix the issues above.");
    console.log("\n📝 Next Steps:");
    if (!results.config) {
      console.log("1. Set required environment variables (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL)");
    }
    if (!results.database) {
      console.log("2. Fix database connection or run migrations");
    }
    if (!results.signup) {
      console.log("3. Check database permissions and schema");
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { checkDatabaseConnection, checkNextAuthConfig, testSignupFlow };
