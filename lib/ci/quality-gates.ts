/**
 * CI/CD Quality Gates
 * 
 * Tracks performance and reliability budgets for CI/CD quality gates:
 * - Build time budgets
 * - Test execution time budgets
 * - Performance regression budgets
 * - Reliability budgets (error rates, uptime)
 */

import { logger } from "@/lib/logging/logger";
import { metrics as obsMetrics } from "@/lib/observability/metrics";

export interface QualityGateBudget {
  gate_name: string;
  metric: string;
  threshold: number;
  unit: "seconds" | "milliseconds" | "percentage" | "count";
  current_value?: number;
  status: "pass" | "fail" | "warning";
}

export interface QualityGateResult {
  overall_status: "pass" | "fail" | "warning";
  gates: QualityGateBudget[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  timestamp: string;
}

export interface PerformanceBudget {
  build_time_max_seconds: number; // Default: 300 (5 minutes)
  test_execution_time_max_seconds: number; // Default: 600 (10 minutes)
  e2e_test_time_max_seconds: number; // Default: 900 (15 minutes)
  api_response_time_p95_ms: number; // Default: 1000 (1 second)
  page_load_time_p95_ms: number; // Default: 3000 (3 seconds)
}

export interface ReliabilityBudget {
  error_rate_max_percentage: number; // Default: 0.1% (0.001)
  uptime_min_percentage: number; // Default: 99.9% (0.999)
  test_pass_rate_min_percentage: number; // Default: 95% (0.95)
  coverage_min_percentage: number; // Default: 80% (0.80)
}

export const DEFAULT_PERFORMANCE_BUDGET: PerformanceBudget = {
  build_time_max_seconds: 300, // 5 minutes
  test_execution_time_max_seconds: 600, // 10 minutes
  e2e_test_time_max_seconds: 900, // 15 minutes
  api_response_time_p95_ms: 1000, // 1 second
  page_load_time_p95_ms: 3000, // 3 seconds
};

export const DEFAULT_RELIABILITY_BUDGET: ReliabilityBudget = {
  error_rate_max_percentage: 0.1, // 0.1%
  uptime_min_percentage: 99.9, // 99.9%
  test_pass_rate_min_percentage: 95, // 95%
  coverage_min_percentage: 80, // 80%
};

export class QualityGatesService {
  private performanceBudget: PerformanceBudget;
  private reliabilityBudget: ReliabilityBudget;

  constructor(
    performanceBudget?: Partial<PerformanceBudget>,
    reliabilityBudget?: Partial<ReliabilityBudget>
  ) {
    this.performanceBudget = { ...DEFAULT_PERFORMANCE_BUDGET, ...performanceBudget };
    this.reliabilityBudget = { ...DEFAULT_RELIABILITY_BUDGET, ...reliabilityBudget };
  }

  /**
   * Check build time budget
   */
  checkBuildTime(actualSeconds: number): QualityGateBudget {
    const threshold = this.performanceBudget.build_time_max_seconds;
    const status = actualSeconds <= threshold ? "pass" : actualSeconds <= threshold * 1.2 ? "warning" : "fail";

    return {
      gate_name: "Build Time",
      metric: "build_time_seconds",
      threshold,
      unit: "seconds",
      current_value: actualSeconds,
      status,
    };
  }

  /**
   * Check test execution time budget
   */
  checkTestExecutionTime(actualSeconds: number): QualityGateBudget {
    const threshold = this.performanceBudget.test_execution_time_max_seconds;
    const status = actualSeconds <= threshold ? "pass" : actualSeconds <= threshold * 1.2 ? "warning" : "fail";

    return {
      gate_name: "Test Execution Time",
      metric: "test_execution_time_seconds",
      threshold,
      unit: "seconds",
      current_value: actualSeconds,
      status,
    };
  }

  /**
   * Check E2E test time budget
   */
  checkE2ETestTime(actualSeconds: number): QualityGateBudget {
    const threshold = this.performanceBudget.e2e_test_time_max_seconds;
    const status = actualSeconds <= threshold ? "pass" : actualSeconds <= threshold * 1.2 ? "warning" : "fail";

    return {
      gate_name: "E2E Test Time",
      metric: "e2e_test_time_seconds",
      threshold,
      unit: "seconds",
      current_value: actualSeconds,
      status,
    };
  }

  /**
   * Check API response time budget
   */
  checkAPIResponseTime(p95Ms: number): QualityGateBudget {
    const threshold = this.performanceBudget.api_response_time_p95_ms;
    const status = p95Ms <= threshold ? "pass" : p95Ms <= threshold * 1.5 ? "warning" : "fail";

    return {
      gate_name: "API Response Time (p95)",
      metric: "api_response_time_p95_ms",
      threshold,
      unit: "milliseconds",
      current_value: p95Ms,
      status,
    };
  }

