/**
 * Run Evaluation Suite
 * 
 * Runs evaluation on golden sets and stores results for continuous tracking.
 */

import { getGoldenSetManager } from "@/lib/evaluation/golden-sets";
import { AIAnswerEvaluationHarness } from "@/lib/evaluation/harness";
import { getCitationMetricsTracker } from "@/lib/evaluation/citation-metrics";
import { LLMProvider } from "@/lib/llm/providers";
import { ModelRouter } from "@/lib/ai/router";
import { writeFileSync } from "fs";

async function runEvaluation() {
  const goldenSetManager = getGoldenSetManager();
  const harness = new AIAnswerEvaluationHarness();
  const citationTracker = getCitationMetricsTracker();
  const llmProvider = new LLMProvider();
  const router = new ModelRouter();

  const results: Array<{
    domain: string;
    exampleId: string;
    model: string;
    scores: {
      citation_capture: number;
      narrative_drift: number;
      harmful_resurfacing: number;
      overall: number;
      citation_faithfulness?: number;
    };
    passed: boolean;
  }> = [];

  const domains: Array<"claims" | "evidence_linking" | "graph_updates" | "aaal_outputs"> = [
    "claims",
    "evidence_linking",
    "graph_updates",
    "aaal_outputs",
  ];

  console.log("Starting evaluation suite...\n");

  for (const domain of domains) {
    console.log(`Evaluating domain: ${domain}`);
    const goldenSet = await goldenSetManager.getGoldenSet(domain);

    if (!goldenSet || goldenSet.examples.length === 0) {
      console.log(`  ⚠️  No golden set found for ${domain}, skipping`);
      continue;
    }

    // Evaluate first 10 examples (for CI speed)
    const examplesToEvaluate = goldenSet.examples.slice(0, 10);

    for (const example of examplesToEvaluate) {
      try {
        // Get input text based on domain
        const inputText =
          typeof example.input === "string"
            ? example.input
            : (example.input as any).text || JSON.stringify(example.input);

        // Route to appropriate model
        const taskType = domain === "claims" ? "extract" : "eval";
        const routingResult = await router.route(
          {
            model: "gpt-4o", // Will be overridden by router
            prompt: inputText,
            temperature: 0.7,
            max_tokens: 2000,
          },
          {
            tenantId: "",
            taskType,
            latencyConstraint: 5000,
            costConstraint: 0.01,
          }
        );

        // Use the routed response directly
        const response = routingResult.response;

        // Extract expected evidence from example
        const expectedEvidence =
          typeof example.expectedOutput === "object" &&
          (example.expectedOutput as any).evidence_refs
            ? (example.expectedOutput as any).evidence_refs
            : [];

        // Evaluate response
        const evaluation = await harness.evaluate(
          inputText,
          response.text,
          expectedEvidence,
          {
            model: routingResult.model,
            tenantId: "default",
          }
        );

        // Evaluate citation faithfulness if citations exist
        let citationFaithfulness: number | undefined;
        if (expectedEvidence.length > 0) {
          const citationMetrics = await citationTracker.evaluateCitationFaithfulness(
            example.id,
            response.text,
            expectedEvidence
          );
          citationFaithfulness = citationMetrics.citationFaithfulness;
        }

        const scores = {
          citation_capture: evaluation.citation_capture_score,
          narrative_drift: evaluation.narrative_drift_score,
          harmful_resurfacing: evaluation.harmful_resurfacing_score,
          overall: evaluation.overall_score,
          citation_faithfulness: citationFaithfulness,
        };

        // Check if passed (overall score > 0.7 and citation faithfulness > 0.8 if available)
        const passed =
          evaluation.overall_score >= 0.7 &&
          (citationFaithfulness === undefined || citationFaithfulness >= 0.8);

        results.push({
          domain,
          exampleId: example.id,
          model: routingResult.model,
          scores,
          passed,
        });

        console.log(
          `  ${passed ? "✅" : "❌"} ${example.id}: overall=${evaluation.overall_score.toFixed(2)}, citation=${citationFaithfulness?.toFixed(2) || "N/A"}`
        );
      } catch (error) {
        console.error(`  ❌ Error evaluating ${example.id}:`, error);
        results.push({
          domain,
          exampleId: example.id,
          model: "unknown",
          scores: {
            citation_capture: 0,
            narrative_drift: 1,
            harmful_resurfacing: 1,
            overall: 0,
          },
          passed: false,
        });
      }
    }
  }

  // Calculate summary
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const overallScore =
    results.reduce((sum, r) => sum + r.scores.overall, 0) / total;
  const citationFaithfulness =
    results
      .filter((r) => r.scores.citation_faithfulness !== undefined)
      .reduce(
        (sum, r) => sum + (r.scores.citation_faithfulness || 0),
        0
      ) /
    results.filter((r) => r.scores.citation_faithfulness !== undefined).length;

  const summary = {
    passed: passed === total,
    total,
    passedCount: passed,
    failedCount: total - passed,
    overallScore,
    citationFaithfulness: citationFaithfulness || undefined,
    results,
  };

  // Write results to file
  writeFileSync("evaluation-results.json", JSON.stringify(summary, null, 2));

  console.log("\n=== Evaluation Summary ===");
  console.log(`Total: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${total - passed}`);
  console.log(`Overall Score: ${overallScore.toFixed(3)}`);
  if (citationFaithfulness) {
    console.log(`Citation Faithfulness: ${citationFaithfulness.toFixed(3)}`);
  }
  console.log(`\n${summary.passed ? "✅" : "❌"} Evaluation ${summary.passed ? "PASSED" : "FAILED"}`);

  // Exit with error code if failed
  if (!summary.passed) {
    process.exit(1);
  }
}

runEvaluation().catch((error) => {
  console.error("Evaluation failed:", error);
  process.exit(1);
});
