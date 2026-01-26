"use strict";
/**
 * Forecast Primitives
 *
 * Drift/anomaly/diffusion models with eval harness gates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleEvalHarnessGate = exports.ForecastService = void 0;
const time_series_1 = require("./time-series");
const time_series_2 = require("./time-series");
const hawkes_1 = require("./hawkes");
const logger_1 = require("@/lib/logging/logger");
class ForecastService {
    constructor(eventStore, beliefGraph) {
        this.eventStore = eventStore;
        this.beliefGraph = beliefGraph;
    }
    /**
     * Generate forecasts for a tenant based on recent graph updates
     */
    async generateForecasts(tenant_id) {
        const forecasts = [];
        try {
            // Get recent belief nodes for trend analysis
            const nodes = await this.beliefGraph.getNodes(tenant_id, { limit: 100 });
            if (nodes.length === 0) {
                return forecasts;
            }
            // Extract time series data from node trust scores and decisiveness
            const strengthValues = [];
            const timestamps = [];
            for (const node of nodes) {
                // Use trust_score * decisiveness as strength metric
                const strength = node.trust_score * node.decisiveness;
                strengthValues.push(strength);
                timestamps.push(node.updated_at ? new Date(node.updated_at).getTime() : new Date(node.created_at).getTime());
            }
            if (strengthValues.length >= 5) {
                // Generate drift forecast
                const driftForecast = await this.forecastDrift(tenant_id, "belief_strength", 7, // 7-day horizon
                strengthValues);
                forecasts.push(driftForecast);
            }
            // Get recent signals for outbreak forecasting
            const recentEvents = await this.eventStore.query({
                tenant_id,
                type: "signal.ingested",
            });
            // Limit to 50 most recent events (already limited by query implementation)
            const limitedEvents = recentEvents.slice(0, 50);
            if (limitedEvents.length > 0) {
                const signals = limitedEvents.map((event) => {
                    const payload = event.payload;
                    return {
                        amplification: payload.amplification || 0.5,
                        sentiment: payload.sentiment || 0.5,
                    };
                });
                const outbreakForecast = await this.forecastOutbreak(tenant_id, 7, // 7-day horizon
                signals);
                forecasts.push(outbreakForecast);
            }
            // Store forecasts in database
            for (const forecast of forecasts) {
                await this.eventStore.append({
                    event_id: crypto.randomUUID(),
                    tenant_id,
                    actor_id: "forecast-service",
                    type: "forecast.generated",
                    occurred_at: new Date().toISOString(),
                    correlation_id: crypto.randomUUID(),
                    causation_id: undefined,
                    schema_version: "1.0",
                    evidence_refs: forecast.evidence_refs || [],
                    signatures: [],
                    payload: {
                        forecast_id: forecast.forecast_id,
                        type: forecast.type,
                        target_metric: forecast.target_metric,
                        value: forecast.value,
                        horizon_days: forecast.horizon_days,
                    },
                });
            }
            return forecasts;
        }
        catch (error) {
            logger_1.logger.error("Error generating forecasts", {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            return forecasts;
        }
    }
    /**
     * Forecast sentiment drift using ARIMA/Prophet models
     */
    async forecastDrift(tenant_id, metric, horizon_days, baseline_data) {
        if (baseline_data.length < 10) {
            // Fallback to simple linear trend for insufficient data
            const trend = baseline_data.length >= 2
                ? (baseline_data[baseline_data.length - 1] - baseline_data[0]) / (baseline_data.length - 1)
                : 0;
            const forecast_value = baseline_data[baseline_data.length - 1] + trend * horizon_days;
            const mean = baseline_data.reduce((sum, val) => sum + val, 0) / baseline_data.length;
            const variance = baseline_data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / baseline_data.length;
            const stdDev = Math.sqrt(variance);
            const confidenceWidth = stdDev * 1.96;
            return {
                forecast_id: `forecast-${Date.now()}`,
                tenant_id,
                type: "drift",
                target_metric: metric,
                value: forecast_value,
                confidence: {
                    lower: forecast_value - confidenceWidth,
                    upper: forecast_value + confidenceWidth,
                    level: 0.95,
                },
                horizon_days,
                model: "linear_trend",
                baseline: baseline_data[baseline_data.length - 1],
                direction: trend > 0 ? "increasing" : trend < 0 ? "decreasing" : "stable",
                drift_rate: trend,
                evidence_refs: [],
                created_at: new Date().toISOString(),
            };
        }
        // Use ARIMA for trend/seasonality detection
        const arima = new time_series_1.ARIMAModel();
        let forecastResult;
        try {
            // Try ARIMA first
            forecastResult = await arima.forecast(baseline_data, horizon_days);
        }
        catch (error) {
            logger_1.logger.warn("ARIMA forecast failed, trying Prophet", {
                error: error instanceof Error ? error.message : String(error),
            });
            // Fallback to Prophet
            const prophet = new time_series_2.ProphetModel();
            try {
                forecastResult = await prophet.forecast(baseline_data, horizon_days, {
                    weekly_seasonality: true,
                });
            }
            catch (prophetError) {
                logger_1.logger.warn("Prophet forecast failed, using exponential smoothing fallback", {
                    error: prophetError instanceof Error ? prophetError.message : String(prophetError),
                });
                // Final fallback: exponential smoothing
                return this.exponentialSmoothingForecast(tenant_id, metric, horizon_days, baseline_data);
            }
        }
        const forecast_value = forecastResult.values[horizon_days - 1] || forecastResult.values[forecastResult.values.length - 1];
        const confidenceInterval = forecastResult.confidence_intervals[horizon_days - 1] || forecastResult.confidence_intervals[forecastResult.confidence_intervals.length - 1];
        const baseline = baseline_data[baseline_data.length - 1];
        // Calculate drift rate from trend
        const trendValues = forecastResult.trend || [];
        const drift_rate = trendValues.length > 0
            ? (trendValues[trendValues.length - 1] - trendValues[0]) / trendValues.length
            : (forecast_value - baseline) / horizon_days;
        const forecast = {
            forecast_id: `forecast-${Date.now()}`,
            tenant_id,
            type: "drift",
            target_metric: metric,
            value: forecast_value,
            confidence: {
                lower: confidenceInterval.lower,
                upper: confidenceInterval.upper,
                level: confidenceInterval.level,
            },
            horizon_days,
            model: forecastResult.model_params.ar_order !== undefined ? "arima" : "prophet",
            baseline,
            direction: drift_rate > 0 ? "increasing" : drift_rate < 0 ? "decreasing" : "stable",
            drift_rate,
            evidence_refs: [],
            created_at: new Date().toISOString(),
        };
        // Emit event
        const event = {
            event_id: crypto.randomUUID(),
            tenant_id,
            actor_id: "forecast-service",
            type: "forecast.generated",
            occurred_at: new Date().toISOString(),
            correlation_id: crypto.randomUUID(),
            schema_version: "1.0",
            evidence_refs: [],
            payload: {
                forecast_id: forecast.forecast_id,
                type: forecast.type,
                target_metric: metric,
            },
            signatures: [],
        };
        await this.eventStore.append(event);
        return forecast;
    }
    /**
     * Exponential smoothing fallback (Holt-Winters method)
     */
    exponentialSmoothingForecast(tenant_id, metric, horizon_days, baseline_data) {
        const alpha = 0.3; // Smoothing parameter
        let smoothed = baseline_data[0];
        let trend = 0;
        // Calculate initial trend
        if (baseline_data.length >= 2) {
            trend = baseline_data[1] - baseline_data[0];
        }
        // Apply exponential smoothing
        for (let i = 1; i < baseline_data.length; i++) {
            const prevSmoothed = smoothed;
            smoothed = alpha * baseline_data[i] + (1 - alpha) * (smoothed + trend);
            trend = alpha * (smoothed - prevSmoothed) + (1 - alpha) * trend;
        }
        // Forecast future value
        const forecast_value = smoothed + trend * horizon_days;
        const drift_rate = trend;
        // Calculate confidence interval using standard deviation
        const mean = baseline_data.reduce((sum, val) => sum + val, 0) / baseline_data.length;
        const variance = baseline_data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / baseline_data.length;
        const stdDev = Math.sqrt(variance);
        const confidenceWidth = stdDev * 1.96; // 95% confidence interval
        const baseline = baseline_data[baseline_data.length - 1];
        return {
            forecast_id: `forecast-${Date.now()}`,
            tenant_id,
            type: "drift",
            target_metric: metric,
            value: forecast_value,
            confidence: {
                lower: forecast_value - confidenceWidth,
                upper: forecast_value + confidenceWidth,
                level: 0.95,
            },
            horizon_days,
            model: "exponential_smoothing",
            baseline,
            direction: drift_rate > 0 ? "increasing" : drift_rate < 0 ? "decreasing" : "stable",
            drift_rate,
            evidence_refs: [],
            created_at: new Date().toISOString(),
        };
    }
    /**
     * Forecast outbreak probability
     * Uses Hawkes process for diffusion modeling, falls back to logistic regression
     */
    async forecastOutbreak(tenant_id, horizon_days, signals, options) {
        const useHawkes = options?.use_hawkes ?? true;
        // Use Hawkes process if enabled and we have timestamped signals
        if (useHawkes && signals.length > 0 && signals.some((s) => s.timestamp)) {
            try {
                const hawkesEvents = signals
                    .filter((s) => s.timestamp)
                    .map((s) => ({
                    timestamp: s.timestamp,
                    type: "signal",
                    magnitude: s.amplification * (1 - s.sentiment), // Negative sentiment increases magnitude
                    metadata: { sentiment: s.sentiment },
                }));
                const hawkes = new hawkes_1.HawkesProcess();
                hawkes.fit(hawkesEvents);
                const now = Date.now();
                const horizonMs = horizon_days * 24 * 60 * 60 * 1000;
                const forecasts = hawkes.forecast(now, horizon_days * 24, {
                    confidence_level: 0.7,
                    include_simulation: true,
                });
                // Get max intensity and outbreak probability
                const maxForecast = forecasts.reduce((max, f) => f.intensity > max.intensity ? f : max);
                const probability = maxForecast.outbreak_probability;
                return {
                    forecast_id: `forecast-${Date.now()}`,
                    tenant_id,
                    type: "outbreak",
                    target_metric: "outbreak_probability",
                    value: probability,
                    confidence: maxForecast.confidence,
                    horizon_days,
                    model: "hawkes_process",
                    probability,
                    triggers: probability > 0.7 ? ["high_intensity", "rapid_growth"] : [],
                    evidence_refs: [],
                    created_at: new Date().toISOString(),
                };
            }
            catch (error) {
                // Fall back to logistic regression if Hawkes fails
                logger_1.logger.warn("Hawkes forecast failed, falling back to logistic regression", { error });
            }
        }
        // Fallback to logistic regression
        if (signals.length === 0) {
            return {
                forecast_id: `forecast-${Date.now()}`,
                tenant_id,
                type: "outbreak",
                target_metric: "outbreak_probability",
                value: 0,
                confidence: { lower: 0, upper: 0.1, level: 0.7 },
                horizon_days,
                model: "logistic_regression",
                probability: 0,
                triggers: [],
                evidence_refs: [],
                created_at: new Date().toISOString(),
            };
        }
        const avg_amplification = signals.reduce((sum, s) => sum + s.amplification, 0) / signals.length;
        const avg_sentiment = signals.reduce((sum, s) => sum + s.sentiment, 0) / signals.length;
        const signal_volume = signals.length;
        // Logistic regression: P(outbreak) = 1 / (1 + e^(-(β0 + β1*amplification + β2*(1-sentiment) + β3*volume)))
        // Coefficients tuned for narrative risk prediction
        const beta0 = -2.5; // Intercept
        const beta1 = 1.5; // Amplification coefficient
        const beta2 = 2.0; // Negative sentiment coefficient
        const beta3 = 0.01; // Volume coefficient (normalized)
        const z = beta0 +
            (beta1 * avg_amplification) +
            (beta2 * (1 - avg_sentiment)) +
            (beta3 * Math.min(signal_volume, 100)); // Cap volume effect
        const probability = 1 / (1 + Math.exp(-z)); // Logistic function
        const forecast = {
            forecast_id: `forecast-${Date.now()}`,
            tenant_id,
            type: "outbreak",
            target_metric: "outbreak_probability",
            value: probability,
            confidence: {
                lower: Math.max(0, probability - 0.1),
                upper: Math.min(1, probability + 0.1),
                level: 0.7,
            },
            horizon_days,
            model: "logistic_regression",
            probability,
            triggers: signals.length > 10 ? ["high_signal_volume"] : [],
            evidence_refs: [],
            created_at: new Date().toISOString(),
        };
        // Emit event
        const event = {
            event_id: crypto.randomUUID(),
            tenant_id,
            actor_id: "forecast-service",
            type: "forecast.generated",
            occurred_at: new Date().toISOString(),
            correlation_id: crypto.randomUUID(),
            schema_version: "1.0",
            evidence_refs: [],
            payload: {
                forecast_id: forecast.forecast_id,
                type: forecast.type,
                probability,
            },
            signatures: [],
        };
        await this.eventStore.append(event);
        return forecast;
    }
    /**
     * Detect anomalies using statistical methods (Z-score and IQR)
     */
    async detectAnomaly(tenant_id, metric, current_value, historical_values) {
        if (historical_values.length < 3) {
            return null; // Need at least 3 data points
        }
        // Calculate mean and standard deviation
        const mean = historical_values.reduce((sum, v) => sum + v, 0) / historical_values.length;
        const variance = historical_values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / historical_values.length;
        const std = Math.sqrt(variance);
        // Z-score method
        const z_score = std > 0 ? (current_value - mean) / std : 0;
        const z_threshold = 2.5; // 2.5 standard deviations (99% confidence)
        // IQR method (more robust to outliers)
        const sorted = [...historical_values].sort((a, b) => a - b);
        const q1_index = Math.floor(sorted.length * 0.25);
        const q3_index = Math.floor(sorted.length * 0.75);
        const q1 = sorted[q1_index];
        const q3 = sorted[q3_index];
        const iqr = q3 - q1;
        const iqr_lower = q1 - 1.5 * iqr;
        const iqr_upper = q3 + 1.5 * iqr;
        // Anomaly if either Z-score or IQR method detects it
        const isZScoreAnomaly = Math.abs(z_score) >= z_threshold;
        const isIQRAnomaly = current_value < iqr_lower || current_value > iqr_upper;
        if (!isZScoreAnomaly && !isIQRAnomaly) {
            return null; // No anomaly detected
        }
        const forecast = {
            forecast_id: `forecast-${Date.now()}`,
            tenant_id,
            type: "anomaly",
            target_metric: metric,
            value: current_value,
            confidence: {
                lower: mean - std,
                upper: mean + std,
                level: 0.9,
            },
            horizon_days: 0,
            model: "z_score",
            evidence_refs: [],
            created_at: new Date().toISOString(),
        };
        return forecast;
    }
}
exports.ForecastService = ForecastService;
class SimpleEvalHarnessGate {
    async evaluate(forecast) {
        // In production, use comprehensive evaluation
        // For MVP, basic checks
        let score = 0.5; // Base score
        // Check confidence level
        if (forecast.confidence.level >= 0.8) {
            score += 0.2;
        }
        // Check evidence references
        if (forecast.evidence_refs.length > 0) {
            score += 0.2;
        }
        // Check model
        if (forecast.model !== "heuristic") {
            score += 0.1;
        }
        return {
            passed: score >= 0.6,
            score,
            reason: score >= 0.6 ? "Forecast meets quality threshold" : "Forecast below quality threshold",
        };
    }
}
exports.SimpleEvalHarnessGate = SimpleEvalHarnessGate;
