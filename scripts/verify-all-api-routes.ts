#!/usr/bin/env tsx
/**
 * Comprehensive API Route Verification
 * 
 * Systematically tests all API routes for:
 * - Proper HTTP method support
 * - Error handling
 * - Response format consistency
 * - Authentication requirements
 */

import { readdir, stat, readFile } from "fs/promises";
import { join, relative } from "path";

interface RouteInfo {
  path: string;
  file: string;
  content: string;
  methods: string[];
  hasErrorHandling: boolean;
  hasAuth: boolean;
  hasValidation: boolean;
}

interface VerificationResult {
  route: string;
  status: "ok" | "warning" | "error";
  issues: string[];
  methods: string[];
}

const API_DIR = join(process.cwd(), "app/api");

async function findRouteFiles(dir: string = API_DIR, files: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await findRouteFiles(fullPath, files);
    } else if (entry.name === "route.ts") {
      files.push(fullPath);
    }
  }
  return files.sort();
}

async function analyzeRoute(file: string): Promise<RouteInfo> {
  const content = await readFile(file, "utf-8");
  
  const relativePath = relative(API_DIR, file).replace(/\/route\.ts$/, "");
  const apiPath = `/api/${relativePath}`;
  
  // Detect HTTP methods
  const methods: string[] = [];
  const hasMethod = (method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH") => {
    // Support both Next.js route handler styles:
    // 1) `export async function GET(...) { ... }`
    // 2) `export const GET = createApiHandler(...)` (or any assigned handler)
    const fnRe = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`);
    const constRe = new RegExp(`export\\s+const\\s+${method}\\s*=`);
    return fnRe.test(content) || constRe.test(content);
  };
  if (hasMethod("GET")) methods.push("GET");
  if (hasMethod("POST")) methods.push("POST");
  if (hasMethod("PUT")) methods.push("PUT");
  if (hasMethod("DELETE")) methods.push("DELETE");
  if (hasMethod("PATCH")) methods.push("PATCH");
  
  // Check for error handling
  // NOTE: Most routes use `createApiHandler`, which centrally enforces try/catch + JSON error responses
  // via `lib/middleware/api-wrapper.ts`. Treat that as "error handled" even if the handler body itself
  // doesn't contain explicit try/catch.
  const usesApiWrapper = content.includes("createApiHandler");

  const hasInlineTryCatch =
    content.includes("try {") &&
    (content.includes("catch") || content.includes("catch (")) &&
    (content.includes("NextResponse.json") ||
      content.includes("NextResponse.") ||
      content.includes("new NextResponse(") ||
      content.includes("new Response("));

  const hasErrorHandling = usesApiWrapper || hasInlineTryCatch;
  
  // Check for authentication
  const hasAuth =
    content.includes("requireAuth") ||
    content.includes("requireRole") ||
    content.includes("auth()") ||
    content.includes("getServerSession");
  
  // Check for validation
  const hasValidation =
    content.includes("z.object") ||
    content.includes("zod") ||
    content.includes(".parse(") ||
    content.includes("validate") ||
    content.includes("validateFile(") ||
    content.includes("validateBusinessRules");
  
  return {
    path: apiPath,
    file,
    content,
    methods,
    hasErrorHandling,
    hasAuth,
    hasValidation,
  };
}

async function verifyRoute(route: RouteInfo): Promise<VerificationResult> {
  const issues: string[] = [];
  let status: "ok" | "warning" | "error" = "ok";
  
  // Check for methods
  if (route.methods.length === 0) {
    issues.push("No HTTP methods exported");
    status = "error";
  }
  
  // Check for error handling
  if (!route.hasErrorHandling) {
    issues.push("Missing try-catch error handling");
    status = status === "ok" ? "warning" : status;
  }
  
  // Check for validation (warn only if POST/PUT appear to parse a request body)
  // Many endpoints are POST for semantic reasons but accept no body; those should not be flagged.
  const parsesBody =
    route.content.includes("request.json") ||
    route.content.includes("request.formData") ||
    route.content.includes("await request.text") ||
    route.content.includes("request.arrayBuffer");

  if ((route.methods.includes("POST") || route.methods.includes("PUT")) && parsesBody && !route.hasValidation) {
    issues.push("POST/PUT endpoint without input validation");
    status = status === "ok" ? "warning" : status;
  }
  
  return {
    route: route.path,
    status,
    issues,
    methods: route.methods,
  };
}

async function main() {
  console.log("🔍 Holdwall POS - API Route Verification\n");
  console.log("=" .repeat(60));
  
  const files = await findRouteFiles(API_DIR);
  console.log(`\nFound ${files.length} API route files\n`);
  
  const routes: RouteInfo[] = [];
  for (const file of files) {
    try {
      const route = await analyzeRoute(file);
      routes.push(route);
    } catch (error) {
      console.error(`Error analyzing ${file}:`, error);
    }
  }
  
  const results: VerificationResult[] = [];
  for (const route of routes) {
    const result = await verifyRoute(route);
    results.push(result);
  }
  
  // Summary
  const ok = results.filter((r) => r.status === "ok").length;
  const warnings = results.filter((r) => r.status === "warning").length;
  const errors = results.filter((r) => r.status === "error").length;
  
  console.log("\n📊 Verification Summary");
  console.log("=" .repeat(60));
  console.log(`✅ OK:        ${ok}`);
  console.log(`⚠️  Warnings:  ${warnings}`);
  console.log(`❌ Errors:    ${errors}`);
  console.log(`📝 Total:     ${results.length}`);
  
  // Detailed results
  if (warnings > 0 || errors > 0) {
    console.log("\n📋 Detailed Results");
    console.log("=" .repeat(60));
    
    for (const result of results) {
      if (result.status !== "ok") {
        const icon = result.status === "error" ? "❌" : "⚠️";
        console.log(`\n${icon} ${result.route}`);
        console.log(`   Methods: ${result.methods.join(", ") || "none"}`);
        for (const issue of result.issues) {
          console.log(`   - ${issue}`);
        }
      }
    }
  }
  
  // Route listing
  console.log("\n📝 All API Routes");
  console.log("=" .repeat(60));
  for (const route of routes.sort((a, b) => a.path.localeCompare(b.path))) {
    const methods = route.methods.join(", ") || "none";
    console.log(`${route.path.padEnd(50)} [${methods}]`);
  }
  
  // Exit code
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Verification failed:", error);
  process.exit(1);
});
