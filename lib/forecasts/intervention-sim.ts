/**
 * Intervention Simulation
 * 
 * Simulate "if we publish artifact X today" versus "do nothing" to estimate 
 * outbreak reduction and compute ROI.
 */

import { HawkesProcess, type HawkesEvent, type HawkesForecast } from "./hawkes";
import { logger } from "@/lib/logging/logger";

export interface Intervention {
  /** Intervention ID */
  id: string;
  /** Intervention type */
  type: "artifact_publication" | "response" | "correction" | "transparency";
  /** Intervention time */
  time: number;
  /** Expected magnitude of impact (0-1) */
  magnitude: number;
  /** Duration of effect (hours) */
  duration: number;
  /** Cost of intervention */
  cost_usd?: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface InterventionSimulationResult {
  /** Intervention */
  intervention: Intervention;
  /** Forecast without intervention */
  baseline: HawkesForecast[];
  /** Forecast with intervention */
  with_intervention: HawkesForecast[];
  /** Reduction metrics */
  reduction: {
    /** Intensity reduction (%) */
    intensity_reduction: number;
    /** Expected events prevented */
    events_prevented: number;
    /** Outbreak probability reduction */
    outbreak_probability_reduction: number;
  };
  /** ROI calculation */
  roi?: {
    /** Cost of intervention */
    cost: number;
    /** Estimated value of prevented events */
    value_prevented: number;
    /** ROI ratio */
    roi_ratio: number;
  };
}

/**
 * Intervention Simulator
 */
export class InterventionSimulator {
  /**
   * Simulate intervention effect on narrative outbreak
   */
  async simulate(
    events: HawkesEvent[],
    intervention: Intervention,
    options: {
      horizon_hours?: number;
      value_per_event?: number; // USD value per prevented event
      include_roi?: boolean;
    } = {}
  ): Promise<InterventionSimulationResult> {
    const horizonHours = options.horizon_hours || 168; // 1 week default
    const valuePerEvent = options.value_per_event || 100; // $100 per event default

    // Fit Hawkes process to historical events
    const process = new HawkesProcess();
    process.fit(events);

    // Forecast baseline (no intervention)
    const baseline = process.forecast(intervention.time, horizonHours, {
      confidence_level: 0.7,
      include_simulation: true,
    });

    // Simulate intervention effect
    // Intervention reduces baseline intensity and excitation
    const interventionProcess = new HawkesProcess({
      baseline_intensity: process.getParameters().baseline_intensity * (1 - intervention.magnitude),
      excitation_coefficient: process.getParameters().excitation_coefficient * (1 - intervention.magnitude * 0.5),
      decay_parameter: process.getParameters().decay_parameter,
    });

    // Add intervention as a "negative event" that reduces intensity
    const interventionEvent: HawkesEvent = {
      timestamp: intervention.time,
      type: intervention.type,
      magnitude: -intervention.magnitude, // Negative magnitude reduces intensity
      metadata: intervention.metadata,
    };

    interventionProcess.addEvent(interventionEvent);
    const withIntervention = interventionProcess.forecast(intervention.time, horizonHours, {
      confidence_level: 0.7,
      include_simulation: true,
    });

    // Calculate reduction metrics
    const baselineIntensity = baseline.reduce((sum, f) => sum + f.intensity, 0);
    const interventionIntensity = withIntervention.reduce((sum, f) => sum + f.intensity, 0);
    const intensityReduction = baselineIntensity > 0
      ? (baselineIntensity - interventionIntensity) / baselineIntensity
      : 0;

    const baselineEvents = baseline.reduce((sum, f) => sum + f.expected_events, 0);
    const interventionEvents = withIntervention.reduce((sum, f) => sum + f.expected_events, 0);
    const eventsPrevented = Math.max(0, baselineEvents - interventionEvents);

    const baselineOutbreakProb = Math.max(...baseline.map((f) => f.outbreak_probability));
    const interventionOutbreakProb = Math.max(...withIntervention.map((f) => f.outbreak_probability));
    const outbreakProbReduction = baselineOutbreakProb > 0
      ? (baselineOutbreakProb - interventionOutbreakProb) / baselineOutbreakProb
      : 0;

    const result: InterventionSimulationResult = {
      intervention,
      baseline,
      with_intervention: withIntervention,
      reduction: {
        intensity_reduction: intensityReduction,
        events_prevented: eventsPrevented,
        outbreak_probability_reduction: outbreakProbReduction,
      },
    };

    // Calculate ROI if requested
    if (options.include_roi && intervention.cost_usd !== undefined) {
      const valuePrevented = eventsPrevented * valuePerEvent;
      const roiRatio = intervention.cost_usd > 0
        ? valuePrevented / intervention.cost_usd
        : Infinity;

      result.roi = {
        cost: intervention.cost_usd,
        value_prevented: valuePrevented,
        roi_ratio: roiRatio,
      };
    }

    logger.info("Intervention simulation completed", {
      intervention_id: intervention.id,
      intensity_reduction: intensityReduction,
      events_prevented: eventsPrevented,
      roi_ratio: result.roi?.roi_ratio,
    });

    return result;
  }

  /**
   * Compare multiple interventions
   */
  async compareInterventions(
    events: HawkesEvent[],
    interventions: Intervention[],
    options: {
      horizon_hours?: number;
      value_per_event?: number;
    } = {}
  ): Promise<Array<InterventionSimulationResult & { rank: number }>> {
    const results = await Promise.all(
      interventions.map((intervention) =>
        this.simulate(events, intervention, {
          ...options,
          include_roi: true,
        })
      )
    );

    // Rank by ROI (if available) or intensity reduction
    const ranked = results
      .map((result, idx) => ({
        ...result,
        rank: 0, // Will be set below
        sort_score: result.roi?.roi_ratio || result.reduction.intensity_reduction,
      }))
      .sort((a, b) => b.sort_score - a.sort_score)
      .map((result, idx) => ({
        ...result,
        rank: idx + 1,
      }));

    return ranked;
  }
}
