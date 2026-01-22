/**
 * Experiment Tracker
 * 
 * Track experiments, measure impact, rollback capability
 */

import { abTesting } from "./ab-testing";
import { featureFlags } from "./feature-flags";

export interface Experiment {
  id: string;
  name: string;
  type: "ab_test" | "feature_flag" | "rollout";
  start_date: string;
  end_date?: string;
  status: "draft" | "running" | "completed" | "cancelled";
  metrics: string[]; // Metrics to track
  hypothesis?: string;
}

export interface ExperimentResult {
  experiment_id: string;
  metrics: Record<string, {
    baseline: number;
    variant: number;
    improvement: number; // Percentage
    confidence: number; // Statistical confidence
  }>;
  conclusion: string;
  recommendation: "keep" | "rollback" | "extend";
}

/**
 * Experiment Tracker
 */
export class ExperimentTracker {
  private experiments = new Map<string, Experiment>();

  /**
   * Create experiment
   */
  createExperiment(experiment: Experiment): void {
    this.experiments.set(experiment.id, experiment);
  }

  /**
   * Start experiment
   */
  startExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error("Experiment not found");
    }

    experiment.status = "running";
    experiment.start_date = new Date().toISOString();
  }

  /**
   * End experiment
   */
  endExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error("Experiment not found");
    }

    experiment.status = "completed";
    experiment.end_date = new Date().toISOString();
  }

  /**
   * Cancel experiment
   */
  cancelExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error("Experiment not found");
    }

    experiment.status = "cancelled";
    experiment.end_date = new Date().toISOString();
  }

  /**
   * Get experiment results
   */
  async getResults(experimentId: string): Promise<ExperimentResult | null> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      return null;
    }

    if (experiment.type === "ab_test") {
      const abResults = await abTesting.getResults(experimentId);
      
      // Calculate improvements
      const metrics: Record<string, any> = {};
      if (abResults.variants.length >= 2) {
        const baseline = abResults.variants[0];
        const variant = abResults.variants[1];
        
        const improvement = baseline.conversion_rate > 0
          ? ((variant.conversion_rate - baseline.conversion_rate) / baseline.conversion_rate) * 100
          : 0;

        const significance = abTesting.calculateStatisticalSignificance(
          { participants: baseline.participants, conversions: baseline.conversions },
          { participants: variant.participants, conversions: variant.conversions }
        );

        metrics["conversion_rate"] = {
          baseline: baseline.conversion_rate,
          variant: variant.conversion_rate,
          improvement,
          confidence: 1 - significance, // Convert p-value to confidence
        };
      }

      // Determine recommendation
      let recommendation: "keep" | "rollback" | "extend" = "extend";
      const conversionMetric = metrics["conversion_rate"];
      if (conversionMetric) {
        if (conversionMetric.improvement > 5 && conversionMetric.confidence > 0.95) {
          recommendation = "keep";
        } else if (conversionMetric.improvement < -5 && conversionMetric.confidence > 0.95) {
          recommendation = "rollback";
        }
      }

      return {
        experiment_id: experimentId,
        metrics,
        conclusion: this.generateConclusion(metrics),
        recommendation,
      };
    }

    // For feature flags and rollouts, return simplified results
    return {
      experiment_id: experimentId,
      metrics: {},
      conclusion: "Experiment in progress",
      recommendation: "extend",
    };
  }

  /**
   * Generate conclusion from metrics
   */
  private generateConclusion(metrics: Record<string, any>): string {
    const conclusions: string[] = [];

    for (const [metricName, data] of Object.entries(metrics)) {
      if (data.improvement > 0 && data.confidence > 0.95) {
        conclusions.push(`${metricName} improved by ${data.improvement.toFixed(1)}% with ${(data.confidence * 100).toFixed(1)}% confidence`);
      } else if (data.improvement < 0 && data.confidence > 0.95) {
        conclusions.push(`${metricName} decreased by ${Math.abs(data.improvement).toFixed(1)}% with ${(data.confidence * 100).toFixed(1)}% confidence`);
      } else {
        conclusions.push(`${metricName} showed no significant change`);
      }
    }

    return conclusions.join(". ") || "No significant results";
  }

  /**
   * Get all experiments
   */
  getAllExperiments(): Experiment[] {
    return Array.from(this.experiments.values());
  }

  /**
   * Get active experiments
   */
  getActiveExperiments(): Experiment[] {
    return Array.from(this.experiments.values()).filter(e => e.status === "running");
  }
}

export const experimentTracker = new ExperimentTracker();
