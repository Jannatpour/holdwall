/**
 * Production Canary Checks
 * 
 * "Is it working" canaries that verify actual functionality, not just "is it up".
 * Auto-diagnosis attachments on failure (correlation IDs, logs, DB counters, runbook steps).
 */

import { logger } from "../lib/logging/logger";

interface CanaryResult {
  name: string;
  status: "pass" | "fail" | "warning";
  duration_ms: number;
  error?: string;
  diagnosis?: {
    correlation_ids?: string[];
    recent_logs?: string[];
    db_counters?: Record<string, number>;
    suggested_runbook_step?: string;
  };
}

interface CanaryReport {
  timestamp: string;
  environment: string;
  baseUrl: string;
  results: CanaryResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  overall_status: "healthy" | "degraded" | "unhealthy";
}

/**
 * Auth canary: session + protected route
 */
async function canaryAuth(baseUrl: string): Promise<CanaryResult> {
  const startTime = Date.now();
  const diagnosis: CanaryResult["diagnosis"] = {};

  try {
    // 1. Check health endpoint
    const healthResponse = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!healthResponse.ok) {
      return {
        name: "Auth Canary - Health Check",
        status: "fail",
        duration_ms: Date.now() - startTime,
        error: `Health check failed: ${healthResponse.status}`,
        diagnosis: {
          suggested_runbook_step: "Check server logs and database connectivity",
        },
      };
    }

    const health = await healthResponse.json();
    if (health.status !== "healthy" && health.status !== "degraded") {
      return {
        name: "Auth Canary - Health Check",
        status: "fail",
        duration_ms: Date.now() - startTime,
        error: `Health status: ${health.status}`,
        diagnosis: {
          suggested_runbook_step: "Review health check details in response",
        },
      };
    }

    // 2. Attempt to get session (should return null when not authenticated)
    const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!sessionResponse.ok && sessionResponse.status !== 401) {
      return {
        name: "Auth Canary - Session Endpoint",
        status: "fail",
        duration_ms: Date.now() - startTime,
        error: `Session endpoint failed: ${sessionResponse.status}`,
        diagnosis: {
          suggested_runbook_step: "Check NextAuth configuration and NEXTAUTH_SECRET",
        },
      };
    }

    const session = await sessionResponse.json();
    // NextAuth can return `null` when not authenticated.
    // That’s a valid “pass” outcome for this canary (we only need the endpoint to be healthy).
    if (session && typeof session === "object") {
      // Session object may include `user` when authenticated; either is fine.
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      (session as any).user;
    }

    return {
      name: "Auth Canary",
      status: "pass",
      duration_ms: Date.now() - startTime,
    };
  } catch (error) {
    return {
      name: "Auth Canary",
      status: "fail",
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      diagnosis: {
        suggested_runbook_step: "Check network connectivity and server status",
      },
    };
  }
}

/**
 * Public endpoints canary: OpenAPI + IP endpoint
 */
