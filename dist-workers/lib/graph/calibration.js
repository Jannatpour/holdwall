"use strict";
/**
 * Calibration for Belief/Trust Outputs
 *
 * Uses Platt scaling or isotonic regression to calibrate belief/trust scores
 * over golden sets. Prevents "pretty scores" and yields procurement-grade confidence.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalibrationEngine = void 0;
const logger_1 = require("@/lib/logging/logger");
/**
 * Calibration Engine
 */
class CalibrationEngine {
    constructor() {
        this.models = new Map();
    }
    /**
     * Fit calibration model from golden set
     */
    fit(modelId, data, type = "platt") {
        if (data.length < 10) {
            logger_1.logger.warn("Calibration: Insufficient data, using identity mapping", { modelId, data_length: data.length });
            return this.createIdentityModel();
        }
        let model;
        if (type === "platt") {
            model = this.fitPlattScaling(data);
        }
        else {
            model = this.fitIsotonicRegression(data);
        }
        this.models.set(modelId, model);
        logger_1.logger.info("Calibration: Model fitted", {
            model_id: modelId,
            type: model.type,
            brier_score: model.metrics.brier_score,
            data_points: data.length,
        });
        return model;
    }
    /**
     * Fit Platt scaling (sigmoid calibration)
     *
     * P(calibrated) = 1 / (1 + exp(A * raw_score + B))
     */
    fitPlattScaling(data) {
        // Simplified Platt scaling using gradient descent
        // In production, use more sophisticated optimization
        let A = -1.0;
        let B = 0.0;
        const learningRate = 0.01;
        const iterations = 100;
        for (let iter = 0; iter < iterations; iter++) {
            let gradA = 0;
            let gradB = 0;
            for (const point of data) {
                const z = A * point.raw_score + B;
                const sigmoid = 1 / (1 + Math.exp(-z));
                const error = sigmoid - point.true_label;
                gradA += error * point.raw_score;
                gradB += error;
            }
            A -= learningRate * gradA / data.length;
            B -= learningRate * gradB / data.length;
        }
        // Calculate metrics
        const metrics = this.calculateMetrics(data, (score) => {
            const z = A * score + B;
            return 1 / (1 + Math.exp(-z));
        });
        return {
            type: "platt",
            parameters: { A, B },
            metrics,
        };
    }
    /**
     * Fit isotonic regression (piecewise constant calibration)
     */
    fitIsotonicRegression(data) {
        // Simplified isotonic regression using PAVA (Pool Adjacent Violators Algorithm)
        // Sort by raw score
        const sorted = [...data].sort((a, b) => a.raw_score - b.raw_score);
        // Create bins
        const bins = [];
        const binSize = Math.max(1, Math.floor(sorted.length / 10));
        for (let i = 0; i < sorted.length; i += binSize) {
            const bin = sorted.slice(i, Math.min(i + binSize, sorted.length));
            const avgLabel = bin.reduce((sum, d) => sum + d.true_label, 0) / bin.length;
            const minScore = bin[0].raw_score;
            const maxScore = bin[bin.length - 1].raw_score;
            bins.push({
                min: minScore,
                max: maxScore,
                calibrated: avgLabel,
            });
        }
        // Ensure monotonicity (isotonic constraint)
        for (let i = 1; i < bins.length; i++) {
            if (bins[i].calibrated < bins[i - 1].calibrated) {
                bins[i].calibrated = bins[i - 1].calibrated;
            }
        }
        // Calculate metrics
        const metrics = this.calculateMetrics(data, (score) => {
            // Find bin
            for (const bin of bins) {
                if (score >= bin.min && score <= bin.max) {
                    return bin.calibrated;
                }
            }
            // Extrapolate
            if (score < bins[0].min)
                return bins[0].calibrated;
            if (score > bins[bins.length - 1].max)
                return bins[bins.length - 1].calibrated;
            return 0.5;
        });
        return {
            type: "isotonic",
            parameters: { bins: JSON.stringify(bins) },
            metrics,
        };
    }
    /**
     * Calculate calibration metrics
     */
    calculateMetrics(data, calibrateFn) {
        let brierScore = 0;
        let logLoss = 0;
        for (const point of data) {
            const calibrated = calibrateFn(point.raw_score);
            const error = calibrated - point.true_label;
            brierScore += error * error;
            logLoss += point.true_label * Math.log(calibrated + 1e-10) +
                (1 - point.true_label) * Math.log(1 - calibrated + 1e-10);
        }
        brierScore /= data.length;
        logLoss = -logLoss / data.length;
        // Calculate ECE (Expected Calibration Error)
        const ece = this.calculateECE(data, calibrateFn);
        return {
            brier_score: brierScore,
            log_loss: logLoss,
            ece,
        };
    }
    /**
     * Calculate Expected Calibration Error (ECE)
     */
    calculateECE(data, calibrateFn) {
        const nBins = 10;
        const binSize = 1 / nBins;
        let ece = 0;
        for (let i = 0; i < nBins; i++) {
            const binMin = i * binSize;
            const binMax = (i + 1) * binSize;
            const binData = data.filter((d) => {
                const calibrated = calibrateFn(d.raw_score);
                return calibrated >= binMin && calibrated < binMax;
            });
            if (binData.length === 0)
                continue;
            const avgCalibrated = binData.reduce((sum, d) => sum + calibrateFn(d.raw_score), 0) / binData.length;
            const avgTrueLabel = binData.reduce((sum, d) => sum + d.true_label, 0) / binData.length;
            const binWeight = binData.length / data.length;
            ece += binWeight * Math.abs(avgCalibrated - avgTrueLabel);
        }
        return ece;
    }
    /**
     * Calibrate a score using fitted model
     */
    calibrate(modelId, rawScore) {
        const model = this.models.get(modelId);
        if (!model) {
            logger_1.logger.warn("Calibration: Model not found, using identity", { model_id: modelId });
            return {
                raw_score: rawScore,
                calibrated_score: rawScore,
            };
        }
        let calibrated;
        if (model.type === "platt") {
            const A = typeof model.parameters.A === "number" ? model.parameters.A : Number(model.parameters.A) || 0;
            const B = typeof model.parameters.B === "number" ? model.parameters.B : Number(model.parameters.B) || 0;
            const z = A * rawScore + B;
            calibrated = 1 / (1 + Math.exp(-z));
        }
        else {
            // Isotonic
            const binsParam = model.parameters.bins;
            const bins = JSON.parse(typeof binsParam === "string" ? binsParam : "[]");
            calibrated = 0.5; // Default
            for (const bin of bins) {
                if (rawScore >= bin.min && rawScore <= bin.max) {
                    calibrated = bin.calibrated;
                    break;
                }
            }
            // Extrapolate
            if (bins.length > 0) {
                if (rawScore < bins[0].min)
                    calibrated = bins[0].calibrated;
                if (rawScore > bins[bins.length - 1].max)
                    calibrated = bins[bins.length - 1].calibrated;
            }
        }
        // Clamp to [0, 1]
        calibrated = Math.max(0, Math.min(1, calibrated));
        // Calculate confidence interval (simplified)
        const stdDev = Math.sqrt(calibrated * (1 - calibrated) / 100); // Assume 100 samples
        const confidenceLevel = 0.7;
        const zScore = 1.04; // For 70% confidence
        return {
            raw_score: rawScore,
            calibrated_score: calibrated,
            confidence_interval: {
                lower: Math.max(0, calibrated - zScore * stdDev),
                upper: Math.min(1, calibrated + zScore * stdDev),
                level: confidenceLevel,
            },
        };
    }
    /**
     * Create identity model (no calibration)
     */
    createIdentityModel() {
        return {
            type: "platt",
            parameters: { A: 0, B: 0 },
            metrics: {
                brier_score: 0.25, // Worst case
                log_loss: Math.log(2),
            },
        };
    }
    /**
     * Get model metrics
     */
    getModelMetrics(modelId) {
        const model = this.models.get(modelId);
        return model ? model.metrics : null;
    }
}
exports.CalibrationEngine = CalibrationEngine;
