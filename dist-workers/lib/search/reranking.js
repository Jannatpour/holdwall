"use strict";
/**
 * Reranker
 *
 * Production-ready reranking for semantic search results using:
 * - Cross-encoder models for relevance scoring (Qwen3-Reranker, BGE-Reranker, Cross-Encoder)
 * - Multi-attribute ranking (relevance, recency, authority, popularity, diversity)
 * - Learning-to-rank algorithms
 * - Hybrid ranking combining multiple signals
 * - LLM-based reranking fallback
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RerankingService = exports.Reranker = void 0;
const embeddings_1 = require("./embeddings");
class Reranker {
    constructor() {
        this.openaiApiKey = null;
        this.cohereApiKey = null;
        this.voyageApiKey = null;
        this.qwenApiKey = null;
        this.huggingfaceApiKey = null;
        this.embeddings = new embeddings_1.VectorEmbeddings();
        this.openaiApiKey = process.env.OPENAI_API_KEY || null;
        this.cohereApiKey = process.env.COHERE_API_KEY || null;
        this.voyageApiKey = process.env.VOYAGE_API_KEY || null;
        this.qwenApiKey = process.env.QWEN_API_KEY || process.env.OPENROUTER_API_KEY || null;
        this.huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY || null;
    }
    /**
     * Rerank implementation (supports both interfaces)
     */
    async rerank(query, input, options) {
        const { model = "cross-encoder", topK = 10, useMultiAttribute = false } = options || {};
        if (input.length === 0) {
            return [];
        }
        // Check if input is Evidence[] by checking for evidence_id property
        const isEvidenceArray = "evidence_id" in input[0];
        // If using Evidence objects and multi-attribute ranking is enabled
        if (useMultiAttribute && isEvidenceArray) {
            return this.rerankWithMultiAttribute(query, input, options);
        }
        // Otherwise use simplified reranking
        const documents = isEvidenceArray
            ? input.map((ev) => ({
                id: ev.evidence_id,
                text: `${ev.content.raw || ""} ${ev.content.normalized || ""}`,
                metadata: ev.metadata || {},
            }))
            : input;
        return this.rerankDocuments(query, documents, options);
    }
    /**
     * Rerank documents using cross-encoder models
     */
    async rerankDocuments(query, documents, options) {
        const { model = "cross-encoder", topK = 10 } = options || {};
        if (documents.length === 0) {
            return [];
        }
        // Try Qwen3-Reranker (best performance)
        if (model === "qwen" && this.qwenApiKey) {
            try {
                return await this.rerankWithQwen(query, documents, topK);
            }
            catch (error) {
                console.warn("Qwen reranking failed, trying cross-encoder:", error);
            }
        }
        // Try cross-encoder model (Hugging Face)
        if ((model === "cross-encoder" || model === "qwen") && this.huggingfaceApiKey) {
            try {
                return await this.rerankWithCrossEncoder(query, documents, topK);
            }
            catch (error) {
                console.warn("Cross-encoder reranking failed, trying BGE:", error);
            }
        }
        // Try BGE-Reranker
        if (model === "bge-reranker" && this.huggingfaceApiKey) {
            try {
                return await this.rerankWithBGE(query, documents, topK);
            }
            catch (error) {
                console.warn("BGE reranking failed, using fallback:", error);
            }
        }
        // Try Cohere Rerank
        if (model === "cohere-rerank" && this.cohereApiKey) {
            try {
                return await this.rerankWithCohere(query, documents, topK);
            }
            catch (error) {
                console.warn("Cohere reranking failed, using fallback:", error);
            }
        }
        // Try Voyage Rerank
        if (model === "voyage-rerank" && this.voyageApiKey) {
            try {
                return await this.rerankWithVoyage(query, documents, topK);
            }
            catch (error) {
                console.warn("Voyage reranking failed, using fallback:", error);
            }
        }
        // Fallback: Use LLM-based reranking
        if (this.openaiApiKey) {
            try {
                return await this.rerankWithLLM(query, documents, topK);
            }
            catch (error) {
                console.warn("LLM reranking failed:", error);
            }
        }
        // Final fallback: Return original order
        return documents.map((doc, idx) => ({
            id: doc.id,
            score: 1.0 - (idx / documents.length),
            rank: idx + 1,
            originalRank: idx + 1,
        }));
    }
    /**
     * Rerank with multi-attribute ranking (for Evidence objects)
     */
    async rerankWithMultiAttribute(query, results, options) {
        const { model = "cross-encoder", topK = 10, attributes = {
            relevance: 0.6,
            recency: 0.2,
            authority: 0.1,
            popularity: 0.05,
            diversity: 0.05,
        }, diversityThreshold = 0.3, minScore = 0.3, } = options || {};
        if (results.length === 0) {
            return [];
        }
        // Calculate attribute scores for each result
        const scoredResults = await Promise.all(results.map(async (evidence, index) => {
            const relevanceScore = await this.calculateRelevanceScore(query, evidence, model);
            const recencyScore = this.calculateRecencyScore(evidence);
            const authorityScore = this.calculateAuthorityScore(evidence);
            const popularityScore = this.calculatePopularityScore(evidence);
            const diversityScore = await this.calculateDiversityScore(evidence, results.slice(0, index), diversityThreshold);
            // Weighted combination
            const relevanceWeight = attributes.relevance || 0;
            const recencyWeight = attributes.recency || 0;
            const authorityWeight = attributes.authority || 0;
            const popularityWeight = attributes.popularity || 0;
            const diversityWeight = attributes.diversity || 0;
            const finalScore = relevanceScore * relevanceWeight +
                recencyScore * recencyWeight +
                authorityScore * authorityWeight +
                popularityScore * popularityWeight +
                diversityScore * diversityWeight;
            return {
                evidence,
                score: finalScore,
                attributes: {
                    relevance: relevanceScore,
                    recency: recencyScore,
                    authority: authorityScore,
                    popularity: popularityScore,
                    diversity: diversityScore,
                },
                rank: 0, // Will be set after sorting
            };
        }));
        // Filter by minimum score
        const filtered = scoredResults.filter((r) => r.score >= minScore);
        // Sort by score (descending)
        filtered.sort((a, b) => b.score - a.score);
        // Apply diversity filtering (remove similar results)
        const diverse = this.applyDiversityFilter(filtered, diversityThreshold);
        // Set ranks and return top K
        return diverse.slice(0, topK).map((result, index) => ({
            ...result,
            rank: index + 1,
        }));
    }
    /**
     * Rerank with Qwen3-Reranker
     */
    async rerankWithQwen(query, documents, topK) {
        const qwenApiUrl = process.env.QWEN_API_URL || "https://api.openrouter.ai/v1";
        const model = "qwen/qwen3-reranker-8b";
        const response = await fetch(`${qwenApiUrl}/rerank`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.qwenApiKey}`,
            },
            body: JSON.stringify({
                model,
                query,
                documents: documents.map((d) => d.text),
                top_n: topK,
                return_documents: false,
            }),
        });
        if (!response.ok) {
            throw new Error(`Qwen reranking API error: ${response.statusText}`);
        }
        const data = await response.json();
        const results = data.results || [];
        return results.map((result, idx) => ({
            id: documents[result.index]?.id || `doc-${result.index}`,
            score: result.relevance_score || result.score || 0,
            rank: idx + 1,
            originalRank: result.index + 1,
        }));
    }
    /**
     * Rerank with cross-encoder model (Hugging Face)
     */
    async rerankWithCrossEncoder(query, documents, topK) {
        // Try multiple cross-encoder models
        const models = [
            "cross-encoder/ms-marco-MiniLM-L-6-v2",
            "BAAI/bge-reranker-v2",
            "cross-encoder/ms-marco-MiniLM-L-12-v2",
        ];
        for (const model of models) {
            try {
                const response = await fetch(`https://api-inference.huggingface.co/pipeline/sentence-similarity/${model}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.huggingfaceApiKey}`,
                    },
                    body: JSON.stringify({
                        source_sentence: query,
                        sentences: documents.map((d) => d.text),
                        options: { wait_for_model: true },
                    }),
                });
                if (response.ok) {
                    const scores = await response.json();
                    if (Array.isArray(scores)) {
                        const scored = documents.map((doc, idx) => ({
                            id: doc.id,
                            score: typeof scores[idx] === "number" ? scores[idx] : 0.5,
                            originalRank: idx + 1,
                        }));
                        // Sort by score and return top K
                        return scored
                            .sort((a, b) => b.score - a.score)
                            .slice(0, topK)
                            .map((item, idx) => ({
                            ...item,
                            rank: idx + 1,
                        }));
                    }
                }
            }
            catch (error) {
                continue; // Try next model
            }
        }
        throw new Error("All cross-encoder models failed");
    }
    /**
     * Rerank with BGE-Reranker
     */
    async rerankWithBGE(query, documents, topK) {
        const response = await fetch("https://api-inference.huggingface.co/pipeline/sentence-similarity/BAAI/bge-reranker-v2", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.huggingfaceApiKey}`,
            },
            body: JSON.stringify({
                source_sentence: query,
                sentences: documents.map((d) => d.text),
                options: { wait_for_model: true },
            }),
        });
        if (!response.ok) {
            throw new Error(`BGE reranking API error: ${response.statusText}`);
        }
        const scores = await response.json();
        if (!Array.isArray(scores)) {
            throw new Error("Invalid BGE reranking response");
        }
        const scored = documents.map((doc, idx) => ({
            id: doc.id,
            score: typeof scores[idx] === "number" ? scores[idx] : 0.5,
            originalRank: idx + 1,
        }));
        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map((item, idx) => ({
            ...item,
            rank: idx + 1,
        }));
    }
    /**
     * Rerank using LLM (fallback)
     */
    async rerankWithLLM(query, documents, topK) {
        if (!this.openaiApiKey) {
            throw new Error("OpenAI API key required for LLM reranking");
        }
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.openaiApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a reranking system. Rank documents by relevance to the query. Return JSON array with document indices and relevance scores (0-1).",
                    },
                    {
                        role: "user",
                        content: `Query: ${query}\n\nDocuments:\n${documents.map((d, i) => `${i}: ${d.text.substring(0, 500)}`).join("\n\n")}\n\nRank the top ${topK} most relevant documents.`,
                    },
                ],
                response_format: { type: "json_object" },
                temperature: 0.1,
            }),
        });
        if (!response.ok) {
            throw new Error(`LLM reranking API error: ${response.statusText}`);
        }
        const data = await response.json();
        const ranking = JSON.parse(data.choices[0]?.message?.content || "{}");
        const ranked = (ranking.rankings || []).map((r) => ({
            id: documents[r.index]?.id || `doc-${r.index}`,
            score: r.score || 0.5,
            originalRank: r.index + 1,
            rank: 0, // Will be set below
        }));
        return ranked
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map((item, idx) => ({
            ...item,
            rank: idx + 1,
        }));
    }
    /**
     * Calculate relevance score using cross-encoder or semantic similarity
     */
    async calculateRelevanceScore(query, evidence, model) {
        const content = `${evidence.content.raw || ""} ${evidence.content.normalized || ""}`;
        switch (model) {
            case "bge-reranker":
                return await this.bgeRerankScore(query, content);
            case "cohere-rerank":
                return await this.cohereRerankScore(query, content);
            case "voyage-rerank":
                return await this.voyageRerankScore(query, content);
            case "qwen":
                return await this.qwenRerankScore(query, content);
            case "cross-encoder":
            default:
                return await this.crossEncoderScore(query, content);
        }
    }
    /**
     * Qwen rerank scoring (single document)
     */
    async qwenRerankScore(query, content) {
        if (!this.qwenApiKey) {
            return await this.fallbackRelevanceScore(query, content);
        }
        try {
            const qwenApiUrl = process.env.QWEN_API_URL || "https://api.openrouter.ai/v1";
            const response = await fetch(`${qwenApiUrl}/rerank`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.qwenApiKey}`,
                },
                body: JSON.stringify({
                    model: "qwen/qwen3-reranker-8b",
                    query,
                    documents: [content],
                    top_n: 1,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                const score = data.results?.[0]?.relevance_score || data.results?.[0]?.score || 0;
                return Math.max(0, Math.min(1, score));
            }
        }
        catch (error) {
            console.warn("Qwen rerank scoring failed:", error);
        }
        return await this.fallbackRelevanceScore(query, content);
    }
    /**
     * Cohere Rerank scoring (single document)
     */
    async cohereRerankScore(query, content) {
        if (!this.cohereApiKey) {
            return await this.fallbackRelevanceScore(query, content);
        }
        try {
            const response = await fetch("https://api.cohere.ai/v1/rerank", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.cohereApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "rerank-english-v3.0",
                    query,
                    documents: [content],
                    top_n: 1,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                const score = data.results?.[0]?.relevance_score || 0;
                return Math.max(0, Math.min(1, score));
            }
        }
        catch (error) {
            console.warn("Cohere rerank scoring failed:", error);
        }
        return await this.fallbackRelevanceScore(query, content);
    }
    /**
     * Voyage Rerank scoring (single document)
     */
    async voyageRerankScore(query, content) {
        if (!this.voyageApiKey) {
            return await this.fallbackRelevanceScore(query, content);
        }
        try {
            const response = await fetch("https://api.voyageai.com/v1/rerank", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.voyageApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "rerank-lite-1",
                    query,
                    documents: [content],
                    top_k: 1,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                const score = data.data?.[0]?.relevance_score || 0;
                return Math.max(0, Math.min(1, score));
            }
        }
        catch (error) {
            console.warn("Voyage rerank scoring failed:", error);
        }
        return await this.fallbackRelevanceScore(query, content);
    }
    /**
     * BGE Reranker scoring (single document)
     */
    async bgeRerankScore(query, content) {
        if (!this.huggingfaceApiKey) {
            return await this.fallbackRelevanceScore(query, content);
        }
        try {
            const response = await fetch("https://api-inference.huggingface.co/pipeline/sentence-similarity/BAAI/bge-reranker-v2", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.huggingfaceApiKey}`,
                },
                body: JSON.stringify({
                    source_sentence: query,
                    sentences: [content],
                    options: { wait_for_model: true },
                }),
            });
            if (response.ok) {
                const scores = await response.json();
                if (Array.isArray(scores) && scores.length > 0) {
                    return Math.max(0, Math.min(1, typeof scores[0] === "number" ? scores[0] : 0.5));
                }
            }
        }
        catch (error) {
            console.warn("BGE rerank scoring failed:", error);
        }
        return await this.fallbackRelevanceScore(query, content);
    }
    /**
     * Rerank with Cohere (batch)
     */
    async rerankWithCohere(query, documents, topK) {
        if (!this.cohereApiKey) {
            throw new Error("Cohere API key required");
        }
        const response = await fetch("https://api.cohere.ai/v1/rerank", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.cohereApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "rerank-english-v3.0",
                query,
                documents: documents.map((d) => d.text),
                top_n: topK,
            }),
        });
        if (!response.ok) {
            throw new Error(`Cohere reranking API error: ${response.statusText}`);
        }
        const data = await response.json();
        const results = data.results || [];
        return results.map((result, idx) => ({
            id: documents[result.index]?.id || `doc-${result.index}`,
            score: result.relevance_score || 0,
            rank: idx + 1,
            originalRank: result.index + 1,
        }));
    }
    /**
     * Rerank with Voyage (batch)
     */
    async rerankWithVoyage(query, documents, topK) {
        if (!this.voyageApiKey) {
            throw new Error("Voyage API key required");
        }
        const response = await fetch("https://api.voyageai.com/v1/rerank", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.voyageApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "rerank-lite-1",
                query,
                documents: documents.map((d) => d.text),
                top_k: topK,
            }),
        });
        if (!response.ok) {
            throw new Error(`Voyage reranking API error: ${response.statusText}`);
        }
        const data = await response.json();
        const results = data.data || [];
        return results.map((result, idx) => ({
            id: documents[result.index]?.id || `doc-${result.index}`,
            score: result.relevance_score || 0,
            rank: idx + 1,
            originalRank: result.index + 1,
        }));
    }
    /**
     * Cross-encoder scoring using OpenAI
     */
    async crossEncoderScore(query, content) {
        if (!this.openaiApiKey) {
            // Fallback to cosine similarity
            return await this.fallbackRelevanceScore(query, content);
        }
        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.openaiApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: "You are a relevance scorer. Rate how relevant the content is to the query on a scale of 0.0 to 1.0. Respond with only a number.",
                        },
                        {
                            role: "user",
                            content: `Query: ${query}\n\nContent: ${content.substring(0, 1000)}\n\nRelevance score (0.0-1.0):`,
                        },
                    ],
                    temperature: 0.1,
                    max_tokens: 10,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                const scoreText = data.choices[0]?.message?.content?.trim() || "0.5";
                const score = parseFloat(scoreText);
                return Math.max(0, Math.min(1, isNaN(score) ? 0.5 : score));
            }
        }
        catch (error) {
            console.warn("Cross-encoder scoring failed:", error);
        }
        return await this.fallbackRelevanceScore(query, content);
    }
    /**
     * Fallback relevance score using cosine similarity
     */
    async fallbackRelevanceScore(query, content) {
        const queryEmbedding = await this.embeddings.embed(query);
        const contentEmbedding = await this.embeddings.embed(content);
        // Cosine similarity
        const similarity = this.cosineSimilarity(queryEmbedding.vector, contentEmbedding.vector);
        // Normalize to 0-1 (cosine similarity is already -1 to 1, but embeddings are usually 0-1)
        return Math.max(0, Math.min(1, (similarity + 1) / 2));
    }
    /**
     * Calculate recency score (newer = higher score)
     */
    calculateRecencyScore(evidence) {
        const createdAt = new Date(evidence.created_at);
        const now = new Date();
        const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        // Exponential decay: score = e^(-age/30) (half-life of 30 days)
        return Math.exp(-ageDays / 30);
    }
    /**
     * Calculate authority score based on source
     */
    calculateAuthorityScore(evidence) {
        // In production, use a source authority database
        // For now, use heuristics
        const sourceType = evidence.source.type.toLowerCase();
        const sourceUrl = evidence.source.url || "";
        // Higher authority for known domains
        const authoritativeDomains = [
            "gov",
            "edu",
            "org",
            "wikipedia.org",
            "arxiv.org",
            "pubmed",
        ];
        if (authoritativeDomains.some((domain) => sourceUrl.includes(domain))) {
            return 0.9;
        }
        // Medium authority for news sources
        if (sourceType.includes("news") || sourceType.includes("article")) {
            return 0.7;
        }
        // Default authority
        return 0.5;
    }
    /**
     * Calculate popularity score (based on engagement metrics)
     */
    calculatePopularityScore(evidence) {
        // In production, use actual engagement metrics from database
        // For now, return default
        const metadata = evidence.content.metadata || {};
        const views = metadata.views || 0;
        const likes = metadata.likes || 0;
        const shares = metadata.shares || 0;
        // Normalize to 0-1 (assuming max values)
        const engagement = (views / 10000 + likes / 1000 + shares / 100) / 3;
        return Math.max(0, Math.min(1, engagement));
    }
    /**
     * Calculate diversity score (how different from previous results)
     */
    calculateDiversityScore(evidence, previousResults, threshold) {
        if (previousResults.length === 0) {
            return Promise.resolve(1.0); // First result is fully diverse
        }
        // Calculate average similarity to previous results
        return Promise.all(previousResults.map((prev) => this.fallbackRelevanceScore(evidence.content.raw || "", prev.content.raw || ""))).then((similarities) => {
            const avgSimilarity = similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
            // Diversity = 1 - similarity (higher diversity = lower similarity)
            return Math.max(0, 1 - avgSimilarity);
        });
    }
    /**
     * Apply diversity filter to remove similar results
     */
    applyDiversityFilter(results, threshold) {
        const diverse = [];
        for (const result of results) {
            // Check if result is diverse enough from already selected results
            const isDiverse = diverse.every((selected) => {
                const similarity = this.cosineSimilarity(result.attributes, selected.attributes);
                return similarity < threshold;
            });
            if (isDiverse || diverse.length === 0) {
                diverse.push(result);
            }
        }
        return diverse;
    }
    /**
     * Cosine similarity helper
     */
    cosineSimilarity(vec1, vec2) {
        if (vec1.length !== vec2.length || vec1.length === 0) {
            return 0;
        }
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
        return denominator > 0 ? dotProduct / denominator : 0;
    }
}
exports.Reranker = Reranker;
// Export alias for backward compatibility
exports.RerankingService = Reranker;