  /**
   * Check page load time budget
   */
  checkPageLoadTime(p95Ms: number): QualityGateBudget {
    const threshold = this.performanceBudget.page_load_time_p95_ms;
    const status = p95Ms <= threshold ? "pass" : p95Ms <= threshold * 1.5 ? "warning" : "fail";

    return {
      gate_name: "Page Load Time (p95)",
      metric: "page_load_time_p95_ms",
      threshold,
      unit: "milliseconds",
      current_value: p95Ms,
      status,
    };
  }

  /**
   * Check error rate budget
   */
  checkErrorRate(actualPercentage: number): QualityGateBudget {
    const threshold = this.reliabilityBudget.error_rate_max_percentage;
    const status = actualPercentage <= threshold ? "pass" : actualPercentage <= threshold * 2 ? "warning" : "fail";

    return {
      gate_name: "Error Rate",
      metric: "error_rate_percentage",
      threshold,
      unit: "percentage",
      current_value: actualPercentage,
      status,
    };
  }

  /**
   * Check uptime budget
   */
  checkUptime(actualPercentage: number): QualityGateBudget {
    const threshold = this.reliabilityBudget.uptime_min_percentage;
    const status = actualPercentage >= threshold ? "pass" : actualPercentage >= threshold * 0.99 ? "warning" : "fail";

    return {
      gate_name: "Uptime",
      metric: "uptime_percentage",
      threshold,
      unit: "percentage",
      current_value: actualPercentage,
      status,
    };
  }

  /**
   * Check test pass rate budget
   */
  checkTestPassRate(actualPercentage: number): QualityGateBudget {
    const threshold = this.reliabilityBudget.test_pass_rate_min_percentage;
    const status = actualPercentage >= threshold ? "pass" : actualPercentage >= threshold * 0.95 ? "warning" : "fail";

    return {
      gate_name: "Test Pass Rate",
      metric: "test_pass_rate_percentage",
      threshold,
      unit: "percentage",
      current_value: actualPercentage,
      status,
    };
  }

  /**
   * Check test coverage budget
   */
  checkTestCoverage(actualPercentage: number): QualityGateBudget {
    const threshold = this.reliabilityBudget.coverage_min_percentage;
    const status = actualPercentage >= threshold ? "pass" : actualPercentage >= threshold * 0.9 ? "warning" : "fail";

    return {
      gate_name: "Test Coverage",
      metric: "test_coverage_percentage",
      threshold,
      unit: "percentage",
      current_value: actualPercentage,
      status,
    };
  }

  /**
   * Run all quality gates
   */
  runAllGates(inputMetrics: {
    build_time_seconds?: number;
    test_execution_time_seconds?: number;
    e2e_test_time_seconds?: number;
    api_response_time_p95_ms?: number;
    page_load_time_p95_ms?: number;
    error_rate_percentage?: number;
    uptime_percentage?: number;
    test_pass_rate_percentage?: number;
    test_coverage_percentage?: number;
  }): QualityGateResult {
    const gates: QualityGateBudget[] = [];

    if (inputMetrics.build_time_seconds !== undefined) {
      gates.push(this.checkBuildTime(inputMetrics.build_time_seconds));
    }
    if (inputMetrics.test_execution_time_seconds !== undefined) {
      gates.push(this.checkTestExecutionTime(inputMetrics.test_execution_time_seconds));
    }
    if (inputMetrics.e2e_test_time_seconds !== undefined) {
      gates.push(this.checkE2ETestTime(inputMetrics.e2e_test_time_seconds));
    }
    if (inputMetrics.api_response_time_p95_ms !== undefined) {
      gates.push(this.checkAPIResponseTime(inputMetrics.api_response_time_p95_ms));
    }
    if (inputMetrics.page_load_time_p95_ms !== undefined) {
      gates.push(this.checkPageLoadTime(inputMetrics.page_load_time_p95_ms));
    }
    if (inputMetrics.error_rate_percentage !== undefined) {
      gates.push(this.checkErrorRate(inputMetrics.error_rate_percentage));
    }
    if (inputMetrics.uptime_percentage !== undefined) {
      gates.push(this.checkUptime(inputMetrics.uptime_percentage));
    }
    if (inputMetrics.test_pass_rate_percentage !== undefined) {
      gates.push(this.checkTestPassRate(inputMetrics.test_pass_rate_percentage));
    }
    if (inputMetrics.test_coverage_percentage !== undefined) {
      gates.push(this.checkTestCoverage(inputMetrics.test_coverage_percentage));
    }

    const passed = gates.filter((g) => g.status === "pass").length;
    const failed = gates.filter((g) => g.status === "fail").length;
    const warnings = gates.filter((g) => g.status === "warning").length;

    const overallStatus = failed > 0 ? "fail" : warnings > 0 ? "warning" : "pass";

    // Record metrics
    gates.forEach((gate) => {
      obsMetrics.setGauge(`ci.quality_gate.${gate.metric}`, gate.current_value || 0, {
        gate_name: gate.gate_name,
        status: gate.status,
      });
    });

    return {
      overall_status: overallStatus,
      gates,
      summary: {
        total: gates.length,
        passed,
        failed,
        warnings,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
