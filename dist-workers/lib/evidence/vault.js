"use strict";
/**
 * Evidence Vault
 *
 * The contract of record. Every claim/cluster/forecast/action must cite immutable evidence references.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryEvidenceVault = void 0;
/**
 * In-memory implementation (for MVP)
 * In production, use Postgres or object storage
 */
class InMemoryEvidenceVault {
    constructor() {
        this.storage = new Map();
        this.embeddingService = null;
        // Lazy load embedding service
        try {
            this.embeddingService = require("@/lib/vector/embeddings").EmbeddingService;
        }
        catch {
            // Embedding service not available
        }
    }
    async store(evidence) {
        const evidence_id = `ev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const fullEvidence = {
            ...evidence,
            evidence_id,
            created_at: new Date().toISOString(),
        };
        this.storage.set(evidence_id, fullEvidence);
        return evidence_id;
    }
    async get(evidence_id) {
        return this.storage.get(evidence_id) || null;
    }
    async query(filters) {
        let results = Array.from(this.storage.values());
        if (filters.tenant_id) {
            results = results.filter((e) => e.tenant_id === filters.tenant_id);
        }
        if (filters.type) {
            results = results.filter((e) => e.type === filters.type);
        }
        if (filters.source_type) {
            results = results.filter((e) => e.source.type === filters.source_type);
        }
        if (filters.created_after) {
            results = results.filter((e) => e.created_at >= filters.created_after);
        }
        if (filters.created_before) {
            results = results.filter((e) => e.created_at <= filters.created_before);
        }
        return results;
    }
    async search(query, tenant_id, options) {
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
        const scored = await Promise.all(allEvidence.map(async (evidence) => {
            const content = `${evidence.content.raw || ""} ${evidence.content.normalized || ""}`;
            if (!content.trim()) {
                return { evidence, score: 0 };
            }
            const evidenceEmbedding = await embeddingService.embed(content);
            const similarity = embeddingService.cosineSimilarity(queryEmbedding.vector, evidenceEmbedding.vector);
            return { evidence, score: similarity };
        }));
        // Filter by minimum relevance and sort
        const relevant = scored
            .filter((item) => item.score >= minRelevance)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((item) => item.evidence);
        return relevant;
    }
    async delete(evidence_id) {
        this.storage.delete(evidence_id);
    }
    async verify(evidence_id) {
        const evidence = await this.get(evidence_id);
        if (!evidence || !evidence.signature) {
            return false;
        }
        // In production, verify digital signature
        return true;
    }
}
exports.InMemoryEvidenceVault = InMemoryEvidenceVault;
