/**
 * Check Evaluation Regression
 * 
 * Compares current evaluation results against baseline and fails if regression detected.
 */

import { getCitationMetricsTracker } from "@/lib/evaluation/citation-metrics";
import { getGoldenSetManager } from "@/lib/evaluation/golden-sets";

async function checkRegression() {
  const citationTracker = getCitationMetricsTracker();
  const goldenSetManager = getGoldenSetManager();

  // Get current citation metrics
  const currentSummary = citationTracker.getSummary("day");

  // Get baseline (would be stored in database or file)
  const baselineSummary = {
    p50: 0.92,
    p95: 0.95,
    p99: 0.98,
    mean: 0.93,
    min: 0.85,
    max: 1.0,
    totalClaims: 100,
    period: "day" as const,
    periodStart: new Date(),
    periodEnd: new Date(),
  };

  // Check for regression
  const regressionCheck = citationTracker.checkRegression(
    currentSummary,
    baselineSummary
  );

  if (regressionCheck.hasRegression) {
    console.error("❌ REGRESSION DETECTED:");
    console.error(regressionCheck.recommendation);
    console.error("Regression details:", regressionCheck.regressionDetails);
    process.exit(1);
  }

  console.log("✅ No regression detected");
  console.log("Current metrics:", currentSummary);
  console.log("Baseline metrics:", baselineSummary);
}

checkRegression().catch((error) => {
  console.error("Regression check failed:", error);
  process.exit(1);
});
