"use strict";
/**
 * DSPy: Compile-and-Optimize Pipeline Programming
 *
 * Treats prompt + retrieval + verification as a program that can be optimized
 * against golden sets. Based on: https://hai.stanford.edu/research/dspy-compiling-declarative-language-model-calls-into-state-of-the-art-pipelines
 *
 * POS usage: systematic improvement without hand-tuning prompts, and regression-proof upgrades.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DSPyPipelineOptimizer = void 0;
const providers_1 = require("@/lib/llm/providers");
const logger_1 = require("@/lib/logging/logger");
/**
 * DSPy Pipeline Optimizer
 */
class DSPyPipelineOptimizer {
    constructor() {
        this.llmProvider = new providers_1.LLMProvider();
    }
    /**
     * Compile pipeline: optimize all modules against golden set
     */
    async compile(pipeline, options = {}) {
        const maxIterations = options.max_iterations || 3;
        const metricWeights = options.metric_weights || { accuracy: 1.0 };
        const strategy = options.optimization_strategy || "greedy";
        logger_1.logger.info("DSPy: Starting pipeline compilation", {
            pipeline_id: pipeline.id,
            modules: pipeline.modules.length,
            golden_set_size: pipeline.golden_set.length,
        });
        // Optimize each module sequentially
        const optimizedModules = [];
        for (const pipelineModule of pipeline.modules) {
            logger_1.logger.info("DSPy: Optimizing module", { module_id: pipelineModule.id, module_name: pipelineModule.name });
            const optimized = await this.optimizeModule(pipelineModule, pipeline.golden_set, pipeline.metrics, metricWeights, strategy, maxIterations);
            optimizedModules.push(optimized);
        }
        return {
            ...pipeline,
            modules: optimizedModules,
        };
    }
    /**
     * Optimize a single module
     */
    async optimizeModule(module, goldenSet, metrics, metricWeights, strategy, maxIterations) {
        let currentModule = module;
        let bestScore = -Infinity;
        let bestModule = module;
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            // Evaluate current module
            const metricsBefore = await this.evaluateModule(currentModule, goldenSet, metrics);
            // Generate candidate optimizations
            const candidates = await this.generateCandidates(currentModule, goldenSet, strategy);
            // Evaluate candidates
            let bestCandidate = currentModule;
            let bestCandidateScore = this.computeScore(metricsBefore, metricWeights);
            for (const candidate of candidates) {
                const candidateMetrics = await this.evaluateModule(candidate, goldenSet, metrics);
                const candidateScore = this.computeScore(candidateMetrics, metricWeights);
                if (candidateScore > bestCandidateScore) {
                    bestCandidate = candidate;
                    bestCandidateScore = candidateScore;
                }
            }
            // If improvement found, update
            if (bestCandidateScore > bestScore) {
                bestScore = bestCandidateScore;
                bestModule = bestCandidate;
                currentModule = bestCandidate;
                // Record optimization
                const optimization = {
                    run_id: `opt-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                    timestamp: new Date().toISOString(),
                    metrics_before: metricsBefore,
                    metrics_after: await this.evaluateModule(bestCandidate, goldenSet, metrics),
                    optimized_template: bestCandidate.prompt_template,
                    optimized_parameters: bestCandidate.parameters,
                    improvement: this.computeImprovement(metricsBefore, await this.evaluateModule(bestCandidate, goldenSet, metrics)),
                };
                bestModule.optimization_history.push(optimization);
            }
            else {
                // No improvement, stop early
                break;
            }
        }
        return bestModule;
    }
    /**
     * Generate candidate optimizations for a module
     */
    async generateCandidates(module, goldenSet, strategy) {
        const candidates = [];
        // Strategy 1: Prompt template variations
        const templateVariations = await this.generateTemplateVariations(module, goldenSet);
        candidates.push(...templateVariations);
        // Strategy 2: Parameter tuning
        const parameterVariations = this.generateParameterVariations(module);
        candidates.push(...parameterVariations);
        // Limit candidates based on strategy
        if (strategy === "greedy") {
            return candidates.slice(0, 3); // Top 3
        }
        else if (strategy === "beam") {
            return candidates.slice(0, 10); // Top 10
        }
        else {
            return candidates; // All candidates for MIP
        }
    }
    /**
     * Generate prompt template variations using LLM
     */
    async generateTemplateVariations(module, goldenSet) {
        const examples = goldenSet.slice(0, 3).map((ex) => ({
            input: ex.input,
            output: ex.expected_output,
        }));
        const optimizationPrompt = `You are a prompt optimization expert. Given a module and example inputs/outputs, suggest improved prompt templates.

Current Template:
${module.prompt_template}

Example Inputs/Outputs:
${JSON.stringify(examples, null, 2)}

Generate 2-3 improved prompt templates that are:
1. More specific and clear
2. Better structured for the task
3. Include better instructions

Return JSON array of templates:
[
  {
    "template": "<improved template>",
    "reasoning": "<why this is better>"
  }
]`;
        try {
            const response = await this.llmProvider.call({
                model: "gpt-4o-mini",
                prompt: optimizationPrompt,
                temperature: 0.7,
                max_tokens: 1000,
            });
            const parsed = JSON.parse(response.text);
            const templates = Array.isArray(parsed) ? parsed : [parsed];
            return templates.map((t) => ({
                ...module,
                prompt_template: t.template,
                parameters: {
                    ...module.parameters,
                    optimization_reasoning: t.reasoning,
                },
            }));
        }
        catch (error) {
            logger_1.logger.error("DSPy: Failed to generate template variations", { error, module_id: module.id });
            return [];
        }
    }
    /**
     * Generate parameter variations
     */
    generateParameterVariations(module) {
        const variations = [];
        // Temperature variations
        for (const temp of [0.3, 0.5, 0.7]) {
            variations.push({
                ...module,
                parameters: {
                    ...module.parameters,
                    temperature: temp,
                },
            });
        }
        // Max tokens variations
        const currentMaxTokens = module.parameters.max_tokens || 1000;
        for (const maxTokens of [currentMaxTokens * 0.8, currentMaxTokens * 1.2]) {
            variations.push({
                ...module,
                parameters: {
                    ...module.parameters,
                    max_tokens: Math.round(maxTokens),
                },
            });
        }
        return variations;
    }
    /**
     * Evaluate module against golden set
     */
    async evaluateModule(module, goldenSet, metrics) {
        const results = [];
        for (const example of goldenSet.slice(0, 10)) { // Limit to 10 for speed
            try {
                const result = await this.executeModule(module, example.input);
                results.push(result);
            }
            catch (error) {
                logger_1.logger.warn("DSPy: Module execution failed", { error, module_id: module.id });
            }
        }
        // Compute metrics
        const computedMetrics = {};
        for (const metric of metrics) {
            if (metric === "accuracy") {
                computedMetrics.accuracy = this.computeAccuracy(results, goldenSet);
            }
            else if (metric === "latency") {
                computedMetrics.latency = this.computeAverageLatency(results);
            }
            else if (metric === "cost") {
                computedMetrics.cost = this.computeAverageCost(results);
            }
        }
        return computedMetrics;
    }
    /**
     * Execute a module with given input
     */
    async executeModule(module, input) {
        const startTime = Date.now();
        // Build prompt from template and input
        let prompt = module.prompt_template;
        for (const [key, value] of Object.entries(input)) {
            prompt = prompt.replace(new RegExp(`\\{${key}\\}`, "g"), value);
        }
        // Execute LLM call
        const response = await this.llmProvider.call({
            model: module.parameters.model || "gpt-4o-mini",
            prompt,
            temperature: module.parameters.temperature || 0.7,
            max_tokens: module.parameters.max_tokens || 1000,
        });
        const latency = Date.now() - startTime;
        const cost = (response.tokens_used || 1000) / 1000 * 0.001; // Rough estimate
        // Parse output (simple extraction for now)
        const output = {};
        for (const key of module.output_signature) {
            // Try to extract from response text
            const regex = new RegExp(`${key}:\\s*(.+?)(?:\\n|$)`, "i");
            const match = response.text.match(regex);
            output[key] = match ? match[1].trim() : "";
        }
        return {
            module_id: module.id,
            input,
            output,
            metrics: {},
            latency_ms: latency,
            cost_usd: cost,
        };
    }
    /**
     * Compute accuracy metric
     */
    computeAccuracy(results, goldenSet) {
        if (results.length === 0)
            return 0;
        let correct = 0;
        for (let i = 0; i < Math.min(results.length, goldenSet.length); i++) {
            const result = results[i];
            const expected = goldenSet[i].expected_output;
            // Simple exact match for now
            let matches = true;
            for (const key of Object.keys(expected)) {
                if (result.output[key] !== expected[key]) {
                    matches = false;
                    break;
                }
            }
            if (matches)
                correct++;
        }
        return correct / results.length;
    }
    /**
     * Compute average latency
     */
    computeAverageLatency(results) {
        if (results.length === 0)
            return 0;
        return results.reduce((sum, r) => sum + r.latency_ms, 0) / results.length;
    }
    /**
     * Compute average cost
     */
    computeAverageCost(results) {
        if (results.length === 0)
            return 0;
        return results.reduce((sum, r) => sum + r.cost_usd, 0) / results.length;
    }
    /**
     * Compute weighted score from metrics
     */
    computeScore(metrics, weights) {
        let score = 0;
        let totalWeight = 0;
        for (const [metric, value] of Object.entries(metrics)) {
            const weight = weights[metric] || 0;
            score += value * weight;
            totalWeight += weight;
        }
        return totalWeight > 0 ? score / totalWeight : 0;
    }
    /**
     * Compute improvement delta
     */
    computeImprovement(before, after) {
        const improvement = {};
        for (const key of Object.keys(after)) {
            const beforeValue = before[key] || 0;
            const afterValue = after[key] || 0;
            improvement[key] = afterValue - beforeValue;
        }
        return improvement;
    }
    /**
     * Save optimized pipeline
     */
    async savePipeline(pipeline) {
        try {
            // In production, save to database
            // For now, just log
            logger_1.logger.info("DSPy: Pipeline saved", { pipeline_id: pipeline.id });
        }
        catch (error) {
            logger_1.logger.error("DSPy: Failed to save pipeline", { error, pipeline_id: pipeline.id });
        }
    }
    /**
     * Load pipeline
     */
    async loadPipeline(pipelineId) {
        try {
            // In production, load from database
            // For now, return null
            return null;
        }
        catch (error) {
            logger_1.logger.error("DSPy: Failed to load pipeline", { error, pipeline_id: pipelineId });
            return null;
        }
    }
}
exports.DSPyPipelineOptimizer = DSPyPipelineOptimizer;
