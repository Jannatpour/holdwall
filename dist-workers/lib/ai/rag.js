"use strict";
/**
 * RAG (Retrieval-Augmented Generation) Pipeline
 * Production RAG implementation for evidence retrieval and context augmentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RAGPipeline = void 0;
const embeddings_1 = require("@/lib/vector/embeddings");
const reranking_1 = require("@/lib/search/reranking");
const hybrid_1 = require("@/lib/search/hybrid");
const query_rewriter_1 = require("@/lib/search/query-rewriter");
const citation_aware_1 = require("@/lib/search/citation-aware");
const logger_1 = require("@/lib/logging/logger");
const crag_1 = require("./crag");
class RAGPipeline {
    constructor(evidenceVault) {
        this.evidenceVault = evidenceVault;
        this.embeddingService = new embeddings_1.EmbeddingService();
        this.reranker = new reranking_1.Reranker();
        this.hybridSearch = new hybrid_1.HybridSearch({
            bm25Weight: 0.3,
            embeddingWeight: 0.7,
        });
        this.queryRewriter = new query_rewriter_1.QueryRewriter();
        this.citationAwareSelector = new citation_aware_1.CitationAwareSelector();
    }
    /**
     * Retrieve relevant evidence using hybrid search (BM25 + embeddings) with query rewriting and citation-aware selection
     */
    async retrieve(query, tenant_id, options) {
        const startTime = Date.now();
        const limit = options?.limit || 10;
        const minRelevance = options?.min_relevance || 0.3;
        const useReranking = options?.useReranking ?? true;
        const useHybridSearch = options?.useHybridSearch ?? true;
        const useQueryRewriting = options?.useQueryRewriting ?? true;
        const useCitationAware = options?.useCitationAware ?? true;
        const useCRAG = options?.useCRAG ?? false;
        // Use CRAG if requested
        if (useCRAG) {
            const cragPipeline = new crag_1.CRAGPipeline(this.evidenceVault);
            const cragResult = await cragPipeline.retrieve(query, tenant_id, {
                max_passes: 3,
                min_relevance: options?.min_relevance || 0.5,
                initial_limit: limit * 2,
                final_limit: limit,
            });
            return cragResult.evidence;
        }
        // Step 1: Query rewriting (expand and decompose)
        let searchQuery = query;
        if (useQueryRewriting) {
            const rewritten = await this.queryRewriter.rewrite(query);
            searchQuery = rewritten.expanded; // Use expanded query for better recall
        }
        // Step 2: Get all evidence for tenant
        const allEvidence = await this.evidenceVault.query({
            tenant_id,
        });
        // Step 3: Hybrid search (BM25 + embeddings) or pure semantic
        let scored;
        if (useHybridSearch) {
            const hybridResults = await this.hybridSearch.search(searchQuery, allEvidence, {
                topK: limit * 2, // Get more candidates for reranking
                minScore: minRelevance,
            });
            scored = hybridResults.map((r) => ({
                evidence: r.evidence,
                score: r.combinedScore,
            }));
        }
        else {
            // Fallback to pure semantic search
            const queryEmbedding = await this.embeddingService.embed(query);
            scored = await Promise.all(allEvidence.map(async (evidence) => {
                const content = `${evidence.content.raw || ""} ${evidence.content.normalized || ""}`;
                if (!content.trim()) {
                    return { evidence, score: 0 };
                }
                const evidenceEmbedding = await this.embeddingService.embed(content);
                const similarity = this.embeddingService.cosineSimilarity(queryEmbedding.vector, evidenceEmbedding.vector);
                return { evidence, score: similarity };
            }));
        }
        // Step 4: Citation-aware selection
        let relevant;
        if (useCitationAware) {
            const citationAwareChunks = this.citationAwareSelector.selectChunks(scored, {
                minCitationStrength: 0.5,
                preferStrongLinks: true,
                ensureCoverage: true,
                minCoverage: 3,
            });
            relevant = citationAwareChunks.map((c) => c.evidence);
        }
        else {
            // Filter by minimum relevance and sort
            relevant = scored
                .filter((item) => item.score >= minRelevance)
                .sort((a, b) => b.score - a.score)
                .slice(0, limit * 2)
                .map((item) => item.evidence);
        }
        // Apply reranking if requested
        if (useReranking && relevant.length > 1) {
            try {
                const reranked = await this.reranker.rerank(query, relevant.map((ev) => ({
                    id: ev.evidence_id,
                    text: `${ev.content.raw || ""} ${ev.content.normalized || ""}`,
                    metadata: ev.metadata || {},
                })), {
                    model: options?.rerankingModel || "cross-encoder",
                    topK: limit,
                });
                // Reorder evidence by rerank order
                const rerankedIds = new Set(reranked.map((r) => r.id));
                const rerankedEvidence = relevant.filter((ev) => rerankedIds.has(ev.evidence_id));
                const orderMap = new Map(reranked.map((r, idx) => [r.id, idx]));
                rerankedEvidence.sort((a, b) => (orderMap.get(a.evidence_id) || 0) - (orderMap.get(b.evidence_id) || 0));
                relevant = rerankedEvidence.slice(0, limit);
            }
            catch (error) {
                logger_1.logger.warn("Reranking failed, using original order", {
                    error: error instanceof Error ? error.message : String(error),
                });
                relevant = relevant.slice(0, limit);
            }
        }
        else {
            relevant = relevant.slice(0, limit);
        }
        return relevant;
    }
    /**
     * Build context from retrieved evidence
     */
    async buildContext(query, tenant_id, options) {
        const startTime = Date.now();
        const evidence = await this.retrieve(query, tenant_id, options);
        // Build context string
        const contextParts = evidence.map((ev, idx) => {
            return `[Evidence ${idx + 1} (${ev.evidence_id})]\n${ev.content.normalized || ev.content.raw || ""}\nSource: ${ev.source.type}/${ev.source.id}\n`;
        });
        const context = contextParts.join("\n---\n\n");
        // Calculate actual relevance scores
        const queryEmbedding = await this.embeddingService.embed(query);
        const relevanceScores = await Promise.all(evidence.map(async (ev) => {
            const content = `${ev.content.raw || ""} ${ev.content.normalized || ""}`;
            const evEmbedding = await this.embeddingService.embed(content);
            return this.embeddingService.cosineSimilarity(queryEmbedding.vector, evEmbedding.vector);
        }));
        return {
            query,
            evidence,
            context,
            metadata: {
                retrieval_count: evidence.length,
                retrieval_time_ms: Date.now() - startTime,
                relevance_scores: relevanceScores,
            },
        };
    }
}
exports.RAGPipeline = RAGPipeline;
