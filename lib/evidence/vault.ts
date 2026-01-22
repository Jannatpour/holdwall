/**
 * Evidence Vault
 * 
 * The contract of record. Every claim/cluster/forecast/action must cite immutable evidence references.
 */

export interface Evidence {
  /** Unique evidence ID (immutable) */
  evidence_id: string;
  /** Tenant ID */
  tenant_id: string;
  /** Evidence type */
  type: "signal" | "document" | "artifact" | "metric" | "external";
  /** Source information */
  source: {
    type: string;
    id: string;
    url?: string;
    collected_at: string;
    collected_by: string;
    method: "api" | "rss" | "export" | "manual";
  };
  /** Content/data */
  content: {
    raw?: string;
    normalized?: string;
    metadata?: Record<string, unknown>;
  };
  /** Provenance */
  provenance: {
    collection_method: string;
    retention_policy: string;
    compliance_flags?: string[];
  };
  /** Timestamps */
  created_at: string;
  updated_at?: string;
  /** Digital signature for integrity */
  signature?: {
    algorithm: string;
    signature: string;
    signer_id: string;
  };
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface EvidenceVault {
  store(evidence: Omit<Evidence, "evidence_id" | "created_at">): Promise<string>; // Returns evidence_id
  get(evidence_id: string): Promise<Evidence | null>;
  query(filters: {
    tenant_id?: string;
    type?: string;
    source_type?: string;
    created_after?: string;
    created_before?: string;
  }): Promise<Evidence[]>;
  search(query: string, tenant_id: string, options?: { limit?: number; min_relevance?: number }): Promise<Evidence[]>;
  delete(evidence_id: string): Promise<void>;
  verify(evidence_id: string): Promise<boolean>; // Verify signature
}

/**
 * In-memory implementation (for MVP)
 * In production, use Postgres or object storage
 */
export class InMemoryEvidenceVault implements EvidenceVault {
  private storage = new Map<string, Evidence>();
  private embeddingService: any = null;

  constructor() {
    // Lazy load embedding service
    try {
      this.embeddingService = require("@/lib/vector/embeddings").EmbeddingService;
    } catch {
      // Embedding service not available
    }
  }

  async store(
    evidence: Omit<Evidence, "evidence_id" | "created_at">
  ): Promise<string> {
    const evidence_id = `ev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullEvidence: Evidence = {
      ...evidence,
      evidence_id,
      created_at: new Date().toISOString(),
    };
    this.storage.set(evidence_id, fullEvidence);
    return evidence_id;
  }

  async get(evidence_id: string): Promise<Evidence | null> {
    return this.storage.get(evidence_id) || null;
  }

  async query(filters: {
    tenant_id?: string;
    type?: string;
    source_type?: string;
    created_after?: string;
    created_before?: string;
  }): Promise<Evidence[]> {
    let results = Array.from(this.storage.values());

    if (filters.tenant_id) {
      results = results.filter((e) => e.tenant_id === filters.tenant_id);
    }
    if (filters.type) {
      results = results.filter((e) => e.type === filters.type);
    }
    if (filters.source_type) {
      results = results.filter(
        (e) => e.source.type === filters.source_type
      );
    }
    if (filters.created_after) {
      results = results.filter(
        (e) => e.created_at >= filters.created_after!
      );
    }
    if (filters.created_before) {
      results = results.filter((e) => e.created_at <= filters.created_before!);
    }

    return results;
  }

  async search(
    query: string,
    tenant_id: string,
    options?: { limit?: number; min_relevance?: number }
  ): Promise<Evidence[]> {
    const limit = options?.limit || 10;
    const minRelevance = options?.min_relevance || 0.3;

    if (!this.embeddingService) {
      // Fallback to text-based search if embeddings not available
      const allEvidence = await this.query({ tenant_id });
      const queryLower = query.toLowerCase();
      return allEvidence
        .filter((ev) => {
          const content = `${ev.content.raw || ""} ${ev.content.normalized || ""}`.toLowerCase();
          return content.includes(queryLower);
        })
        .slice(0, limit);
    }

    const EmbeddingService = this.embeddingService;
    const embeddingService = new EmbeddingService();

    // Generate query embedding
    const queryEmbedding = await embeddingService.embed(query);

    // Get all evidence for tenant
    const allEvidence = await this.query({ tenant_id });

    // Generate embeddings for evidence and calculate similarity
    const scored = await Promise.all(
      allEvidence.map(async (evidence) => {
        const content = `${evidence.content.raw || ""} ${evidence.content.normalized || ""}`;
        if (!content.trim()) {
          return { evidence, score: 0 };
        }
        const evidenceEmbedding = await embeddingService.embed(content);
        const similarity = embeddingService.cosineSimilarity(
          queryEmbedding.vector,
          evidenceEmbedding.vector
        );
        return { evidence, score: similarity };
      })
    );

    // Filter by minimum relevance and sort
    const relevant = scored
      .filter((item) => item.score >= minRelevance)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.evidence);

    return relevant;
  }

  async delete(evidence_id: string): Promise<void> {
    this.storage.delete(evidence_id);
  }

  async verify(evidence_id: string): Promise<boolean> {
    const evidence = await this.get(evidence_id);
    if (!evidence || !evidence.signature) {
      return false;
    }
    // In production, verify digital signature
    return true;
  }
}
