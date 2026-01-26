"use strict";
/**
 * Recursive RAG (Recursive Retrieval-Augmented Generation)
 *
 * Recursive RAG breaks down complex queries into sub-queries, retrieves evidence for each,
 * and then synthesizes the final answer. This is particularly effective for multi-hop
 * reasoning and complex information needs.
 *
 * Based on: "Recursive Retrieval-Augmented Generation" (2024)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecursiveRAG = void 0;
const rag_1 = require("./rag");
const providers_1 = require("@/lib/llm/providers");
const logger_1 = require("@/lib/logging/logger");
class RecursiveRAG {
    constructor(evidenceVault, config) {
        this.ragPipeline = new rag_1.RAGPipeline(evidenceVault);
        this.llmProvider = new providers_1.LLMProvider();
        this.config = {
            maxDepth: 3,
            maxSubQueries: 5,
            enableSynthesis: true,
            minRelevanceForSubQuery: 0.3,
            ...config,
        };
    }
    /**
     * Execute recursive RAG: decompose query, retrieve for sub-queries, synthesize
     */
    async execute(query, tenantId, options) {
        const startTime = Date.now();
        const model = options?.model || "gpt-4o";
        const subQueries = [];
        let allEvidence = [];
        let totalRetrievals = 0;
        let totalGenerations = 0;
        let totalTokens = 0;
        let totalCost = 0;
        let maxDepth = 0;
        // Step 1: Decompose query into sub-queries
        const initialSubQueries = await this.decomposeQuery(query, 0, model);
        subQueries.push(...initialSubQueries);
        maxDepth = Math.max(maxDepth, 0);
        // Step 2: Process sub-queries recursively
        const queue = [
            ...initialSubQueries.map((sq) => ({ query: sq.query, depth: sq.depth, parentQuery: sq.parentQuery })),
        ];
        while (queue.length > 0) {
            const current = queue.shift();
            if (current.depth >= this.config.maxDepth) {
                continue; // Skip if max depth reached
            }
            // Retrieve evidence for this sub-query
            totalRetrievals++;
            const retrieved = await this.ragPipeline.retrieve(current.query, tenantId, {
                limit: 5,
                useReranking: true,
            });
            // Update sub-query with evidence
            const subQuery = subQueries.find((sq) => sq.query === current.query && sq.depth === current.depth);
            if (subQuery) {
                subQuery.evidence = retrieved;
                allEvidence = [...allEvidence, ...retrieved];
            }
            // Generate answer for this sub-query
            if (retrieved.length > 0) {
                totalGenerations++;
                const answer = await this.answerSubQuery(current.query, retrieved, model, options);
                if (subQuery) {
                    subQuery.answer = answer;
                }
                // Check if we need to decompose further
                const needsDecomposition = await this.needsFurtherDecomposition(current.query, answer, retrieved, model);
                if (needsDecomposition && current.depth < this.config.maxDepth - 1) {
                    // Decompose into deeper sub-queries
                    const deeperSubQueries = await this.decomposeQuery(current.query, current.depth + 1, model, current.query);
                    for (const deeperSq of deeperSubQueries) {
                        subQueries.push(deeperSq);
                        queue.push({
                            query: deeperSq.query,
                            depth: deeperSq.depth,
                            parentQuery: deeperSq.parentQuery,
                        });
                        maxDepth = Math.max(maxDepth, deeperSq.depth);
                    }
                }
            }
        }
        // Step 3: Synthesize final answer
        let finalResponse;
        if (this.config.enableSynthesis && subQueries.length > 0) {
            totalGenerations++;
            const synthesisResponse = await this.synthesizeAnswer(query, subQueries, allEvidence, model, options);
            finalResponse = synthesisResponse.text;
            totalTokens += synthesisResponse.tokens_used;
            totalCost += synthesisResponse.cost;
        }
        else {
            // Use answer from first sub-query if no synthesis
            finalResponse = subQueries[0]?.answer || "Unable to generate answer.";
        }
        const totalTime = Date.now() - startTime;
        return {
            response: finalResponse,
            evidence: allEvidence,
            subQueries,
            depth: maxDepth,
            metadata: {
                totalRetrievals,
                totalGenerations,
                totalTime,
                tokensUsed: totalTokens,
                cost: totalCost,
            },
        };
    }
    /**
     * Decompose query into sub-queries
     */
    async decomposeQuery(query, depth, model, parentQuery) {
        const prompt = `Decompose this query into ${this.config.maxSubQueries} or fewer sub-queries that need to be answered to fully address the original query.

Original Query: "${query}"
${parentQuery ? `Parent Query: "${parentQuery}"` : ""}
Depth: ${depth}

Respond with a JSON array of sub-queries:
[
  {"query": "sub-query 1"},
  {"query": "sub-query 2"},
  ...
]

Each sub-query should be:
- Specific and answerable
- Focused on one aspect
- Necessary for answering the original query`;
        try {
            const response = await this.llmProvider.call({
                model: "gpt-4o-mini", // Use fast model for decomposition
                prompt,
                temperature: 0.3,
                max_tokens: 500,
            });
            const parsed = JSON.parse(response.text.trim());
            const queries = Array.isArray(parsed) ? parsed : parsed.queries || [];
            return queries.slice(0, this.config.maxSubQueries).map((q) => ({
                query: typeof q === "string" ? q : q.query,
                depth,
                parentQuery,
                evidence: [],
            }));
        }
        catch (error) {
            logger_1.logger.warn("Recursive RAG: decomposition failed, using original query", { error });
            return [
                {
                    query,
                    depth,
                    parentQuery,
                    evidence: [],
                },
            ];
        }
    }
    /**
     * Answer a sub-query with retrieved evidence
     */
    async answerSubQuery(query, evidence, model, options) {
        const prompt = this.buildSubQueryPrompt(query, evidence);
        const response = await this.llmProvider.call({
            model,
            prompt,
            temperature: options?.temperature || 0.7,
            max_tokens: options?.maxTokens || 1000,
            system_prompt: "You are a helpful assistant. Answer the sub-query using the provided evidence. Be concise and focused.",
        });
        return response.text;
    }
    /**
     * Check if sub-query needs further decomposition
     */
    async needsFurtherDecomposition(query, answer, evidence, model) {
        const prompt = `Determine if this sub-query needs to be decomposed further into even more specific sub-queries.

Sub-query: "${query}"
Answer: "${answer.substring(0, 500)}"
Evidence retrieved: ${evidence.length} pieces

Respond with JSON:
{
  "needs_decomposition": true/false,
  "reasoning": "brief explanation"
}`;
        try {
            const response = await this.llmProvider.call({
                model: "gpt-4o-mini",
                prompt,
                temperature: 0.1,
                max_tokens: 100,
            });
            const parsed = JSON.parse(response.text.trim());
            return parsed.needs_decomposition === true;
        }
        catch (error) {
            return false; // Default to no further decomposition
        }
    }
    /**
     * Synthesize final answer from all sub-queries
     */
    async synthesizeAnswer(originalQuery, subQueries, allEvidence, model, options) {
        let prompt = `Original Query: ${originalQuery}\n\n`;
        prompt += `Sub-queries and their answers:\n\n`;
        for (const sq of subQueries) {
            prompt += `Sub-query (depth ${sq.depth}): ${sq.query}\n`;
            if (sq.answer) {
                prompt += `Answer: ${sq.answer}\n`;
            }
            prompt += `\n`;
        }
        if (allEvidence.length > 0) {
            prompt += `\nAll Retrieved Evidence:\n`;
            for (const ev of allEvidence.slice(0, 10)) {
                // Limit to top 10 to avoid token limits
                prompt += `[Evidence ID: ${ev.evidence_id}]\n${ev.content.normalized || ev.content.raw || ""}\n\n`;
            }
        }
        prompt += `\nSynthesize a comprehensive answer to the original query using the sub-query answers and evidence above.`;
        const response = await this.llmProvider.call({
            model,
            prompt,
            temperature: options?.temperature || 0.7,
            max_tokens: options?.maxTokens || 2000,
            system_prompt: "You are a helpful assistant. Synthesize a comprehensive, well-structured answer that addresses all aspects of the original query.",
        });
        return {
            text: response.text,
            tokens_used: response.tokens_used,
            cost: response.cost,
        };
    }
    /**
     * Build prompt for sub-query with evidence
     */
    buildSubQueryPrompt(query, evidence) {
        let prompt = `Sub-query: ${query}\n\n`;
        prompt += `Evidence:\n`;
        for (const ev of evidence) {
            prompt += `[Evidence ID: ${ev.evidence_id}]\n`;
            prompt += `${ev.content.normalized || ev.content.raw || ""}\n\n`;
        }
        prompt += `Answer this sub-query using the evidence above.`;
        return prompt;
    }
}
exports.RecursiveRAG = RecursiveRAG;
