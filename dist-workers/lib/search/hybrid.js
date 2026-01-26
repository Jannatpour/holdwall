"use strict";
/**
 * Hybrid Search
 *
 * Combines BM25 (keyword) and semantic (embeddings) search for improved recall and precision.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridSearch = void 0;
const embeddings_1 = require("./embeddings");
const logger_1 = require("@/lib/logging/logger");
const metrics_1 = require("@/lib/observability/metrics");
/**
 * Hybrid Search combining BM25 and semantic search
 */
class HybridSearch {
    constructor(config) {
        this.embeddings = new embeddings_1.VectorEmbeddings();
        this.bm25Weight = config?.bm25Weight ?? 0.3;
        this.embeddingWeight = config?.embeddingWeight ?? 0.7;
        // Normalize weights
        const total = this.bm25Weight + this.embeddingWeight;
        if (total > 0) {
            this.bm25Weight /= total;
            this.embeddingWeight /= total;
        }
    }
    /**
     * Perform hybrid search
     */
    async search(query, evidenceList, config) {
        const startTime = Date.now();
        const topK = config?.topK ?? 10;
        const minScore = config?.minScore ?? 0.0;
        // Step 1: BM25 keyword search
        const bm25Results = this.bm25Search(query, evidenceList);
        // Step 2: Semantic embedding search
        const embeddingResults = await this.embeddingSearch(query, evidenceList);
        // Step 3: Combine scores
        const combinedResults = this.combineScores(bm25Results, embeddingResults);
        // Step 4: Filter and sort
        const filtered = combinedResults
            .filter((r) => r.combinedScore >= minScore)
            .sort((a, b) => b.combinedScore - a.combinedScore)
            .slice(0, topK)
            .map((r, index) => ({ ...r, rank: index + 1 }));
        const latency = Date.now() - startTime;
        metrics_1.metrics.histogram("hybrid_search_latency_ms", latency);
        metrics_1.metrics.gauge("hybrid_search_results_count", filtered.length);
        logger_1.logger.debug("Hybrid search completed", {
            query: query.substring(0, 100),
            resultsCount: filtered.length,
            latency,
        });
        return filtered;
    }
    /**
     * BM25 keyword search (simplified implementation)
     */
    bm25Search(query, evidenceList) {
        const scores = new Map();
        const queryTerms = this.tokenize(query.toLowerCase());
        const avgDocLength = evidenceList.reduce((sum, e) => sum + this.getTextLength(e), 0) /
            evidenceList.length;
        for (const evidence of evidenceList) {
            const docTerms = this.tokenize(this.getEvidenceText(evidence).toLowerCase());
            const docLength = docTerms.length;
            let score = 0;
            for (const term of queryTerms) {
                const termFreq = docTerms.filter((t) => t === term).length;
                if (termFreq === 0)
                    continue;
                // Simplified BM25 formula
                const k1 = 1.2;
                const b = 0.75;
                const idf = Math.log((evidenceList.length - this.getDocFreq(term, evidenceList) + 0.5) /
                    (this.getDocFreq(term, evidenceList) + 0.5));
                const tf = (termFreq * (k1 + 1)) / (termFreq + k1 * (1 - b + b * (docLength / avgDocLength)));
                score += idf * tf;
            }
            scores.set(evidence.evidence_id, score);
        }
        // Normalize scores to 0-1
        const maxScore = Math.max(...Array.from(scores.values()));
        if (maxScore > 0) {
            for (const [id, score] of scores.entries()) {
                scores.set(id, score / maxScore);
            }
        }
        return scores;
    }
    /**
     * Semantic embedding search
     */
    async embeddingSearch(query, evidenceList) {
        const scores = new Map();
        try {
            // Get query embedding
            const queryEmbeddingResult = await this.embeddings.embed(query);
            const queryEmbedding = queryEmbeddingResult.vector;
            // Get embeddings for all evidence (in production, use vector DB)
            const evidenceEmbeddings = await Promise.all(evidenceList.map(async (e) => {
                const embeddingResult = await this.embeddings.embed(this.getEvidenceText(e));
                return {
                    evidence: e,
                    embedding: embeddingResult.vector,
                };
            }));
            // Calculate cosine similarity
            for (const { evidence, embedding } of evidenceEmbeddings) {
                const similarity = this.cosineSimilarity(queryEmbedding, embedding);
                scores.set(evidence.evidence_id, similarity);
            }
        }
        catch (error) {
            logger_1.logger.error("Embedding search failed", {
                error: error instanceof Error ? error.message : String(error),
            });
            // Return zero scores on error
            for (const evidence of evidenceList) {
                scores.set(evidence.evidence_id, 0);
            }
        }
        return scores;
    }
    /**
     * Combine BM25 and embedding scores
     */
    combineScores(bm25Scores, embeddingScores) {
        const results = [];
        const allIds = new Set([...bm25Scores.keys(), ...embeddingScores.keys()]);
        for (const id of allIds) {
            const bm25Score = bm25Scores.get(id) ?? 0;
            const embeddingScore = embeddingScores.get(id) ?? 0;
            const combinedScore = this.bm25Weight * bm25Score + this.embeddingWeight * embeddingScore;
            results.push({
                evidence: { evidence_id: id }, // Would fetch full evidence in production
                bm25Score,
                embeddingScore,
                combinedScore,
                rank: 0, // Will be set after sorting
            });
        }
        return results;
    }
    /**
     * Tokenize text (simplified)
     */
    tokenize(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter((t) => t.length > 0);
    }
    /**
     * Get text from evidence
     */
    getEvidenceText(evidence) {
        return (evidence.content?.normalized ||
            evidence.content?.raw ||
            evidence.metadata?.title ||
            evidence.metadata?.summary ||
            evidence.evidence_id);
    }
    /**
     * Get text length
     */
    getTextLength(evidence) {
        return this.getEvidenceText(evidence).length;
    }
    /**
     * Get document frequency of term
     */
    getDocFreq(term, evidenceList) {
        return evidenceList.filter((e) => {
            const text = this.getEvidenceText(e).toLowerCase();
            return text.includes(term);
        }).length;
    }
    /**
     * Calculate cosine similarity
     */
    cosineSimilarity(a, b) {
        if (a.length !== b.length) {
            return 0;
        }
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator > 0 ? dotProduct / denominator : 0;
    }
}
exports.HybridSearch = HybridSearch;
