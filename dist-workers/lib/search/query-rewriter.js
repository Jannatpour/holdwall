"use strict";
/**
 * Query Rewriter
 *
 * Enhances queries with expansion, decomposition, and intent detection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryRewriter = void 0;
const logger_1 = require("@/lib/logging/logger");
const providers_1 = require("@/lib/llm/providers");
/**
 * Query Rewriter
 */
class QueryRewriter {
    constructor() {
        this.synonymCache = new Map();
        this.intentCache = new Map();
        this.llmProvider = new providers_1.LLMProvider();
    }
    /**
     * Rewrite query with expansion and decomposition
     */
    async rewrite(query) {
        const startTime = Date.now();
        // Check cache
        const cacheKey = query.toLowerCase().trim();
        if (this.synonymCache.has(cacheKey)) {
            const synonyms = this.synonymCache.get(cacheKey);
            const intent = this.intentCache.get(cacheKey) || "informational";
            return {
                original: query,
                expanded: this.expandQuery(query, synonyms),
                decomposed: this.decomposeQuery(query),
                intent,
                synonyms,
                relatedTerms: synonyms,
            };
        }
        // Detect intent
        const intent = await this.detectIntent(query);
        // Generate synonyms and related terms
        const synonyms = await this.generateSynonyms(query);
        this.synonymCache.set(cacheKey, synonyms);
        this.intentCache.set(cacheKey, intent);
        // Expand query
        const expanded = this.expandQuery(query, synonyms);
        // Decompose complex queries
        const decomposed = this.decomposeQuery(query);
        const latency = Date.now() - startTime;
        logger_1.logger.debug("Query rewritten", {
            original: query.substring(0, 100),
            expanded: expanded.substring(0, 100),
            intent,
            latency,
        });
        return {
            original: query,
            expanded,
            decomposed,
            intent,
            synonyms,
            relatedTerms: synonyms,
        };
    }
    /**
     * Detect query intent
     */
    async detectIntent(query) {
        // Check cache
        const cacheKey = query.toLowerCase().trim();
        if (this.intentCache.has(cacheKey)) {
            return this.intentCache.get(cacheKey);
        }
        // Simple rule-based detection (can be enhanced with LLM)
        const lowerQuery = query.toLowerCase();
        // Navigational: looking for specific entity/page
        if (lowerQuery.includes("what is") ||
            lowerQuery.includes("who is") ||
            lowerQuery.includes("where is") ||
            lowerQuery.startsWith("find") ||
            lowerQuery.startsWith("show me")) {
            return "navigational";
        }
        // Transactional: wants to perform action
        if (lowerQuery.includes("how to") ||
            lowerQuery.includes("create") ||
            lowerQuery.includes("delete") ||
            lowerQuery.includes("update")) {
            return "transactional";
        }
        // Default: informational
        return "informational";
    }
    /**
     * Generate synonyms and related terms
     */
    async generateSynonyms(query) {
        // Check cache
        const cacheKey = query.toLowerCase().trim();
        if (this.synonymCache.has(cacheKey)) {
            return this.synonymCache.get(cacheKey);
        }
        // Simple synonym expansion (can be enhanced with LLM or synonym database)
        const synonyms = [];
        const words = query.toLowerCase().split(/\s+/);
        // Common synonyms mapping
        const synonymMap = {
            claim: ["assertion", "statement", "allegation"],
            evidence: ["proof", "support", "documentation"],
            narrative: ["story", "account", "description"],
            risk: ["threat", "danger", "hazard"],
            forecast: ["prediction", "projection", "estimate"],
            graph: ["network", "relationship", "connection"],
        };
        for (const word of words) {
            const wordSynonyms = synonymMap[word];
            if (wordSynonyms) {
                synonyms.push(...wordSynonyms);
            }
        }
        // Use LLM for more sophisticated expansion if needed
        if (synonyms.length === 0 && query.length > 10) {
            try {
                const llmSynonyms = await this.llmExpandWithLLM(query);
                synonyms.push(...llmSynonyms);
            }
            catch (error) {
                logger_1.logger.warn("LLM synonym expansion failed, using basic expansion", {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return [...new Set(synonyms)]; // Remove duplicates
    }
    /**
     * Expand query with synonyms
     */
    expandQuery(query, synonyms) {
        if (synonyms.length === 0) {
            return query;
        }
        // Add synonyms as OR conditions
        const expandedTerms = [query, ...synonyms.slice(0, 5)]; // Limit to 5 synonyms
        return expandedTerms.join(" OR ");
    }
    /**
     * Decompose complex query into sub-queries
     */
    decomposeQuery(query) {
        // Simple decomposition: split on conjunctions
        const conjunctions = [" and ", " or ", " but ", " also "];
        let decomposed = [query];
        for (const conj of conjunctions) {
            const newDecomposed = [];
            for (const q of decomposed) {
                if (q.includes(conj)) {
                    const parts = q.split(conj).map((p) => p.trim()).filter((p) => p.length > 0);
                    newDecomposed.push(...parts);
                }
                else {
                    newDecomposed.push(q);
                }
            }
            decomposed = newDecomposed;
        }
        // Filter out very short sub-queries
        return decomposed.filter((q) => q.length >= 3);
    }
    /**
     * Expand query using LLM (fallback)
     */
    async llmExpandWithLLM(query) {
        try {
            const response = await this.llmProvider.call({
                model: "gpt-4o-mini",
                prompt: `Generate 3-5 synonyms or related terms for the following query. Return only the terms, one per line, no explanations:\n\n${query}`,
                max_tokens: 50,
                temperature: 0.7,
            });
            const synonyms = response.text
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.length > 0 && !line.startsWith("#"))
                .slice(0, 5);
            return synonyms;
        }
        catch (error) {
            logger_1.logger.error("LLM synonym expansion failed", {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
}
exports.QueryRewriter = QueryRewriter;
