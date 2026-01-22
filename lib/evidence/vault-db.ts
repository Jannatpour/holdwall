/**
 * Production Evidence Vault Implementation
 * Database-backed evidence storage with ChromaDB for vector search
 */

import { db } from "@/lib/db/client";
import { Prisma } from "@prisma/client";
import type { Evidence, EvidenceVault } from "./vault";
import { EmbeddingService } from "@/lib/vector/embeddings";
import { ChromaVectorDB } from "@/lib/search/vector-db-chroma";
import { createHash, createHmac, randomBytes } from "node:crypto";

export class DatabaseEvidenceVault implements EvidenceVault {
  private embeddingService: EmbeddingService;
  private chromaDB: ChromaVectorDB | null = null;
  private static signingSecretEphemeral: string | null = null;

  constructor() {
    this.embeddingService = new EmbeddingService();
    
    // Initialize ChromaDB if available
    try {
      const chromaUrl = process.env.CHROMA_URL || "http://localhost:8000";
      const collectionName = process.env.CHROMA_COLLECTION || "holdwall-evidence";
      this.chromaDB = new ChromaVectorDB(chromaUrl, collectionName);
    } catch (error) {
      console.warn("ChromaDB not available, embeddings will be stored in DB only:", error);
    }
  }

  async store(
    evidence: Omit<Evidence, "evidence_id" | "created_at">
  ): Promise<string> {
    // Extract metadata fields
    const contentHash = (evidence.metadata as any)?.contentHash as string | undefined;
    const detectedLanguage = (evidence.metadata as any)?.detectedLanguage as string | undefined;
    const languageConfidence = (evidence.metadata as any)?.languageConfidence as number | undefined;
    const piiRedacted = (evidence.content.metadata as any)?.piiDetected as boolean | undefined;
    const piiRedactionMap = (evidence.metadata as any)?.piiRedactionMap as Record<string, unknown> | undefined;

    // Generate content hash if not provided
    const finalContentHash = contentHash || this.generateContentHash(
      evidence.content.raw || evidence.content.normalized || "",
      evidence.source.type,
      evidence.source.id
    );

    // Generate digital signature
    const signature = this.signEvidence(evidence, finalContentHash);

    // Generate embedding for vector search
    const contentForEmbedding = evidence.content.normalized || evidence.content.raw || "";
    let embedding: number[] | null = null;
    let embeddingModel: string | null = null;

    if (contentForEmbedding.trim().length > 0) {
      try {
        const embeddingResult = await this.embeddingService.embed(contentForEmbedding);
        embedding = embeddingResult.vector;
        embeddingModel = embeddingResult.model;
      } catch (error) {
        console.warn("Failed to generate embedding for evidence:", error);
      }
    }

    // Store in database
    const result = await db.evidence.create({
      data: {
        tenantId: evidence.tenant_id,
        type: evidence.type.toUpperCase() as any,
        sourceType: evidence.source.type,
        sourceId: evidence.source.id,
        sourceUrl: evidence.source.url,
        collectedAt: new Date(evidence.source.collected_at),
        collectedBy: evidence.source.collected_by,
        method: evidence.source.method.toUpperCase() as any,
        contentRaw: evidence.content.raw,
        contentNormalized: evidence.content.normalized,
        contentMetadata: (evidence.content.metadata || {}) as any,
        collectionMethod: evidence.provenance.collection_method,
        retentionPolicy: evidence.provenance.retention_policy,
        complianceFlags: evidence.provenance.compliance_flags || [],
        signatureAlgorithm: signature.algorithm,
        signatureValue: signature.signature,
        signatureSignerId: signature.signer_id,
        // Deduplication
        contentHash: finalContentHash,
        // Language detection
        detectedLanguage: detectedLanguage || (evidence.content.metadata as any)?.language,
        languageConfidence: languageConfidence || undefined,
        // PII redaction
        piiRedacted: piiRedacted || false,
        piiRedactionMap: (piiRedactionMap || undefined) as any,
        // Embedding storage
        embedding: embedding ? (embedding as any) : undefined,
        embeddingModel: embeddingModel || undefined,
        embeddingGeneratedAt: embedding ? new Date() : undefined,
        metadata: (evidence.metadata || {}) as any,
      },
    });

    // Store embedding in ChromaDB for vector search
    if (this.chromaDB && embedding) {
      try {
        await this.chromaDB.add([
          {
            id: result.id,
            embedding,
            metadata: {
              tenantId: evidence.tenant_id,
              type: evidence.type,
              sourceType: evidence.source.type,
              sourceId: evidence.source.id,
              createdAt: new Date().toISOString(),
            },
          },
        ]);
      } catch (error) {
        console.warn("Failed to store embedding in ChromaDB:", error);
        // Continue - embedding is stored in DB as fallback
      }
    }

    return result.id;
  }

