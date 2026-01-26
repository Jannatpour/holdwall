"use strict";
/**
 * Learning Agent
 *
 * Continuous improvement from outcomes agent.
 * Part of the 8-agent autonomous architecture.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.learningAgent = exports.LearningAgent = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
const metrics_1 = require("@/lib/observability/metrics");
const client_2 = require("@prisma/client");
/**
 * Learning Agent
 *
 * Continuous improvement from outcomes
 */
class LearningAgent {
    /**
     * Learn from case outcomes
     */
    async learnFromOutcomes(tenantId) {
        const insights = [];
        // Get resolved cases
        const resolvedCases = await client_1.db.case.findMany({
            where: {
                tenantId,
                status: { in: ["RESOLVED", "CLOSED"] },
                resolution: {
                    isNot: null,
                },
            },
            include: {
                resolution: true,
            },
            take: 100,
        });
        // Analyze patterns
        const patterns = this.analyzePatterns(resolvedCases);
        // Generate insights
        for (const [key, stats] of patterns.entries()) {
            const insight = await this.generateInsight({ key, ...stats }, tenantId);
            if (insight) {
                insights.push(insight);
            }
        }
        logger_1.logger.info("Learning insights generated", {
            tenant_id: tenantId,
            insights_count: insights.length,
        });
        return insights;
    }
    /**
     * Analyze patterns in resolved cases
     */
    analyzePatterns(cases) {
        const patterns = new Map();
        for (const case_ of cases) {
            const key = `${case_.type}_${case_.severity}`;
            const existing = patterns.get(key) || { success: 0, total: 0, avgTime: 0 };
            existing.total++;
            if (case_.status === "RESOLVED") {
                existing.success++;
            }
            if (case_.resolvedAt) {
                const hours = (case_.resolvedAt.getTime() - case_.createdAt.getTime()) / (1000 * 60 * 60);
                existing.avgTime = (existing.avgTime * (existing.total - 1) + hours) / existing.total;
            }
            patterns.set(key, existing);
        }
        return patterns;
    }
    /**
     * Generate insight from pattern
     */
    async generateInsight(pattern, tenantId) {
        if (pattern.total < 5) {
            return null; // Not enough data
        }
        const successRate = pattern.success / pattern.total;
        const [type, severity] = pattern.key.split("_");
        let recommendation = "";
        if (successRate > 0.9) {
            recommendation = `High success rate (${(successRate * 100).toFixed(1)}%) for ${type} cases with ${severity} severity. Continue current approach.`;
        }
        else if (successRate < 0.7) {
            recommendation = `Low success rate (${(successRate * 100).toFixed(1)}%) for ${type} cases with ${severity} severity. Consider reviewing resolution strategies.`;
        }
        else {
            recommendation = `Moderate success rate (${(successRate * 100).toFixed(1)}%) for ${type} cases. Room for improvement.`;
        }
        return {
            pattern: pattern.key,
            successRate,
            recommendation,
            confidence: Math.min(1, pattern.total / 20), // More cases = higher confidence
        };
    }
    /**
     * Identify successful resolution patterns
     */
    async identifySuccessfulPatterns(tenantId) {
        const resolvedCases = await client_1.db.case.findMany({
            where: {
                tenantId,
                status: "RESOLVED",
                resolution: {
                    isNot: null,
                },
            },
            include: {
                resolution: true,
            },
            take: 50,
        });
        const successfulPatterns = [];
        // Group by type and severity
        const groups = new Map();
        for (const case_ of resolvedCases) {
            const key = `${case_.type}_${case_.severity}`;
            groups.set(key, (groups.get(key) || 0) + 1);
        }
        // Identify patterns with high success
        for (const [pattern, count] of groups.entries()) {
            if (count >= 5) {
                successfulPatterns.push(pattern);
            }
        }
        return successfulPatterns;
    }
    /**
     * A/B test new strategies
     *
     * Tests a new resolution strategy by comparing outcomes against baseline.
     * Tracks cases that used the strategy and compares metrics.
     */
    async testStrategy(strategy, caseType, tenantId) {
        const startTime = Date.now();
        try {
            logger_1.logger.info("Strategy A/B test initiated", {
                strategy,
                case_type: caseType,
                tenant_id: tenantId,
            });
            // Get cases that used this strategy (stored in metadata)
            const testCases = await client_1.db.case.findMany({
                where: {
                    tenantId,
                    type: caseType,
                    metadata: {
                        path: ["strategy"],
                        equals: strategy,
                    },
                },
                include: {
                    resolution: true,
                },
                take: 100,
            });
            // Get baseline cases (same type, without strategy metadata or with baseline strategy)
            const baselineCases = await client_1.db.case.findMany({
                where: {
                    tenantId,
                    type: caseType,
                    OR: [
                        { metadata: { path: ["strategy"], equals: "baseline" } },
                        { metadata: { path: ["strategy"], equals: client_2.Prisma.JsonNull } },
                    ],
                },
                include: {
                    resolution: true,
                },
                take: 100,
            });
            // Calculate test metrics
            const testResolved = testCases.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED");
            const testSuccessRate = testCases.length > 0 ? testResolved.length / testCases.length : 0;
            let testAvgResolutionTime = 0;
            if (testResolved.length > 0) {
                const totalTime = testResolved.reduce((sum, c) => {
                    if (c.resolvedAt && c.createdAt) {
                        return sum + (c.resolvedAt.getTime() - c.createdAt.getTime());
                    }
                    return sum;
                }, 0);
                testAvgResolutionTime = totalTime / (testResolved.length * 1000 * 60 * 60); // Convert to hours
            }
            // Calculate baseline metrics
            const baselineResolved = baselineCases.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED");
            const baselineSuccessRate = baselineCases.length > 0 ? baselineResolved.length / baselineCases.length : 0;
            let baselineAvgResolutionTime = 0;
            if (baselineResolved.length > 0) {
                const totalTime = baselineResolved.reduce((sum, c) => {
                    if (c.resolvedAt && c.createdAt) {
                        return sum + (c.resolvedAt.getTime() - c.createdAt.getTime());
                    }
                    return sum;
                }, 0);
                baselineAvgResolutionTime = totalTime / (baselineResolved.length * 1000 * 60 * 60); // Convert to hours
            }
            // Calculate improvement
            const successRateImprovement = testSuccessRate - baselineSuccessRate;
            const resolutionTimeImprovement = baselineAvgResolutionTime > 0
                ? ((baselineAvgResolutionTime - testAvgResolutionTime) / baselineAvgResolutionTime) * 100
                : 0;
            // Determine if strategy is successful (improvement in success rate or resolution time)
            const isSuccessful = testCases.length >= 10 && (successRateImprovement > 0.05 || // 5% improvement in success rate
                resolutionTimeImprovement > 10 // 10% improvement in resolution time
            );
            const testMetrics = {
                testCases: testCases.length,
                testSuccessRate: testSuccessRate,
                testAvgResolutionTime: testAvgResolutionTime,
                baselineCases: baselineCases.length,
                baselineSuccessRate: baselineSuccessRate,
                baselineAvgResolutionTime: baselineAvgResolutionTime,
                successRateImprovement: successRateImprovement * 100, // Percentage
                resolutionTimeImprovement: resolutionTimeImprovement, // Percentage
                statisticalSignificance: this.calculateStatisticalSignificance(testCases.length, testResolved.length, baselineCases.length, baselineResolved.length),
            };
            const latencyMs = Date.now() - startTime;
            logger_1.logger.info("Strategy A/B test completed", {
                strategy,
                case_type: caseType,
                tenant_id: tenantId,
                success: isSuccessful,
                metrics: testMetrics,
                latencyMs,
            });
            metrics_1.metrics.increment("cases.strategy_ab_test.completed", {
                strategy,
                case_type: caseType,
                success: isSuccessful.toString(),
            });
            metrics_1.metrics.observe("cases.strategy_ab_test.latency", latencyMs);
            return {
                success: isSuccessful,
                metrics: testMetrics,
            };
        }
        catch (error) {
            logger_1.logger.error("Strategy A/B test failed", {
                strategy,
                case_type: caseType,
                tenant_id: tenantId,
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                success: false,
                metrics: {
                    testCases: 0,
                    successRate: 0,
                    avgResolutionTime: 0,
                },
            };
        }
    }
    /**
     * Calculate statistical significance between test and baseline groups
     * Uses chi-square test for success rates
     */
    calculateStatisticalSignificance(testTotal, testSuccess, baselineTotal, baselineSuccess) {
        if (testTotal === 0 || baselineTotal === 0) {
            return 0;
        }
        // Simplified chi-square test for two proportions
        const testRate = testSuccess / testTotal;
        const baselineRate = baselineSuccess / baselineTotal;
        if (testRate === baselineRate) {
            return 0;
        }
        // Pooled proportion
        const pooledRate = (testSuccess + baselineSuccess) / (testTotal + baselineTotal);
        // Standard error
        const se = Math.sqrt(pooledRate * (1 - pooledRate) * (1 / testTotal + 1 / baselineTotal));
        if (se === 0) {
            return 0;
        }
        // Z-score
        const z = (testRate - baselineRate) / se;
        // Convert to p-value approximation (two-tailed test)
        // Using normal distribution approximation
        const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));
        // Return significance (1 - p-value, so higher = more significant)
        return Math.max(0, Math.min(1, 1 - pValue));
    }
    /**
     * Cumulative distribution function for standard normal distribution
     * Approximation using error function
     */
    normalCDF(z) {
        // Approximation: erf(z / sqrt(2)) / 2 + 0.5
        const t = 1 / (1 + 0.2316419 * Math.abs(z));
        const d = 0.3989423 * Math.exp(-z * z / 2);
        const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        if (z > 0) {
            return 1 - p;
        }
        return p;
    }
    /**
     * Provide calibrated confidence scores
     */
    calibrateConfidence(rawConfidence, historicalAccuracy) {
        // Calibrate confidence based on historical accuracy
        // If we've been overconfident, reduce; if underconfident, increase
        const calibrationFactor = historicalAccuracy / rawConfidence;
        return Math.max(0, Math.min(1, rawConfidence * calibrationFactor));
    }
}
exports.LearningAgent = LearningAgent;
exports.learningAgent = new LearningAgent();