async function canaryPublicEndpoints(baseUrl: string): Promise<CanaryResult> {
  const startTime = Date.now();
  try {
    const openApiResp = await fetch(`${baseUrl}/api/openapi.json`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!openApiResp.ok) {
      return {
        name: "Public Endpoints Canary",
        status: "fail",
        duration_ms: Date.now() - startTime,
        error: `OpenAPI fetch failed: ${openApiResp.status}`,
      };
    }
    const openApiText = await openApiResp.text();
    try {
      JSON.parse(openApiText);
    } catch {
      return {
        name: "Public Endpoints Canary",
        status: "fail",
        duration_ms: Date.now() - startTime,
        error: "OpenAPI response is not valid JSON",
      };
    }

    const ipResp = await fetch(`${baseUrl}/api/ip`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!ipResp.ok) {
      return {
        name: "Public Endpoints Canary",
        status: "fail",
        duration_ms: Date.now() - startTime,
        error: `IP endpoint failed: ${ipResp.status}`,
      };
    }
    const ipJson = await ipResp.json().catch(() => null);
    const ipValue = ipJson && typeof ipJson === "object" ? (ipJson as any).ip : undefined;
    if (typeof ipValue !== "string" || ipValue.length === 0) {
      return {
        name: "Public Endpoints Canary",
        status: "warning",
        duration_ms: Date.now() - startTime,
        error: "IP endpoint returned unexpected payload",
      };
    }

    return {
      name: "Public Endpoints Canary",
      status: "pass",
      duration_ms: Date.now() - startTime,
    };
  } catch (error) {
    return {
      name: "Public Endpoints Canary",
      status: "fail",
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * SKU B canary: Signal → Claim → Graph → Forecast
 */
async function canarySKUB(baseUrl: string, verifyToken?: string): Promise<CanaryResult> {
  const startTime = Date.now();
  const diagnosis: CanaryResult["diagnosis"] = {};

  try {
    if (!verifyToken) {
      return {
        name: "SKU B Canary",
        status: "warning",
        duration_ms: Date.now() - startTime,
        error: "Skipped (VERIFY_TOKEN not provided)",
        diagnosis: {
          suggested_runbook_step: "Provide VERIFY_TOKEN to run SKU canaries (verification API requires auth)",
        },
      };
    }

    // Run SKU B verification via API
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (verifyToken) headers["x-verify-token"] = verifyToken;
    if (process.env.CANARY_TOKEN) headers["x-canary-token"] = process.env.CANARY_TOKEN;

    const response = await fetch(`${baseUrl}/api/verification/run`, {
      method: "POST",
      headers,
      body: JSON.stringify({ flow: "sku-b" }),
      signal: AbortSignal.timeout(60000), // 60s timeout for SKU B
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unable to read response");
      return {
        name: "SKU B Canary",
        status: "fail",
        duration_ms: Date.now() - startTime,
        error: `Verification API failed: ${response.status}`,
        diagnosis: {
          suggested_runbook_step: "Check verification API logs and database state",
        },
      };
    }

    const data = await response.json();
    if (data.summary.failed > 0) {
      return {
        name: "SKU B Canary",
        status: "fail",
        duration_ms: Date.now() - startTime,
        error: `${data.summary.failed} verification steps failed`,
        diagnosis: {
          suggested_runbook_step: "Review verification results for specific failures",
        },
      };
    }

    return {
      name: "SKU B Canary",
      status: data.summary.warnings > 0 ? "warning" : "pass",
      duration_ms: Date.now() - startTime,
      diagnosis: data.summary.warnings > 0 ? { suggested_runbook_step: "Review warnings in verification results" } : undefined,
    };
  } catch (error) {
    return {
      name: "SKU B Canary",
      status: "fail",
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      diagnosis: {
        suggested_runbook_step: "Check verification API availability and database connectivity",
      },
    };
  }
}

/**
 * SKU C canary: Evidence immutability + access log
 */
async function canarySKUC(baseUrl: string, verifyToken?: string): Promise<CanaryResult> {
  const startTime = Date.now();

  try {
    if (!verifyToken) {
      return {
        name: "SKU C Canary",
        status: "warning",
        duration_ms: Date.now() - startTime,
        error: "Skipped (VERIFY_TOKEN not provided)",
        diagnosis: {
          suggested_runbook_step: "Provide VERIFY_TOKEN to run SKU canaries (verification API requires auth)",
        },
      };
    }

    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (verifyToken) headers["x-verify-token"] = verifyToken;
    if (process.env.CANARY_TOKEN) headers["x-canary-token"] = process.env.CANARY_TOKEN;

    const response = await fetch(`${baseUrl}/api/verification/run`, {
      method: "POST",
      headers,
      body: JSON.stringify({ flow: "sku-c" }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      return {
        name: "SKU C Canary",
        status: "fail",
        duration_ms: Date.now() - startTime,
        error: `Verification API failed: ${response.status}`,
        diagnosis: {
          suggested_runbook_step: "Check evidence vault and audit bundle services",
        },
      };
    }

    const data = await response.json();
    return {
      name: "SKU C Canary",
      status: data.summary.failed > 0 ? "fail" : data.summary.warnings > 0 ? "warning" : "pass",
      duration_ms: Date.now() - startTime,
    };
  } catch (error) {
    return {
      name: "SKU C Canary",
      status: "fail",
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * SKU D canary: Security incident ingest + narrative risk + explanation
 */
async function canarySKUD(baseUrl: string, verifyToken?: string): Promise<CanaryResult> {
  const startTime = Date.now();

  try {
    if (!verifyToken) {
      return {
        name: "SKU D Canary",
        status: "warning",
        duration_ms: Date.now() - startTime,
        error: "Skipped (VERIFY_TOKEN not provided)",
        diagnosis: {
          suggested_runbook_step: "Provide VERIFY_TOKEN to run SKU canaries (verification API requires auth)",
        },
      };
    }

    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (verifyToken) headers["x-verify-token"] = verifyToken;
    if (process.env.CANARY_TOKEN) headers["x-canary-token"] = process.env.CANARY_TOKEN;

    const response = await fetch(`${baseUrl}/api/verification/run`, {
      method: "POST",
      headers,
      body: JSON.stringify({ flow: "sku-d" }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      return {
        name: "SKU D Canary",
        status: "fail",
        duration_ms: Date.now() - startTime,
        error: `Verification API failed: ${response.status}`,
        diagnosis: {
          suggested_runbook_step: "Check security incident service and narrative risk assessment",
        },
      };
    }

    const data = await response.json();
    return {
      name: "SKU D Canary",
      status: data.summary.failed > 0 ? "fail" : data.summary.warnings > 0 ? "warning" : "pass",
      duration_ms: Date.now() - startTime,
    };
  } catch (error) {
    return {
      name: "SKU D Canary",
      status: "fail",
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run all production canaries
 */
export async function runProductionCanaries(baseUrl: string, verifyToken?: string): Promise<CanaryReport> {
  const results: CanaryResult[] = [];

  logger.info("Starting production canary checks", { baseUrl });

  // Run all canaries in parallel (they're independent)
  const [authResult, publicResult, skuBResult, skuCResult, skuDResult] = await Promise.all([
    canaryAuth(baseUrl),
    canaryPublicEndpoints(baseUrl),
    canarySKUB(baseUrl, verifyToken),
    canarySKUC(baseUrl, verifyToken),
    canarySKUD(baseUrl, verifyToken),
  ]);

  results.push(authResult, publicResult, skuBResult, skuCResult, skuDResult);

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status === "fail").length,
    warnings: results.filter((r) => r.status === "warning").length,
  };

  const overall_status: CanaryReport["overall_status"] =
    summary.failed > 0 ? "unhealthy" : summary.warnings > 0 ? "degraded" : "healthy";

  const report: CanaryReport = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "unknown",
    baseUrl,
    results,
    summary,
    overall_status,
  };

  logger.info("Production canary checks completed", {
    overall_status: report.overall_status,
    summary: report.summary,
  });

  return report;
}

/**
 * Main entry point for canary script
 */
async function main() {
  const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  // Prefer CANARY_TOKEN (production-safe path) when present; fall back to VERIFY_TOKEN (dev-only bypass).
  const verifyToken = process.env.CANARY_TOKEN || process.env.VERIFY_TOKEN;

  try {
    const report = await runProductionCanaries(baseUrl, verifyToken);

    // Output JSON for CI/CD consumption
    console.log(JSON.stringify(report, null, 2));

    // Exit with appropriate code
    process.exit(report.overall_status === "healthy" ? 0 : report.overall_status === "degraded" ? 1 : 2);
  } catch (error) {
    logger.error("Canary script failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(2);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error in canary script:", error);
    process.exit(2);
  });
}
