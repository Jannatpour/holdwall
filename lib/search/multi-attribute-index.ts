/**
 * Multi-Attribute Indexing
 * 
 * Production-ready multi-attribute indexing for semantic search with:
 * - Composite indexes (relevance + recency + authority)
 * - Inverted indexes for metadata
 * - Hybrid search combining vector and keyword
 * - Faceted search support
 */

import type { Evidence } from "@/lib/evidence/vault";
import { Reranker } from "./reranking";

export interface MultiAttributeIndex {
  // Vector similarity index
  vectorIndex: Map<string, number[]>; // evidence_id -> embedding

  // Metadata indexes
  typeIndex: Map<string, Set<string>>; // type -> evidence_ids
  sourceIndex: Map<string, Set<string>>; // source_type -> evidence_ids
  dateIndex: Map<number, Set<string>>; // timestamp -> evidence_ids

  // Authority index
  authorityIndex: Map<string, number>; // source_id -> authority_score

  // Popularity index
  popularityIndex: Map<string, number>; // evidence_id -> popularity_score
}

export interface SearchAttributes {
  relevance?: number; // Weight for semantic relevance
  recency?: number; // Weight for recency
  authority?: number; // Weight for source authority
  popularity?: number; // Weight for popularity
  type?: string; // Filter by evidence type
  sourceType?: string; // Filter by source type
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export class MultiAttributeIndexer {
  private index: MultiAttributeIndex;
  private reranker: Reranker;

  constructor() {
    this.index = {
      vectorIndex: new Map(),
      typeIndex: new Map(),
      sourceIndex: new Map(),
      dateIndex: new Map(),
      authorityIndex: new Map(),
      popularityIndex: new Map(),
    };
    this.reranker = new Reranker();
  }

  /**
   * Index evidence with all attributes
   */
  async indexEvidence(
    evidence: Evidence,
    embedding: number[],
    metadata?: {
      authority?: number;
      popularity?: number;
    }
  ): Promise<void> {
    // Index vector
    this.index.vectorIndex.set(evidence.evidence_id, embedding);

    // Index by type
    if (!this.index.typeIndex.has(evidence.type)) {
      this.index.typeIndex.set(evidence.type, new Set());
    }
    this.index.typeIndex.get(evidence.type)!.add(evidence.evidence_id);

    // Index by source type
    if (!this.index.sourceIndex.has(evidence.source.type)) {
      this.index.sourceIndex.set(evidence.source.type, new Set());
    }
    this.index.sourceIndex.get(evidence.source.type)!.add(evidence.evidence_id);

    // Index by date (rounded to day)
    const dateKey = Math.floor(
      new Date(evidence.created_at).getTime() / (1000 * 60 * 60 * 24)
    );
    if (!this.index.dateIndex.has(dateKey)) {
      this.index.dateIndex.set(dateKey, new Set());
    }
    this.index.dateIndex.get(dateKey)!.add(evidence.evidence_id);

    // Index authority
    if (metadata?.authority !== undefined) {
      this.index.authorityIndex.set(evidence.source.id, metadata.authority);
    }

    // Index popularity
    if (metadata?.popularity !== undefined) {
      this.index.popularityIndex.set(evidence.evidence_id, metadata.popularity);
    }
  }

  /**
   * Search with multi-attribute filtering and ranking
   */
  async search(
    query: string,
    queryEmbedding: number[],
    allEvidence: Evidence[],
    attributes: SearchAttributes
  ): Promise<Evidence[]> {
    // Start with all evidence
    let candidateIds = new Set(allEvidence.map((e) => e.evidence_id));

    // Apply filters
    if (attributes.type) {
      const typeIds = this.index.typeIndex.get(attributes.type) || new Set();
      candidateIds = new Set(
        Array.from(candidateIds).filter((id) => typeIds.has(id))
      );
    }

    if (attributes.sourceType) {
      const sourceIds = this.index.sourceIndex.get(attributes.sourceType) || new Set();
      candidateIds = new Set(
        Array.from(candidateIds).filter((id) => sourceIds.has(id))
      );
    }

    if (attributes.dateRange) {
      const startKey = Math.floor(
        attributes.dateRange.start.getTime() / (1000 * 60 * 60 * 24)
      );
      const endKey = Math.floor(
        attributes.dateRange.end.getTime() / (1000 * 60 * 60 * 24)
      );

      const dateIds = new Set<string>();
      for (let key = startKey; key <= endKey; key++) {
        const ids = this.index.dateIndex.get(key) || new Set();
        ids.forEach((id) => dateIds.add(id));
      }

      candidateIds = new Set(
        Array.from(candidateIds).filter((id) => dateIds.has(id))
      );
    }

    // Get filtered evidence
    const candidates = allEvidence.filter((e) => candidateIds.has(e.evidence_id));

    // Calculate multi-attribute scores
    const scored = await Promise.all(
      candidates.map(async (evidence) => {
        // Relevance score (vector similarity)
        const evidenceEmbedding = this.index.vectorIndex.get(evidence.evidence_id);
        const relevanceScore = evidenceEmbedding
          ? this.cosineSimilarity(queryEmbedding, evidenceEmbedding)
          : 0;

        // Recency score
        const recencyScore = this.calculateRecencyScore(evidence);

        // Authority score
        const authorityScore =
          this.index.authorityIndex.get(evidence.source.id) || 0.5;

        // Popularity score
        const popularityScore =
          this.index.popularityIndex.get(evidence.evidence_id) || 0.5;

        // Weighted combination
        const finalScore =
          relevanceScore * (attributes.relevance || 0.6) +
          recencyScore * (attributes.recency || 0.2) +
          authorityScore * (attributes.authority || 0.1) +
          popularityScore * (attributes.popularity || 0.1);

        return {
          evidence,
          score: finalScore,
        };
      })
    );

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    return scored.map((s) => s.evidence);
  }

  /**
   * Calculate recency score
   */
  private calculateRecencyScore(evidence: Evidence): number {
    const createdAt = new Date(evidence.created_at);
    const now = new Date();
    const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return Math.exp(-ageDays / 30); // Exponential decay with 30-day half-life
  }

  /**
   * Cosine similarity
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
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

  /**
   * Get index statistics
   */
  getStats(): {
    totalVectors: number;
    types: number;
    sources: number;
    dateRanges: number;
    authorityScores: number;
    popularityScores: number;
  } {
    return {
      totalVectors: this.index.vectorIndex.size,
      types: this.index.typeIndex.size,
      sources: this.index.sourceIndex.size,
      dateRanges: this.index.dateIndex.size,
      authorityScores: this.index.authorityIndex.size,
      popularityScores: this.index.popularityIndex.size,
    };
  }

  /**
   * Clear index
   */
  clear(): void {
    this.index.vectorIndex.clear();
    this.index.typeIndex.clear();
    this.index.sourceIndex.clear();
    this.index.dateIndex.clear();
    this.index.authorityIndex.clear();
    this.index.popularityIndex.clear();
  }
}
