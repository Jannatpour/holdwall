/**
 * CI/CD Quality Gates API
 * 
 * Check quality gates and performance/reliability budgets
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { QualityGatesService, DEFAULT_PERFORMANCE_BUDGET, DEFAULT_RELIABILITY_BUDGET } from "@/lib/ci/quality-gates";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const checkGatesSchema = z.object({
  build_time_seconds: z.number().optional(),
  test_execution_time_seconds: z.number().optional(),
  e2e_test_time_seconds: z.number().optional(),
  api_response_time_p95_ms: z.number().optional(),
  page_load_time_p95_ms: z.number().optional(),
  error_rate_percentage: z.number().optional(),
  uptime_percentage: z.number().optional(),
  test_pass_rate_percentage: z.number().optional(),
  test_coverage_percentage: z.number().optional(),
});

const service = new QualityGatesService();

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN"); // Only admins can check quality gates
    const body = await request.json();
    const validated = checkGatesSchema.parse(body);

    const result = service.runAllGates(validated);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Failed to check quality gates", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    
    return NextResponse.json({
      description: "CI/CD Quality Gates - Performance and Reliability Budget Tracking",
      budgets: {
        performance: DEFAULT_PERFORMANCE_BUDGET,
        reliability: DEFAULT_RELIABILITY_BUDGET,
      },
      usage: {
        method: "POST",
        endpoint: "/api/ci/quality-gates",
        body: {
          build_time_seconds: "optional - actual build time",
          test_execution_time_seconds: "optional - actual test execution time",
          e2e_test_time_seconds: "optional - actual E2E test time",
          api_response_time_p95_ms: "optional - p95 API response time",
          page_load_time_p95_ms: "optional - p95 page load time",
          error_rate_percentage: "optional - error rate percentage",
          uptime_percentage: "optional - uptime percentage",
          test_pass_rate_percentage: "optional - test pass rate percentage",
          test_coverage_percentage: "optional - test coverage percentage",
        },
      },
      gates: [
        "Build Time",
        "Test Execution Time",
        "E2E Test Time",
        "API Response Time (p95)",
        "Page Load Time (p95)",
        "Error Rate",
        "Uptime",
        "Test Pass Rate",
        "Test Coverage",
      ],
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
