/**
 * API Route Verification System
 * 
 * Verifies all API routes have proper structure, error handling, and validation
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { logger } from "@/lib/logging/logger";

export interface APIRouteVerification {
  route: string;
  file: string;
  hasMethod: boolean;
  hasErrorHandling: boolean;
  hasAuth: boolean;
  hasValidation: boolean;
  status: "pass" | "fail" | "warning";
  issues: string[];
}

/**
 * Verify API route structure
 */
export async function verifyAPIRoute(
  routePath: string,
  methods: ("GET" | "POST" | "PUT" | "DELETE")[] = ["GET"]
): Promise<APIRouteVerification> {
  const issues: string[] = [];
  let hasMethod = false;
  let hasErrorHandling = false;
  let hasAuth = false;
  let hasValidation = false;

  try {
    // Construct file path
    const routeFile = join(process.cwd(), "app", "api", `${routePath}/route.ts`);
    
    let content: string;
    try {
      content = await readFile(routeFile, "utf-8");
    } catch (error) {
      return {
        route: routePath,
        file: routeFile,
        hasMethod: false,
        hasErrorHandling: false,
        hasAuth: false,
        hasValidation: false,
        status: "fail",
        issues: [`File not found: ${routeFile}`],
      };
    }

    // Check for required methods
    for (const method of methods) {
      if (content.includes(`export async function ${method}`)) {
        hasMethod = true;
        break;
      }
    }

    if (!hasMethod) {
      issues.push(`Missing required HTTP method(s): ${methods.join(", ")}`);
    }

    // Check for error handling
    if (content.includes("try {") && content.includes("catch")) {
      hasErrorHandling = true;
    } else {
      issues.push("Missing error handling (try/catch)");
    }

    // Check for authentication
    if (content.includes("requireAuth") || 
        content.includes("getServerSession") ||
        content.includes("auth()") ||
        routePath.includes("health") || // Health check doesn't need auth
        routePath.includes("openapi") || // OpenAPI doesn't need auth
        routePath.includes("docs")) { // Docs don't need auth
      hasAuth = true;
    } else {
      issues.push("Missing authentication check");
    }

    // Check for input validation
    if (content.includes("z.object") || 
        content.includes("zod") ||
        content.includes("parse(") ||
        content.includes("validate(") ||
        content.includes("schema.parse")) {
      hasValidation = true;
    } else if (methods.includes("POST") || methods.includes("PUT")) {
      // POST/PUT should have validation
      issues.push("Missing input validation (Zod schema)");
    }

    // Determine status
    let status: "pass" | "fail" | "warning" = "pass";
    if (!hasMethod || !hasErrorHandling) {
      status = "fail";
    } else if (!hasAuth && !routePath.includes("health") && !routePath.includes("openapi") && !routePath.includes("docs")) {
      status = "warning";
    } else if (!hasValidation && (methods.includes("POST") || methods.includes("PUT"))) {
      status = "warning";
    }

    return {
      route: routePath,
      file: routeFile,
      hasMethod,
      hasErrorHandling,
      hasAuth,
      hasValidation,
      status,
      issues,
    };
  } catch (error) {
    logger.error("Error verifying API route", {
      route: routePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      route: routePath,
      file: "",
      hasMethod: false,
      hasErrorHandling: false,
      hasAuth: false,
      hasValidation: false,
      status: "fail",
      issues: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Verify all API routes
 */
export async function verifyAllAPIRoutes(): Promise<APIRouteVerification[]> {
  // List of all API routes to verify
  const routes: Array<{ path: string; methods: ("GET" | "POST" | "PUT" | "DELETE")[] }> = [
    // Core routes
    { path: "signals", methods: ["GET", "POST"] },
    { path: "claims", methods: ["GET", "POST"] },
    { path: "aaal", methods: ["GET", "POST", "PUT"] },
    { path: "forecasts", methods: ["GET", "POST"] },
    { path: "playbooks", methods: ["GET", "POST"] },
    { path: "evidence", methods: ["GET", "POST"] },
    { path: "graph", methods: ["GET", "POST"] },
    { path: "overview", methods: ["GET"] },
    
    // Auth routes
    { path: "auth/signup", methods: ["POST"] },
    
    // Integration routes
    { path: "integrations", methods: ["GET"] },
    { path: "integrations/connectors", methods: ["GET", "POST"] },
    
    // Governance routes
    { path: "governance/audit-bundle", methods: ["POST"] },
    { path: "governance/autopilot", methods: ["GET", "POST"] },
    
    // AI routes
    { path: "ai/orchestrate", methods: ["POST"] },
    { path: "ai/semantic-search", methods: ["POST"] },
    
    // Health check
    { path: "health", methods: ["GET"] },
  ];

  const results: APIRouteVerification[] = [];
  
  for (const route of routes) {
    const result = await verifyAPIRoute(route.path, route.methods);
    results.push(result);
  }

  return results;
}

/**
 * Generate verification report
 */
export function generateAPIVerificationReport(
  verifications: APIRouteVerification[]
): string {
  const report: string[] = [];
  
  report.push("# API Route Verification Report\n");
  report.push(`Generated: ${new Date().toISOString()}\n`);
  report.push(`Total Routes Verified: ${verifications.length}\n`);

  const passed = verifications.filter(v => v.status === "pass").length;
  const failed = verifications.filter(v => v.status === "fail").length;
  const warnings = verifications.filter(v => v.status === "warning").length;

  report.push(`\n## Summary\n`);
  report.push(`- ✅ Passed: ${passed}`);
  report.push(`- ❌ Failed: ${failed}`);
  report.push(`- ⚠️  Warnings: ${warnings}\n`);

  // Group by status
  const failedRoutes = verifications.filter(v => v.status === "fail");
  const warningRoutes = verifications.filter(v => v.status === "warning");
  const passedRoutes = verifications.filter(v => v.status === "pass");

  if (failedRoutes.length > 0) {
    report.push(`\n## ❌ Failed Routes (${failedRoutes.length})\n`);
    for (const route of failedRoutes) {
      report.push(`### ${route.route}`);
      report.push(`- File: ${route.file}`);
      report.push(`- Issues:`);
      for (const issue of route.issues) {
        report.push(`  - ${issue}`);
      }
      report.push("");
    }
  }

  if (warningRoutes.length > 0) {
    report.push(`\n## ⚠️  Warning Routes (${warningRoutes.length})\n`);
    for (const route of warningRoutes) {
      report.push(`### ${route.route}`);
      report.push(`- Issues:`);
      for (const issue of route.issues) {
        report.push(`  - ${issue}`);
      }
      report.push("");
    }
  }

  if (passedRoutes.length > 0) {
    report.push(`\n## ✅ Passed Routes (${passedRoutes.length})\n`);
    report.push(passedRoutes.map(r => `- ${r.route}`).join("\n"));
  }

  return report.join("\n");
}
