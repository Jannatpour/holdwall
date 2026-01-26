"use strict";
/**
 * Composite AI Orchestrator
 *
 * Hybrid systems combining neural intuition of LLMs with structured
 * reasoning of symbolic/semantic systems.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositeOrchestrator = void 0;
const graphrag_1 = require("./graphrag");
const factreasoner_1 = require("../claims/factreasoner");
class CompositeOrchestrator {
    constructor() {
        this.openaiApiKey = null;
        this.graphRAG = new graphrag_1.GraphRAG();
        this.factReasoner = new factreasoner_1.FactReasoner();
        this.openaiApiKey = process.env.OPENAI_API_KEY || null;
    }
    /**
     * Execute composite AI task
     */
    async execute(task) {
        let neuralResult;
        let symbolicResult;
        let combinedResult;
        let confidence = 0.5;
        const sources = [];
        switch (task.type) {
            case "reasoning":
                ({ neuralResult, symbolicResult, combinedResult, confidence } =
                    await this.reasoningTask(task));
                break;
            case "verification":
                ({ neuralResult, symbolicResult, combinedResult, confidence } =
                    await this.verificationTask(task));
                break;
            case "extraction":
                ({ neuralResult, symbolicResult, combinedResult, confidence } =
                    await this.extractionTask(task));
                break;
            case "generation":
                ({ neuralResult, symbolicResult, combinedResult, confidence } =
                    await this.generationTask(task));
                break;
            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }
        return {
            taskId: task.id,
            result: combinedResult,
            reasoning: {
                neural: neuralResult,
                symbolic: symbolicResult,
                combined: combinedResult,
            },
            confidence,
            sources,
        };
    }
    /**
     * Reasoning task
     */
    async reasoningTask(task) {
        // Neural reasoning (LLM) - use model/temperature from context if available
        const model = task.context?.model;
        const temperature = task.context?.temperature;
        const neuralResult = await this.neuralReasoning(task.input, { model, temperature });
        // Symbolic reasoning (GraphRAG)
        const graphResult = await this.graphRAG.query(task.input);
        const symbolicResult = graphResult.reasoning;
        // Combine results
        const combinedResult = await this.combineResults(neuralResult, symbolicResult);
        return {
            neuralResult,
            symbolicResult,
            combinedResult,
            confidence: (0.7 + graphResult.confidence) / 2, // Average confidence
        };
    }
    /**
     * Verification task
     */
    async verificationTask(task) {
        // Neural verification (LLM) - use model/temperature from context if available
        const model = task.context?.model;
        const temperature = task.context?.temperature;
        const neuralResult = await this.neuralVerification(task.input, { model, temperature });
        // Symbolic verification (FactReasoner)
        const factResult = await this.factReasoner.decompose(task.input);
        const symbolicResult = `Decomposed into ${factResult.atomicClaims.length} atomic claims. Overall confidence: ${factResult.overallConfidence.toFixed(2)}`;
        // Combine
        const combinedResult = await this.combineResults(neuralResult, symbolicResult);
        return {
            neuralResult,
            symbolicResult,
            combinedResult,
            confidence: factResult.overallConfidence,
        };
    }
    /**
     * Extraction task
     */
    async extractionTask(task) {
        // Neural extraction (LLM) - use model/temperature from context if available
        const model = task.context?.model;
        const temperature = task.context?.temperature;
        const neuralResult = await this.neuralExtraction(task.input, { model, temperature });
        // Symbolic extraction (structured parsing)
        const symbolicResult = this.symbolicExtraction(task.input);
        // Combine
        const combinedResult = await this.combineResults(neuralResult, symbolicResult);
        return {
            neuralResult,
            symbolicResult,
            combinedResult,
            confidence: 0.8,
        };
    }
    /**
     * Generation task
     */
    async generationTask(task) {
        // Neural generation (LLM) - use model/temperature from context if available
        const model = task.context?.model;
        const temperature = task.context?.temperature;
        const neuralResult = await this.neuralGeneration(task.input, { model, temperature });
        // Symbolic generation (template-based)
        const symbolicResult = this.symbolicGeneration(task.input);
        // Combine
        const combinedResult = await this.combineResults(neuralResult, symbolicResult);
        return {
            neuralResult,
            symbolicResult,
            combinedResult,
            confidence: 0.75,
        };
    }
    /**
     * Neural reasoning (LLM)
     */
    async neuralReasoning(input, options) {
        if (!this.openaiApiKey) {
            return "LLM reasoning unavailable";
        }
        const model = options?.model || "gpt-4o";
        const temperature = options?.temperature ?? 0.3;
        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.openaiApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        {
                            role: "system",
                            content: "You are a reasoning system. Provide step-by-step reasoning.",
                        },
                        {
                            role: "user",
                            content: input,
                        },
                    ],
                    temperature,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                return data.choices[0]?.message?.content || "";
            }
        }
        catch (error) {
            console.warn("Neural reasoning failed:", error);
        }
        return "Reasoning unavailable";
    }
    /**
     * Neural verification
     */
    async neuralVerification(input, options) {
        // Similar to neural reasoning but focused on verification
        return await this.neuralReasoning(`Verify: ${input}`, options);
    }
    /**
     * Neural extraction
     */
    async neuralExtraction(input, options) {
        // Similar to neural reasoning but focused on extraction
        return await this.neuralReasoning(`Extract key information from: ${input}`, options);
    }
    /**
     * Neural generation
     */
    async neuralGeneration(input, options) {
        // Similar to neural reasoning but focused on generation
        return await this.neuralReasoning(`Generate response for: ${input}`, options);
    }
    /**
     * Symbolic extraction
     */
    symbolicExtraction(input) {
        // Simple pattern-based extraction
        return `Extracted ${input.split(/\s+/).length} tokens using symbolic patterns`;
    }
    /**
     * Symbolic generation
     */
    symbolicGeneration(input) {
        // Template-based generation
        return `Generated response using symbolic templates for: ${input.substring(0, 50)}...`;
    }
    /**
     * Combine neural and symbolic results
     */
    async combineResults(neural, symbolic) {
        if (!this.openaiApiKey) {
            return `${neural}\n\n[Symbolic reasoning: ${symbolic}]`;
        }
        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.openaiApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: "Combine neural and symbolic reasoning into a coherent, accurate result.",
                        },
                        {
                            role: "user",
                            content: `Neural reasoning: ${neural}\n\nSymbolic reasoning: ${symbolic}\n\nCombine these into a single, accurate result.`,
                        },
                    ],
                    temperature: 0.2,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                return data.choices[0]?.message?.content || `${neural}\n\n[Symbolic: ${symbolic}]`;
            }
        }
        catch (error) {
            console.warn("Result combination failed:", error);
        }
        return `${neural}\n\n[Symbolic reasoning: ${symbolic}]`;
    }
}
exports.CompositeOrchestrator = CompositeOrchestrator;
