/**
 * RAG (Retrieval-Augmented Generation) Pipeline
 * Production RAG implementation for evidence retrieval and context augmentation
 */

import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import type { Evidence } from "@/lib/evidence/vault";
import { EmbeddingService } from "@/lib/vector/embeddings";
import { Reranker } from "@/lib/search/reranking";
import { HybridSearch } from "@/lib/search/hybrid";
import { QueryRewriter } from "@/lib/search/query-rewriter";
import { CitationAwareSelector } from "@/lib/search/citation-aware";
import { logger } from "@/lib/logging/logger";
import { CRAGPipeline } from "./crag";

export interface RAGContext {
  query: string;
  evidence: Evidence[];
  context: string;
  metadata: {
    retrieval_count: number;
    retrieval_time_ms: number;
    relevance_scores: number[];
  };
}

export class RAGPipeline {
  private embeddingService: EmbeddingService;
  private reranker: Reranker;
  private hybridSearch: HybridSearch;
  private queryRewriter: QueryRewriter;
  private citationAwareSelector: CitationAwareSelector;

  constructor(private evidenceVault: DatabaseEvidenceVault) {
    this.embeddingService = new EmbeddingService();
    this.reranker = new Reranker();
    this.hybridSearch = new HybridSearch({
      bm25Weight: 0.3,
      embeddingWeight: 0.7,
    });
    this.queryRewriter = new QueryRewriter();
    this.citationAwareSelector = new CitationAwareSelector();
  }

  /**
   * Retrieve relevant evidence using hybrid search (BM25 + embeddings) with query rewriting and citation-aware selection
   */
  async retrieve(
    query: string,
    tenant_id: string,
    options?: {
      limit?: number;
      min_relevance?: number;
      useReranking?: boolean;
      rerankingModel?: "qwen" | "cross-encoder" | "bge-reranker";
      useHybridSearch?: boolean;
      useQueryRewriting?: boolean;
      useCitationAware?: boolean;
      useCRAG?: boolean; // Use Corrective RAG
    }
  ): Promise<Evidence[]> {
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
      const cragPipeline = new CRAGPipeline(this.evidenceVault);
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
    let scored: Array<{ evidence: Evidence; score: number }>;
    if (useHybridSearch) {
      const hybridResults = await this.hybridSearch.search(searchQuery, allEvidence, {
        topK: limit * 2, // Get more candidates for reranking
        minScore: minRelevance,
      });
      scored = hybridResults.map((r) => ({
        evidence: r.evidence,
        score: r.combinedScore,
      }));
    } else {
      // Fallback to pure semantic search
      const queryEmbedding = await this.embeddingService.embed(query);
      scored = await Promise.all(
        allEvidence.map(async (evidence) => {
          const content = `${evidence.content.raw || ""} ${evidence.content.normalized || ""}`;
          if (!content.trim()) {
            return { evidence, score: 0 };
          }
          const evidenceEmbedding = await this.embeddingService.embed(content);
          const similarity = this.embeddingService.cosineSimilarity(
            queryEmbedding.vector,
            evidenceEmbedding.vector
          );
          return { evidence, score: similarity };
        })
      );
    }

    // Step 4: Citation-aware selection
    let relevant: Evidence[];
    if (useCitationAware) {
      const citationAwareChunks = this.citationAwareSelector.selectChunks(scored, {
        minCitationStrength: 0.5,
        preferStrongLinks: true,
        ensureCoverage: true,
        minCoverage: 3,
      });
      relevant = citationAwareChunks.map((c) => c.evidence);
    } else {
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
        const reranked = await this.reranker.rerank(
          query,
          relevant.map((ev) => ({
            id: ev.evidence_id,
            text: `${ev.content.raw || ""} ${ev.content.normalized || ""}`,
            metadata: ev.metadata || {},
          })),
          {
            model: options?.rerankingModel || "cross-encoder",
            topK: limit,
          }
        );

        // Reorder evidence by rerank order
        const rerankedIds = new Set(reranked.map((r) => r.id));
        const rerankedEvidence = relevant.filter((ev) => rerankedIds.has(ev.evidence_id));
        const orderMap = new Map(reranked.map((r, idx) => [r.id, idx]));
        rerankedEvidence.sort((a, b) => (orderMap.get(a.evidence_id) || 0) - (orderMap.get(b.evidence_id) || 0));
        relevant = rerankedEvidence.slice(0, limit);
      } catch (error) {
        logger.warn("Reranking failed, using original order", {
          error: error instanceof Error ? error.message : String(error),
        });
        relevant = relevant.slice(0, limit);
      }
    } else {
      relevant = relevant.slice(0, limit);
    }

    return relevant;
  }

  /**
   * Build context from retrieved evidence
   */
  async buildContext(
    query: string,
    tenant_id: string,
    options?: {
      limit?: number;
      include_metadata?: boolean;
    }
  ): Promise<RAGContext> {
    const startTime = Date.now();
    const evidence = await this.retrieve(query, tenant_id, options);

    // Build context string
    const contextParts = evidence.map((ev, idx) => {
      return `[Evidence ${idx + 1} (${ev.evidence_id})]\n${ev.content.normalized || ev.content.raw || ""}\nSource: ${ev.source.type}/${ev.source.id}\n`;
    });

    const context = contextParts.join("\n---\n\n");

    // Calculate actual relevance scores
    const queryEmbedding = await this.embeddingService.embed(query);
    const relevanceScores = await Promise.all(
      evidence.map(async (ev) => {
        const content = `${ev.content.raw || ""} ${ev.content.normalized || ""}`;
        const evEmbedding = await this.embeddingService.embed(content);
        return this.embeddingService.cosineSimilarity(
          queryEmbedding.vector,
          evEmbedding.vector
        );
      })
    );

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