  /**
   * Generate content hash for deduplication
   */
  private generateContentHash(
    content: string,
    sourceType: string,
    sourceId: string
  ): string {
    const hashInput = `${sourceType}:${sourceId}:${content}`;
    return createHash("sha256").update(hashInput).digest("hex");
  }

  /**
   * Sign evidence for integrity verification
   */
  private signEvidence(
    evidence: Omit<Evidence, "evidence_id" | "created_at">,
    contentHash: string
  ): { algorithm: string; signature: string; signer_id: string } {
    // Create signable payload
    const payload = JSON.stringify({
      tenant_id: evidence.tenant_id,
      type: evidence.type,
      source: evidence.source,
      content_hash: contentHash,
      collected_at: evidence.source.collected_at,
    });

    // Use HMAC-SHA256 for signing (upgrade path: RSA/ECDSA via KMS/HSM).
    const secret = this.getEvidenceSigningSecret();
    const signerId = process.env.EVIDENCE_SIGNER_ID || "holdwall-system";
    
    const signature = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    return {
      algorithm: "HMAC-SHA256",
      signature,
      signer_id: signerId,
    };
  }

  private getEvidenceSigningSecret(): string {
    const configured = process.env.EVIDENCE_SIGNING_SECRET;
    if (configured && configured.trim().length > 0) {
      return configured;
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error("EVIDENCE_SIGNING_SECRET is required in production");
    }

    // Non-production: process-local secret (no hardcoded defaults).
    if (!DatabaseEvidenceVault.signingSecretEphemeral) {
      DatabaseEvidenceVault.signingSecretEphemeral = randomBytes(32).toString("hex");
    }
    return DatabaseEvidenceVault.signingSecretEphemeral;
  }

  async get(evidence_id: string): Promise<Evidence | null> {
    const result = await db.evidence.findUnique({
      where: { id: evidence_id },
    });

    if (!result) {
      return null;
    }

    return this.mapToEvidence(result);
  }

  async query(filters: {
    tenant_id?: string;
    type?: string;
    source_type?: string;
    created_after?: string;
    created_before?: string;
  }): Promise<Evidence[]> {
    const where: any = {};

    if (filters.tenant_id) {
      where.tenantId = filters.tenant_id;
    }
    if (filters.type) {
      where.type = filters.type.toUpperCase() as any;
    }
    if (filters.source_type) {
      where.sourceType = filters.source_type;
    }
    if (filters.created_after || filters.created_before) {
      where.createdAt = {};
      if (filters.created_after) {
        where.createdAt.gte = new Date(filters.created_after);
      }
      if (filters.created_before) {
        where.createdAt.lte = new Date(filters.created_before);
      }
    }

    const results = await db.evidence.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return results.map((result) => this.mapToEvidence(result));
  }

