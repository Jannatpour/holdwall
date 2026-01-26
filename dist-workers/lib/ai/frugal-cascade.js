"use strict";
/**
 * FrugalGPT-style Cost/Quality Cascades
 *
 * Formalizes how to chain models to cut cost while preserving top performance.
 * Based on: https://openreview.net/forum?id=XUZ2S0JVJP
 *
 * POS usage: extract/cluster runs on low-cost models; judge/verification escalates only as needed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FrugalCascade = void 0;
const providers_1 = require("@/lib/llm/providers");
const logger_1 = require("@/lib/logging/logger");
/**
 * FrugalGPT Cascade: Chain models to optimize cost/quality tradeoff
 */
class FrugalCascade {
    constructor() {
        this.llmProvider = new providers_1.LLMProvider();
    }
    /**
     * Execute cascade: try cheaper models first, escalate if quality insufficient
     */
    async execute(request, config) {
        const stages = config.stages;
        if (stages.length === 0) {
            throw new Error("Cascade must have at least one stage");
        }
        const stagesAttempted = [];
        const costsPerStage = [];
        const qualityScoresPerStage = [];
        let totalCost = 0;
        let escalated = false;
        for (let i = 0; i < stages.length; i++) {
            const stage = stages[i];
            stagesAttempted.push(i);
            try {
                // Execute request with this stage's model
                const stageRequest = {
                    ...request,
                    model: stage.model,
                    max_tokens: stage.max_tokens || request.max_tokens,
                    temperature: stage.temperature ?? request.temperature,
                };
                const response = await this.llmProvider.call(stageRequest);
                // Calculate cost
                const tokensUsed = response.tokens_used || 1000; // Estimate if not provided
                const cost = (tokensUsed / 1000) * stage.cost_per_1k_tokens;
                totalCost += cost;
                costsPerStage.push(cost);
                // Evaluate quality
                let qualityScore = 1.0; // Default: assume good
                if (config.quality_evaluator) {
                    qualityScore = await config.quality_evaluator(response, stageRequest);
                }
                else {
                    // Default quality evaluation: check if response is non-empty and reasonable length
                    const responseLength = response.text.length;
                    const expectedLength = stageRequest.max_tokens || 1000;
                    qualityScore = Math.min(1, responseLength / Math.max(1, expectedLength * 0.1));
                }
                qualityScoresPerStage.push(qualityScore);
                // Check if quality is sufficient
                if (qualityScore >= stage.quality_threshold) {
                    // Quality sufficient, return this result
                    return {
                        response,
                        stage_used: i,
                        total_cost: totalCost,
                        quality_score: qualityScore,
                        escalated: escalated,
                        metadata: {
                            stages_attempted: stagesAttempted,
                            costs_per_stage: costsPerStage,
                            quality_scores_per_stage: qualityScoresPerStage,
                        },
                    };
                }
                // Quality insufficient, escalate to next stage
                escalated = true;
                logger_1.logger.info("FrugalCascade: Escalating to next stage", {
                    stage: i,
                    quality_score: qualityScore,
                    threshold: stage.quality_threshold,
                });
                // Early stop if configured and we've tried enough stages
                if (config.early_stop && i >= 1) {
                    // Use best result so far
                    const bestStage = qualityScoresPerStage.indexOf(Math.max(...qualityScoresPerStage));
                    // Re-execute best stage if needed, or use last response
                    return {
                        response,
                        stage_used: bestStage >= 0 ? bestStage : i,
                        total_cost: totalCost,
                        quality_score: qualityScoresPerStage[bestStage >= 0 ? bestStage : i],
                        escalated: true,
                        metadata: {
                            stages_attempted: stagesAttempted,
                            costs_per_stage: costsPerStage,
                            quality_scores_per_stage: qualityScoresPerStage,
                        },
                    };
                }
            }
            catch (error) {
                logger_1.logger.error("FrugalCascade: Stage failed", { stage: i, error, model: stage.model });
                // If this is the last stage, throw
                if (i === stages.length - 1) {
                    throw error;
                }
                // Otherwise, continue to next stage
                escalated = true;
                costsPerStage.push(0);
                qualityScoresPerStage.push(0);
            }
        }
        // If we get here, all stages were attempted but none met quality threshold
        // Return the last (most expensive) result
        const lastStage = stagesAttempted[stagesAttempted.length - 1];
        const lastQuality = qualityScoresPerStage[qualityScoresPerStage.length - 1];
        // Re-execute last stage to get response
        const lastStageRequest = {
            ...request,
            model: stages[lastStage].model,
            max_tokens: stages[lastStage].max_tokens || request.max_tokens,
            temperature: stages[lastStage].temperature ?? request.temperature,
        };
        const finalResponse = await this.llmProvider.call(lastStageRequest);
        return {
            response: finalResponse,
            stage_used: lastStage,
            total_cost: totalCost,
            quality_score: lastQuality,
            escalated: true,
            metadata: {
                stages_attempted: stagesAttempted,
                costs_per_stage: costsPerStage,
                quality_scores_per_stage: qualityScoresPerStage,
            },
        };
    }
    /**
     * Create default cascade config for common task types
     */
    static createDefaultConfig(taskType) {
        if (taskType === "extract" || taskType === "cluster") {
            // Simple tasks: start with cheapest, escalate if needed
            return {
                stages: [
                    {
                        model: "gpt-4o-mini",
                        provider: "openai",
                        cost_per_1k_tokens: 0.15, // $0.15/1k tokens
                        quality_threshold: 0.7,
                    },
                    {
                        model: "gpt-4o",
                        provider: "openai",
                        cost_per_1k_tokens: 2.50, // $2.50/1k tokens
                        quality_threshold: 0.9,
                    },
                ],
                early_stop: true,
            };
        }
        else if (taskType === "judge") {
            // Judgment tasks: need higher quality, start with mid-tier
            return {
                stages: [
                    {
                        model: "gpt-4o",
                        provider: "openai",
                        cost_per_1k_tokens: 2.50,
                        quality_threshold: 0.85,
                    },
                    {
                        model: "gpt-4o",
                        provider: "openai",
                        cost_per_1k_tokens: 2.50,
                        quality_threshold: 0.95,
                        temperature: 0.1, // Lower temperature for more consistent judgment
                    },
                ],
                early_stop: false,
            };
        }
        else {
            // Generation tasks: balance cost and quality
            return {
                stages: [
                    {
                        model: "gpt-4o-mini",
                        provider: "openai",
                        cost_per_1k_tokens: 0.15,
                        quality_threshold: 0.6,
                    },
                    {
                        model: "gpt-4o",
                        provider: "openai",
                        cost_per_1k_tokens: 2.50,
                        quality_threshold: 0.85,
                    },
                ],
                early_stop: true,
            };
        }
    }
}
exports.FrugalCascade = FrugalCascade;
