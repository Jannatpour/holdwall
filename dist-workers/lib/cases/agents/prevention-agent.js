"use strict";
/**
 * Prevention Agent
 *
 * Predictive issue prevention agent.
 * Part of the 8-agent autonomous architecture.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.preventionAgent = exports.PreventionAgent = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
const orchestrator_1 = require("@/lib/ai/orchestrator");
const vault_db_1 = require("@/lib/evidence/vault-db");
const orchestrator = new orchestrator_1.AIOrchestrator(new vault_db_1.DatabaseEvidenceVault());
/**
 * Prevention Agent
 *
 * Predictive issue prevention
 */
class PreventionAgent {
    /**
     * Predict potential issues
     */
    async predictIssues(tenantId) {
        const predictions = [];
        // Analyze recent case patterns
        const recentCases = await client_1.db.case.findMany({
            where: {
                tenantId,
                createdAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                },
            },
            take: 100,
        });
        // Detect emerging patterns
        const patterns = this.detectEmergingPatterns(recentCases);
        // Generate predictions
        for (const [key, trend] of patterns.entries()) {
            const prediction = await this.generatePrediction({ key, trend }, tenantId);
            if (prediction) {
                predictions.push(prediction);
            }
        }
        logger_1.logger.info("Issue predictions generated", {
            tenant_id: tenantId,
            predictions_count: predictions.length,
        });
        return predictions;
    }
    /**
     * Detect emerging patterns
     */
    detectEmergingPatterns(cases) {
        const patterns = new Map();
        // Group by type and severity
        for (const case_ of cases) {
            const key = `${case_.type}_${case_.severity}`;
            patterns.set(key, (patterns.get(key) || 0) + 1);
        }
        // Identify trends (cases in last 7 days vs previous 7 days)
        const recent = cases.filter((c) => c.createdAt.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000);
        const previous = cases.filter((c) => c.createdAt.getTime() > Date.now() - 14 * 24 * 60 * 60 * 1000 &&
            c.createdAt.getTime() <= Date.now() - 7 * 24 * 60 * 60 * 1000);
        const trendingPatterns = new Map();
        for (const case_ of recent) {
            const key = `${case_.type}_${case_.severity}`;
            const recentCount = recent.filter((c) => `${c.type}_${c.severity}` === key).length;
            const previousCount = previous.filter((c) => `${c.type}_${c.severity}` === key).length;
            if (recentCount > previousCount * 1.5) {
                // 50% increase indicates trend
                trendingPatterns.set(key, recentCount / previousCount);
            }
        }
        return trendingPatterns;
    }
    /**
     * Generate prediction from pattern
     */
    async generatePrediction(pattern, tenantId) {
        const [type, severity] = pattern.key.split("_");
        // Use AI to predict future issues
        const prompt = `Based on recent increase in ${type} cases with ${severity} severity (${(pattern.trend * 100).toFixed(0)}% increase), predict potential future issues and recommend prevention actions.

Return JSON:
{
  "issueType": "Type of issue likely to occur",
  "probability": 0.0-1.0,
  "timeframe": "immediate|24h|7d|30d",
  "recommendedActions": ["action1", "action2"],
  "confidence": 0.0-1.0
}`;
        try {
            const response = await orchestrator.orchestrate({
                query: prompt,
                tenant_id: tenantId,
                use_rag: true,
                model: "gemini-3-pro",
                temperature: 0.3,
                max_tokens: 500,
            });
            const jsonMatch = response.response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    issueType: parsed.issueType || type,
                    probability: Math.max(0, Math.min(1, Number(parsed.probability) || 0.5)),
                    timeframe: parsed.timeframe || "7d",
                    recommendedActions: Array.isArray(parsed.recommendedActions)
                        ? parsed.recommendedActions
                        : [],
                    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.7)),
                };
            }
        }
        catch (error) {
            logger_1.logger.error("Failed to generate prediction", { error });
        }
        return null;
    }
    /**
     * Early warning system
     */
    async generateEarlyWarnings(tenantId) {
        const warnings = [];
        // Check for SLA breaches
        const { caseSLAService } = await Promise.resolve().then(() => __importStar(require("../sla")));
        const slaCheck = await caseSLAService.checkSLACompliance(tenantId);
        if (slaCheck.breached > 0) {
            warnings.push({
                warning: `${slaCheck.breached} cases have breached SLA`,
                severity: "high",
                recommendedAction: "Immediately review and resolve breached cases",
            });
        }
        if (slaCheck.atRisk > 5) {
            warnings.push({
                warning: `${slaCheck.atRisk} cases are at risk of SLA breach`,
                severity: "medium",
                recommendedAction: "Prioritize at-risk cases",
            });
        }
        // Check for escalation trends
        const recentEscalations = await client_1.db.caseEscalation.findMany({
            where: {
                case: {
                    tenantId,
                },
                createdAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
            },
        });
        if (recentEscalations.length > 10) {
            warnings.push({
                warning: `High escalation rate: ${recentEscalations.length} escalations in last 7 days`,
                severity: "medium",
                recommendedAction: "Review escalation triggers and case assignment",
            });
        }
        return warnings;
    }
    /**
     * Proactive resolution
     */
    async suggestProactiveResolutions(tenantId) {
        // Analyze patterns and suggest proactive actions
        const predictions = await this.predictIssues(tenantId);
        return predictions
            .filter((p) => p.probability > 0.7)
            .map((p) => ({
            issue: p.issueType,
            resolution: p.recommendedActions.join(", "),
            priority: p.probability > 0.8 ? "high" : p.probability > 0.75 ? "medium" : "low",
        }));
    }
    /**
     * Risk forecasting
     */
    async forecastRisk(tenantId, days = 30) {
        // Analyze historical trends
        const historicalCases = await client_1.db.case.findMany({
            where: {
                tenantId,
                createdAt: {
                    gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
                },
            },
        });
        // Calculate average daily case volume
        const avgDailyVolume = historicalCases.length / days;
        // Predict future volume
        const predictedCases = Math.round(avgDailyVolume * days);
        // Predict severity distribution
        const severityCounts = {};
        historicalCases.forEach((c) => {
            severityCounts[c.severity] = (severityCounts[c.severity] || 0) + 1;
        });
        const predictedSeverity = {};
        for (const [severity, count] of Object.entries(severityCounts)) {
            predictedSeverity[severity] = Math.round((count / historicalCases.length) * predictedCases);
        }
        // Identify risk factors
        const riskFactors = [];
        if (predictedCases > 100) {
            riskFactors.push("High predicted case volume");
        }
        if (predictedSeverity.CRITICAL > 10) {
            riskFactors.push("High number of predicted critical cases");
        }
        return {
            predictedCases,
            predictedSeverity,
            riskFactors,
        };
    }
}
exports.PreventionAgent = PreventionAgent;
exports.preventionAgent = new PreventionAgent();
