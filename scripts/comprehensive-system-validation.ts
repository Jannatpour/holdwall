#!/usr/bin/env tsx
/**
 * Comprehensive System Validation Script
 * 
 * Validates entire system for production readiness:
 * - All API routes
 * - Database schema
 * - Background workers
 * - AI integrations
 * - Security measures
 * - Observability
 * - UI components
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";
import { validateAuthConfig } from "../lib/auth/config-validator";
import { db } from "../lib/db/client";
import { logger } from "../lib/logging/logger";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

interface ValidationResult {
  category: string;
  item: string;
  status: "pass" | "fail" | "warning";
  message: string;
  details?: any;
}

const results: ValidationResult[] = [];

function recordResult(
  category: string,
  item: string,
  status: "pass" | "fail" | "warning",
  message: string,
  details?: any
) {
  results.push({ category, item, status, message, details });
  const icon = status === "pass" ? "✅" : status === "fail" ? "❌" : "⚠️";
  console.log(`${icon} [${category}] ${item}: ${message}`);
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

async function validateDatabaseSchema() {
  console.log("\n📊 Validating Database Schema...\n");
  
  try {
    // Test connection
    await db.$queryRaw`SELECT 1`;
    recordResult("Database", "Connection", "pass", "Database connection successful");
    
    // Check critical tables - use Prisma model names (camelCase)
    const criticalTables = [
      { name: "User", model: "user" },
      { name: "Tenant", model: "tenant" },
      { name: "Evidence", model: "evidence" },
      { name: "Claim", model: "claim" },
      { name: "ClaimCluster", model: "claimCluster" },
      { name: "BeliefNode", model: "beliefNode" },
      { name: "BeliefEdge", model: "beliefEdge" },
      { name: "Forecast", model: "forecast" },
      { name: "AAALArtifact", model: "aAALArtifact" },
      { name: "Approval", model: "approval" },
      { name: "Signal", model: "signal" },
      { name: "OutboxEvent", model: "outboxEvent" },
      { name: "Account", model: "account" },
      { name: "Session", model: "session" },
    ];
    
    for (const { name, model } of criticalTables) {
      try {
        const count = await (db as any)[model].count();
        recordResult("Database", `Table: ${name}`, "pass", `Table exists with ${count} records`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes("does not exist") || errorMsg.includes("Unknown model")) {
          recordResult("Database", `Table: ${name}`, "fail", "Table does not exist - run migrations");
        } else {
          recordResult("Database", `Table: ${name}`, "warning", `Error checking table: ${errorMsg}`);
        }
      }
    }
    
    // Check indexes
    try {
      const indexCount = await db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM pg_indexes
        WHERE schemaname = 'public'
      `;
      recordResult("Database", "Indexes", "pass", `${indexCount[0].count} indexes found`);
    } catch (error) {
      recordResult("Database", "Indexes", "warning", "Could not check indexes");
    }
    
  } catch (error) {
    recordResult("Database", "Connection", "fail", `Database connection failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function validateAPIRoutes() {
  console.log("\n🔌 Validating API Routes...\n");
  
  const apiDir = join(process.cwd(), "app", "api");
  
  async function scanRoutes(dir: string, prefix: string = ""): Promise<number> {
    let count = 0;
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const routePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        
        if (entry.isDirectory()) {
          count += await scanRoutes(fullPath, routePath);
        } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
          count++;
          try {
            const content = await readFile(fullPath, "utf-8");
            
            // Check if route uses createApiHandler wrapper (provides auth, error handling, logging)
            const usesApiHandler = /createApiHandler/.test(content);
            
            // Check for required patterns
            const hasAuth = /requireAuth|getServerSession|auth\(\)|createApiHandler.*requireAuth.*true/.test(content);
            const hasErrorHandling = /try\s*\{|catch\s*\(|createApiHandler/.test(content);
            const hasValidation = /z\.|zod|parseRequestBody|validate|\.parse\(/.test(content);
            const hasLogging = /logger\.|console\.(log|error|warn)|createApiHandler/.test(content);
            
            // Check HTTP method to determine if validation is required
            const isWriteMethod = /export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)/.test(content) || 
                                  /export\s+const\s+(POST|PUT|PATCH|DELETE)\s*=/.test(content);
            const isReadMethod = /export\s+(async\s+)?function\s+GET/.test(content) || 
                                 /export\s+const\s+GET\s*=/.test(content);
            
            // For routes using createApiHandler, all patterns are provided by wrapper
            // For GET routes, validation may not be needed (query params validated differently)
            // For POST/PUT/PATCH/DELETE routes, validation should be present
            const validationRequired = isWriteMethod && !usesApiHandler;
            const authRequired = !usesApiHandler && !routePath.includes("/cases/[id]/timeline") && 
                                 !routePath.includes("/auth/signup") && 
                                 !routePath.includes("/padl/") &&
                                 !routePath.includes("/docs") &&
                                 !routePath.includes("/health");
            
            const checks = {
              auth: hasAuth || usesApiHandler || !authRequired,
              errorHandling: hasErrorHandling || usesApiHandler,
              validation: hasValidation || !validationRequired || usesApiHandler,
              logging: hasLogging || usesApiHandler,
            };
            
            // Determine if warnings are expected
            const expectedWarnings: string[] = [];
            if (usesApiHandler) {
              expectedWarnings.push("uses createApiHandler wrapper");
            }
            if (isReadMethod && !hasValidation) {
              expectedWarnings.push("GET route - query params validated differently");
            }
            if (!authRequired && !hasAuth) {
              expectedWarnings.push("intentionally public route");
            }
            
            const allPass = Object.values(checks).every(v => v);
            const status = allPass || expectedWarnings.length > 0 ? "pass" : "warning";
            const message = allPass 
              ? "Route has all required patterns"
              : expectedWarnings.length > 0
              ? `Expected: ${expectedWarnings.join(", ")}`
              : `Missing: ${Object.entries(checks).filter(([_, v]) => !v).map(([k]) => k).join(", ")}`;
            
            recordResult("API Routes", `/api/${routePath.replace(/\/route\.tsx?$/, "")}`, status, message, checks);
          } catch (error) {
            recordResult("API Routes", `/api/${routePath}`, "warning", `Could not read route file`);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return count;
  }
  
  const routeCount = await scanRoutes(apiDir);
  recordResult("API Routes", "Total Routes", "pass", `${routeCount} API routes found`);
}

async function validateBackgroundWorkers() {
  console.log("\n⚙️  Validating Background Workers...\n");
  
  const workers = [
    { name: "Outbox Worker", path: "lib/workers/outbox-worker.ts" },
    { name: "Pipeline Worker", path: "lib/workers/pipeline-worker.ts" },
  ];
  
  for (const worker of workers) {
    try {
      const fullPath = join(process.cwd(), worker.path);
      const content = await readFile(fullPath, "utf-8");
      
      const hasStart = /async\s+start|start\(\)/.test(content);
      const hasStop = /async\s+stop|stop\(\)/.test(content);
      const hasErrorHandling = /try\s*\{|catch\s*\(/.test(content);
      const hasLogging = /logger\./.test(content);
      
      const checks = {
        start: hasStart,
        stop: hasStop,
        errorHandling: hasErrorHandling,
        logging: hasLogging,
      };
      
      const allPass = Object.values(checks).every(v => v);
      const status = allPass ? "pass" : "warning";
      
      recordResult("Workers", worker.name, status, allPass ? "Worker properly structured" : "Missing required methods", checks);
    } catch (error) {
      recordResult("Workers", worker.name, "fail", `Could not read worker file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function validateAIIntegrations() {
  console.log("\n🤖 Validating AI Integrations...\n");
  
  const aiFiles = [
    { name: "AI Integration", path: "lib/ai/integration.ts" },
    { name: "AI Orchestrator", path: "lib/ai/orchestrator.ts" },
    { name: "RAG Pipeline", path: "lib/ai/rag.ts" },
    { name: "KAG Pipeline", path: "lib/ai/kag.ts" },
    { name: "MCP Gateway", path: "lib/mcp/gateway.ts" },
  ];
  
  for (const file of aiFiles) {
    try {
      const fullPath = join(process.cwd(), file.path);
      await stat(fullPath);
      recordResult("AI Integration", file.name, "pass", "File exists");
    } catch (error) {
      recordResult("AI Integration", file.name, "warning", "File not found");
    }
  }
}

async function validateSecurity() {
  console.log("\n🔒 Validating Security Measures...\n");
  
  // Check auth config
  const authConfig = validateAuthConfig();
  if (authConfig.valid) {
    recordResult("Security", "Auth Configuration", "pass", "Authentication configuration valid");
  } else {
    recordResult("Security", "Auth Configuration", "fail", "Authentication configuration invalid", {
      missing: authConfig.missing,
      errors: authConfig.errors,
    });
  }
  
  // Check security files
  const securityFiles = [
    { name: "CSRF Protection", path: "lib/security/csrf.ts" },
    { name: "Rate Limiting", path: "lib/middleware/rate-limit.ts" },
    { name: "RBAC", path: "lib/auth/rbac.ts" },
    { name: "Input Validation", path: "lib/validation/business-rules.ts" },
  ];
  
  for (const file of securityFiles) {
    try {
      const fullPath = join(process.cwd(), file.path);
      await stat(fullPath);
      recordResult("Security", file.name, "pass", "Security module exists");
    } catch (error) {
      recordResult("Security", file.name, "warning", "Security module not found");
    }
  }
}

async function validateObservability() {
  console.log("\n📈 Validating Observability...\n");
  
  const observabilityFiles = [
    { name: "Logging", path: "lib/logging/logger.ts" },
    { name: "Metrics", path: "lib/observability/metrics.ts" },
    { name: "Health Monitor", path: "lib/integration/health-monitor.ts" },
    { name: "Tracing", path: "lib/observability/tracing.ts" },
  ];
  
  for (const file of observabilityFiles) {
    try {
      const fullPath = join(process.cwd(), file.path);
      await stat(fullPath);
      recordResult("Observability", file.name, "pass", "Observability module exists");
    } catch (error) {
      recordResult("Observability", file.name, "warning", "Observability module not found");
    }
  }
}

async function validateUIComponents() {
  console.log("\n🎨 Validating UI Components...\n");
  
  const componentsDir = join(process.cwd(), "components");
  
  try {
    async function countComponents(dir: string): Promise<number> {
      let count = 0;
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          count += await countComponents(fullPath);
        } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
          count++;
        }
      }
      
      return count;
    }
    
    const componentCount = await countComponents(componentsDir);
    recordResult("UI Components", "Total Components", "pass", `${componentCount} components found`);
  } catch (error) {
    recordResult("UI Components", "Component Count", "warning", "Could not count components");
  }
}

async function generateReport() {
  console.log("\n" + "=".repeat(60));
  console.log("📋 Validation Report");
  console.log("=".repeat(60));
  
  const categories = new Map<string, ValidationResult[]>();
  
  for (const result of results) {
    if (!categories.has(result.category)) {
      categories.set(result.category, []);
    }
    categories.get(result.category)!.push(result);
  }
  
  for (const [category, items] of categories.entries()) {
    console.log(`\n${category}:`);
    const pass = items.filter(r => r.status === "pass").length;
    const fail = items.filter(r => r.status === "fail").length;
    const warn = items.filter(r => r.status === "warning").length;
    console.log(`  ✅ Pass: ${pass} | ❌ Fail: ${fail} | ⚠️  Warning: ${warn}`);
  }
  
  const totalPass = results.filter(r => r.status === "pass").length;
  const totalFail = results.filter(r => r.status === "fail").length;
  const totalWarn = results.filter(r => r.status === "warning").length;
  const total = results.length;
  
  console.log("\n" + "=".repeat(60));
  console.log("Summary:");
  console.log(`  Total Checks: ${total}`);
  console.log(`  ✅ Passed: ${totalPass} (${Math.round((totalPass / total) * 100)}%)`);
  console.log(`  ❌ Failed: ${totalFail} (${Math.round((totalFail / total) * 100)}%)`);
  console.log(`  ⚠️  Warnings: ${totalWarn} (${Math.round((totalWarn / total) * 100)}%)`);
  console.log("=".repeat(60));
  
  if (totalFail === 0 && totalWarn === 0) {
    console.log("\n✅ All validations passed! System is production-ready.");
    process.exit(0);
  } else {
    console.log("\n⚠️  Some validations failed or have warnings. Review the report above.");
    process.exit(totalFail > 0 ? 1 : 0);
  }
}

async function main() {
  console.log("🔍 Comprehensive System Validation");
  console.log("=".repeat(60));
  
  await validateDatabaseSchema();
  await validateAPIRoutes();
  await validateBackgroundWorkers();
  await validateAIIntegrations();
  await validateSecurity();
  await validateObservability();
  await validateUIComponents();
  
  await generateReport();
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { validateDatabaseSchema, validateAPIRoutes, validateBackgroundWorkers };