  async search(
    query: string,
    tenant_id: string,
    options?: { limit?: number; min_relevance?: number }
  ): Promise<Evidence[]> {
    const limit = options?.limit || 10;
    const minRelevance = options?.min_relevance || 0.3;

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.embed(query);

    // Use ChromaDB for vector search if available
    if (this.chromaDB) {
      try {
        const chromaResults = await this.chromaDB.query(queryEmbedding.vector, {
          nResults: limit * 2, // Get more results to filter by tenant
          where: {
            tenantId: tenant_id,
          },
        });

        // Convert distance to similarity (ChromaDB returns distance, we need similarity)
        const scored = chromaResults.map((result) => ({
          evidenceId: result.id,
          similarity: 1 - result.distance, // Convert distance to similarity
        }));

        // Filter by minimum relevance
        const relevantIds = scored
          .filter((item) => item.similarity >= minRelevance)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit)
          .map((item) => item.evidenceId);

        // Fetch evidence records from database
        if (relevantIds.length === 0) {
          return [];
        }

        const evidenceRecords = await db.evidence.findMany({
          where: {
            id: { in: relevantIds },
            tenantId: tenant_id,
          },
        });

        // Map to Evidence interface
        return evidenceRecords.map((result) => this.mapToEvidence(result));
      } catch (error) {
        console.warn("ChromaDB search failed, falling back to DB search:", error);
        // Fall through to DB-based search
      }
    }

    // Fallback: Use stored embeddings from DB
    const allEvidence = await db.evidence.findMany({
      where: {
        tenantId: tenant_id,
        embedding: { not: Prisma.JsonNull },
      },
      take: 1000, // Limit for performance
    });

    if (allEvidence.length === 0) {
      return [];
    }

    // Calculate similarity using stored embeddings
    const scored = allEvidence
      .map((evidence) => {
        const storedEmbedding = evidence.embedding as number[] | null;
        if (!storedEmbedding || storedEmbedding.length === 0) {
          return { evidence, score: 0 };
        }

        const similarity = this.embeddingService.cosineSimilarity(
          queryEmbedding.vector,
          storedEmbedding
        );
        return { evidence, score: similarity };
      })
      .filter((item) => item.score >= minRelevance)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((item) => this.mapToEvidence(item.evidence));
  }

  /**
   * Map database record to Evidence interface
   */
  private mapToEvidence(result: any): Evidence {
    return {
      evidence_id: result.id,
      tenant_id: result.tenantId,
      type: result.type.toLowerCase() as any,
      source: {
        type: result.sourceType,
        id: result.sourceId,
        url: result.sourceUrl || undefined,
        collected_at: result.collectedAt.toISOString(),
        collected_by: result.collectedBy,
        method: result.method.toLowerCase() as any,
      },
      content: {
        raw: result.contentRaw || undefined,
        normalized: result.contentNormalized || undefined,
        metadata: (result.contentMetadata as Record<string, unknown>) || undefined,
      },
      provenance: {
        collection_method: result.collectionMethod,
        retention_policy: result.retentionPolicy,
        compliance_flags: result.complianceFlags,
      },
      created_at: result.createdAt.toISOString(),
      updated_at: result.updatedAt.toISOString(),
      signature: result.signatureAlgorithm
        ? {
            algorithm: result.signatureAlgorithm,
            signature: result.signatureValue || "",
            signer_id: result.signatureSignerId || "",
          }
        : undefined,
      metadata: (result.metadata as Record<string, unknown>) || undefined,
    };
  }

  async delete(evidence_id: string): Promise<void> {
    await db.evidence.delete({
      where: { id: evidence_id },
    });
  }

  async verify(evidence_id: string): Promise<boolean> {
    const evidence = await this.get(evidence_id);
    if (!evidence || !evidence.signature) {
      return false;
    }

    // Get the stored record to access contentHash
    const record = await db.evidence.findUnique({
      where: { id: evidence_id },
    });

    if (!record || !record.contentHash) {
      return false;
    }

    // Reconstruct the signed payload
    const payload = JSON.stringify({
      tenant_id: evidence.tenant_id,
      type: evidence.type,
      source: evidence.source,
      content_hash: record.contentHash,
      collected_at: evidence.source.collected_at,
    });

    // Verify signature
    const expectedSignature = createHmac("sha256", this.getEvidenceSigningSecret())
      .update(payload)
      .digest("hex");

    return evidence.signature.signature === expectedSignature;
  }
}
