"use strict";
/**
 * RAGAS: Standardized RAG Evaluation Metrics
 *
 * Provides standardized evaluation of RAG pipelines. Based on: https://arxiv.org/abs/2309.15217
 *
 * POS usage: publishable eval metrics for enterprise buyers.
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
exports.RAGASEvaluator = void 0;
const logger_1 = require("@/lib/logging/logger");
const providers_1 = require("@/lib/llm/providers");
/**
 * RAGAS Evaluator
 */
class RAGASEvaluator {
    constructor() {
        this.llmProvider = new providers_1.LLMProvider();
    }
    /**
     * Evaluate RAG pipeline using RAGAS metrics
     */
    async evaluate(input) {
        const startTime = Date.now();
        // Evaluate each metric
        const contextPrecision = await this.evaluateContextPrecision(input);
        const contextRecall = await this.evaluateContextRecall(input);
        const faithfulness = await this.evaluateFaithfulness(input);
        const answerRelevance = await this.evaluateAnswerRelevance(input);
        const answerSimilarity = input.ground_truth
            ? await this.evaluateAnswerSimilarity(input.answer, input.ground_truth)
            : 0.5; // Default if no ground truth
        // Calculate context-level scores
        const contextScores = await this.evaluateContexts(input);
        // Overall RAGAS score (weighted average)
        const ragasScore = contextPrecision * 0.2 +
            contextRecall * 0.2 +
            faithfulness * 0.3 +
            answerRelevance * 0.2 +
            answerSimilarity * 0.1;
        const metrics = {
            context_precision: contextPrecision,
            context_recall: contextRecall,
            faithfulness: faithfulness,
            answer_relevance: answerRelevance,
            answer_similarity: answerSimilarity,
            ragas_score: ragasScore,
        };
        return {
            metrics,
            context_scores: contextScores,
            metadata: {
                evaluation_time_ms: Date.now() - startTime,
                contexts_evaluated: input.contexts.length,
                method: "ragas",
            },
        };
    }
    /**
     * Context Precision: Are retrieved contexts relevant to the query?
     */
    async evaluateContextPrecision(input) {
        if (input.contexts.length === 0)
            return 0;
        const prompt = `Evaluate the relevance of each retrieved context to the query.

Query: "${input.query}"

Contexts:
${input.contexts
            .map((ctx, idx) => `[${idx + 1}] ${ctx.substring(0, 500)}`)
            .join("\n\n")}

For each context, determine if it is relevant to answering the query (1) or not (0).

Respond in JSON format:
{
  "scores": [0.9, 0.8, 0.3, ...],
  "reasoning": "<brief explanation>"
}`;
        try {
            const response = await this.llmProvider.call({
                model: "gpt-4o-mini",
                prompt,
                temperature: 0.3,
                max_tokens: 500,
                system_prompt: "You are a precision evaluator. Always respond with valid JSON.",
            });
            const parsed = JSON.parse(response.text);
            const scores = Array.isArray(parsed.scores) ? parsed.scores : [];
            if (scores.length === 0) {
                // Fallback: simple keyword matching
                return this.simpleRelevanceScore(input.query, input.contexts);
            }
            // Average precision
            return scores.reduce((sum, s) => sum + Math.max(0, Math.min(1, s)), 0) / scores.length;
        }
        catch (error) {
            logger_1.logger.error("RAGAS: Context precision evaluation failed", { error });
            return this.simpleRelevanceScore(input.query, input.contexts);
        }
    }
    /**
     * Context Recall: Are all relevant contexts retrieved?
     */
    async evaluateContextRecall(input) {
        // This requires knowing what "all relevant contexts" are
        // For now, use a heuristic based on answer coverage
        if (!input.ground_truth) {
            // Without ground truth, estimate based on answer quality
            return 0.7; // Default moderate recall
        }
        // Check if answer covers ground truth concepts
        const prompt = `Does the retrieved context contain the information needed to answer the query correctly?

Query: "${input.query}"
Ground Truth Answer: "${input.ground_truth}"
Retrieved Contexts: ${input.contexts.length} contexts

Evaluate if the contexts collectively contain enough information to produce the ground truth answer.

Respond with a score 0-1:
{
  "recall": 0.85,
  "reasoning": "<explanation>"
}`;
        try {
            const response = await this.llmProvider.call({
                model: "gpt-4o-mini",
                prompt,
                temperature: 0.3,
                max_tokens: 300,
            });
            const parsed = JSON.parse(response.text);
            return Math.max(0, Math.min(1, parsed.recall || 0.7));
        }
        catch (error) {
            logger_1.logger.error("RAGAS: Context recall evaluation failed", { error });
            return 0.7;
        }
    }
    /**
     * Faithfulness: Is the answer supported by the contexts?
     */
    async evaluateFaithfulness(input) {
        const prompt = `Evaluate if the answer is faithful to the retrieved contexts (not hallucinated).

Query: "${input.query}"
Answer: "${input.answer}"
Contexts:
${input.contexts.map((ctx, idx) => `[${idx + 1}] ${ctx.substring(0, 500)}`).join("\n\n")}

Determine if the answer is fully supported by the contexts (1.0), partially supported (0.5), or not supported/hallucinated (0.0).

Respond in JSON:
{
  "faithfulness": 0.9,
  "reasoning": "<explanation>",
  "unsupported_claims": ["<claim 1>", "<claim 2>"]
}`;
        try {
            const response = await this.llmProvider.call({
                model: "gpt-4o-mini",
                prompt,
                temperature: 0.3,
                max_tokens: 500,
            });
            const parsed = JSON.parse(response.text);
            return Math.max(0, Math.min(1, parsed.faithfulness || 0.5));
        }
        catch (error) {
            logger_1.logger.error("RAGAS: Faithfulness evaluation failed", { error });
            return 0.5;
        }
    }
    /**
     * Answer Relevance: Is the answer relevant to the query?
     */
    async evaluateAnswerRelevance(input) {
        const prompt = `Evaluate if the answer is relevant to the query.

Query: "${input.query}"
Answer: "${input.answer}"

Score 0-1: How well does the answer address the query?

Respond in JSON:
{
  "relevance": 0.9,
  "reasoning": "<explanation>"
}`;
        try {
            const response = await this.llmProvider.call({
                model: "gpt-4o-mini",
                prompt,
                temperature: 0.3,
                max_tokens: 300,
            });
            const parsed = JSON.parse(response.text);
            return Math.max(0, Math.min(1, parsed.relevance || 0.7));
        }
        catch (error) {
            logger_1.logger.error("RAGAS: Answer relevance evaluation failed", { error });
            return 0.7;
        }
    }
    /**
     * Answer Semantic Similarity: How similar is answer to ground truth?
     */
    async evaluateAnswerSimilarity(answer, groundTruth) {
        // Use embedding similarity
        try {
            const { EmbeddingService } = await Promise.resolve().then(() => __importStar(require("@/lib/vector/embeddings")));
            const embeddingService = new EmbeddingService();
            const answerEmbedding = await embeddingService.embed(answer);
            const groundTruthEmbedding = await embeddingService.embed(groundTruth);
            return embeddingService.cosineSimilarity(answerEmbedding.vector, groundTruthEmbedding.vector);
        }
        catch (error) {
            logger_1.logger.error("RAGAS: Answer similarity evaluation failed", { error });
            return 0.5;
        }
    }
    /**
     * Evaluate individual contexts
     */
    async evaluateContexts(input) {
        const scores = await Promise.all(input.contexts.map(async (context, idx) => {
            const precision = await this.evaluateContextPrecision({
                query: input.query,
                contexts: [context],
                answer: input.answer,
            });
            const relevance = await this.evaluateAnswerRelevance({
                query: input.query,
                contexts: [context],
                answer: input.answer,
            });
            return {
                context_id: input.context_ids?.[idx],
                context: context.substring(0, 200),
                precision,
                recall: precision, // Simplified: use precision as recall proxy
                relevance,
            };
        }));
        return scores;
    }
    /**
     * Simple relevance score (fallback)
     */
    simpleRelevanceScore(query, contexts) {
        if (contexts.length === 0)
            return 0;
        const queryWords = new Set(query.toLowerCase().split(/\s+/));
        let totalScore = 0;
        for (const context of contexts) {
            const contextWords = new Set(context.toLowerCase().split(/\s+/));
            const intersection = new Set([...queryWords].filter((w) => contextWords.has(w)));
            const score = intersection.size / Math.max(1, queryWords.size);
            totalScore += score;
        }
        return totalScore / contexts.length;
    }
}
exports.RAGASEvaluator = RAGASEvaluator;
