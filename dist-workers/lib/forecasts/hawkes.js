"use strict";
/**
 * Hawkes / Self-Exciting Diffusion Models
 *
 * Better outbreak fit than stationary time series for narrative cascades.
 * Based on: https://papers.ssrn.com/sol3/Delivery.cfm/51fdf055-c9ba-4a41-a7c7-0b7d178b8008-MECA.pdf?abstractid=5477721&mirid=1
 *
 * Interpretation in POS:
 * - baseline intensity = normal chatter
 * - excitation = virality response to prior events
 * - decay = how quickly attention fades
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HawkesProcess = void 0;
const logger_1 = require("@/lib/logging/logger");
/**
 * Hawkes Process Model for Narrative Outbreaks
 */
class HawkesProcess {
    constructor(parameters) {
        this.events = [];
        this.parameters = {
            baseline_intensity: parameters?.baseline_intensity || 0.1,
            excitation_coefficient: parameters?.excitation_coefficient || 0.5,
            decay_parameter: parameters?.decay_parameter || 0.1,
        };
    }
    /**
     * Fit parameters from historical events
     */
    fit(events) {
        this.events = [...events].sort((a, b) => a.timestamp - b.timestamp);
        if (this.events.length < 3) {
            logger_1.logger.warn("Hawkes: Insufficient events for fitting, using defaults");
            return;
        }
        // Estimate parameters using maximum likelihood estimation (simplified)
        const { baseline_intensity, excitation_coefficient, decay_parameter } = this.estimateParameters(this.events);
        this.parameters = {
            baseline_intensity,
            excitation_coefficient,
            decay_parameter,
        };
        logger_1.logger.info("Hawkes: Parameters fitted", {
            baseline_intensity,
            excitation_coefficient,
            decay_parameter,
            event_count: this.events.length,
        });
    }
    /**
     * Estimate parameters using MLE (simplified version)
     */
    estimateParameters(events) {
        // Simplified MLE estimation
        // In production, use more sophisticated optimization (e.g., gradient descent)
        const timeSpan = events[events.length - 1].timestamp - events[0].timestamp;
        const baseline_intensity = events.length / Math.max(timeSpan, 1);
        // Estimate excitation from event clustering
        let totalExcitation = 0;
        let excitationCount = 0;
        for (let i = 1; i < events.length; i++) {
            const timeDiff = events[i].timestamp - events[i - 1].timestamp;
            if (timeDiff < 3600) { // Events within 1 hour
                const excitation = events[i].magnitude * events[i - 1].magnitude;
                totalExcitation += excitation;
                excitationCount++;
            }
        }
        const excitation_coefficient = excitationCount > 0
            ? Math.min(1, totalExcitation / excitationCount / 10)
            : 0.3;
        // Estimate decay from event spacing
        const timeDiffs = [];
        for (let i = 1; i < events.length; i++) {
            timeDiffs.push(events[i].timestamp - events[i - 1].timestamp);
        }
        const avgTimeDiff = timeDiffs.length > 0
            ? timeDiffs.reduce((sum, d) => sum + d, 0) / timeDiffs.length
            : 3600;
        // Decay parameter: how quickly intensity drops (inverse of time constant)
        const decay_parameter = 1 / Math.max(avgTimeDiff / 1000, 0.1);
        return {
            baseline_intensity,
            excitation_coefficient,
            decay_parameter,
        };
    }
    /**
     * Compute intensity at time t
     *
     * λ(t) = μ + Σ αᵢ × exp(-β × (t - tᵢ))
     */
    intensity(t) {
        const μ = this.parameters.baseline_intensity;
        const α = this.parameters.excitation_coefficient;
        const β = this.parameters.decay_parameter;
        let excitation = 0;
        for (const event of this.events) {
            if (event.timestamp <= t) {
                const timeDiff = t - event.timestamp;
                const contribution = α * event.magnitude * Math.exp(-β * timeDiff);
                excitation += contribution;
            }
        }
        return μ + excitation;
    }
    /**
     * Forecast intensity over time horizon
     */
    forecast(startTime, horizonHours, options = {}) {
        const confidenceLevel = options.confidence_level || 0.7;
        const forecasts = [];
        const endTime = startTime + horizonHours * 3600 * 1000;
        const stepHours = 1; // Forecast every hour
        const steps = Math.ceil(horizonHours / stepHours);
        for (let i = 0; i < steps; i++) {
            const t = startTime + i * stepHours * 3600 * 1000;
            const intensity = this.intensity(t);
            // Estimate confidence interval using simulation
            let lower = intensity * 0.8;
            let upper = intensity * 1.2;
            if (options.include_simulation) {
                const simulated = this.simulateIntensity(t, 100);
                const sorted = simulated.sort((a, b) => a - b);
                const lowerIdx = Math.floor((1 - confidenceLevel) / 2 * sorted.length);
                const upperIdx = Math.ceil((1 + confidenceLevel) / 2 * sorted.length);
                lower = sorted[Math.max(0, lowerIdx)];
                upper = sorted[Math.min(sorted.length - 1, upperIdx)];
            }
            // Expected number of events in next hour
            const expectedEvents = intensity * stepHours;
            // Outbreak probability: P(intensity > threshold)
            const threshold = this.parameters.baseline_intensity * 3; // 3x baseline = outbreak
            const outbreak_probability = intensity > threshold
                ? Math.min(1, (intensity - threshold) / threshold)
                : 0;
            forecasts.push({
                timestamp: t,
                intensity,
                confidence: {
                    lower,
                    upper,
                    level: confidenceLevel,
                },
                expected_events: expectedEvents,
                outbreak_probability,
            });
        }
        return forecasts;
    }
    /**
     * Simulate intensity using Monte Carlo
     */
    simulateIntensity(t, nSimulations) {
        const intensities = [];
        for (let i = 0; i < nSimulations; i++) {
            // Add noise to parameters
            const noise = 0.1;
            const μ = this.parameters.baseline_intensity * (1 + (Math.random() - 0.5) * noise);
            const α = this.parameters.excitation_coefficient * (1 + (Math.random() - 0.5) * noise);
            const β = this.parameters.decay_parameter * (1 + (Math.random() - 0.5) * noise);
            let excitation = 0;
            for (const event of this.events) {
                if (event.timestamp <= t) {
                    const timeDiff = t - event.timestamp;
                    const contribution = α * event.magnitude * Math.exp(-β * timeDiff);
                    excitation += contribution;
                }
            }
            intensities.push(μ + excitation);
        }
        return intensities;
    }
    /**
     * Simulate intervention effect
     *
     * Returns forecast with and without intervention
     */
    simulateIntervention(startTime, horizonHours, intervention) {
        // Forecast without intervention
        const without = this.forecast(startTime, horizonHours);
        // Create modified process with intervention
        const modifiedProcess = new HawkesProcess({
            ...this.parameters,
            baseline_intensity: this.parameters.baseline_intensity * (1 - intervention.magnitude),
        });
        // Forecast with intervention
        const withIntervention = modifiedProcess.forecast(startTime, horizonHours);
        // Calculate reduction
        const totalWithout = without.reduce((sum, f) => sum + f.intensity, 0);
        const totalWith = withIntervention.reduce((sum, f) => sum + f.intensity, 0);
        const reduction = totalWithout > 0 ? (totalWithout - totalWith) / totalWithout : 0;
        return {
            without_intervention: without,
            with_intervention: withIntervention,
            reduction,
        };
    }
    /**
     * Add event to process
     */
    addEvent(event) {
        this.events.push(event);
        this.events.sort((a, b) => a.timestamp - b.timestamp);
    }
    /**
     * Get current parameters
     */
    getParameters() {
        return { ...this.parameters };
    }
    /**
     * Get events
     */
    getEvents() {
        return [...this.events];
    }
}
exports.HawkesProcess = HawkesProcess;
