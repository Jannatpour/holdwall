"use strict";
/**
 * Production Evidence Vault Implementation
 * Database-backed evidence storage with ChromaDB for vector search
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseEvidenceVault = void 0;
const client_1 = require("@/lib/db/client");
const client_2 = require("@prisma/client");
const embeddings_1 = require("@/lib/vector/embeddings");
const vector_db_chroma_1 = require("@/lib/search/vector-db-chroma");
const node_crypto_1 = require("node:crypto");
const chain_of_custody_1 = require("./chain-of-custody");
const access_control_1 = require("./access-control");
const logger_1 = require("@/lib/logging/logger");
class DatabaseEvidenceVault {
    constructor() {
        this.chromaDB = null;
        this.embeddingService = new embeddings_1.EmbeddingService();
        this.chainOfCustody = new chain_of_custody_1.ChainOfCustodyService();
        this.accessControl = new access_control_1.EvidenceAccessControlService();
        // Initialize ChromaDB if available
        try {
            const chromaUrl = process.env.CHROMA_URL || "http://localhost:8000";
            const collectionName = process.env.CHROMA_COLLECTION || "holdwall-evidence";
            this.chromaDB = new vector_db_chroma_1.ChromaVectorDB(chromaUrl, collectionName);
        }
        catch (error) {
            logger_1.logger.warn("ChromaDB not available, embeddings will be stored in DB only", {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async store(evidence) {
        // Extract metadata fields
        const contentHash = evidence.metadata?.contentHash;
        const detectedLanguage = evidence.metadata?.detectedLanguage;
        const languageConfidence = evidence.metadata?.languageConfidence;
        const piiRedacted = evidence.content.metadata?.piiDetected;
        const piiRedactionMap = evidence.metadata?.piiRedactionMap;
        // Generate content hash if not provided
        const finalContentHash = contentHash || this.generateContentHash(evidence.content.raw || evidence.content.normalized || "", evidence.source.type, evidence.source.id);
        // Generate digital signature
        const signature = this.signEvidence(evidence, finalContentHash);
        // Generate embedding for vector search
        const contentForEmbedding = evidence.content.normalized || evidence.content.raw || "";
        let embedding = null;
        let embeddingModel = null;
        if (contentForEmbedding.trim().length > 0) {
            try {
                const embeddingResult = await this.embeddingService.embed(contentForEmbedding);
                embedding = embeddingResult.vector;
                embeddingModel = embeddingResult.model;
            }
            catch (error) {
                logger_1.logger.warn("Failed to generate embedding for evidence", {
                    error: error instanceof Error ? error.message : String(error),
                    content_hash: finalContentHash,
                });
            }
        }
        // Store in database
        const result = await client_1.db.evidence.create({
            data: {
                tenantId: evidence.tenant_id,
                type: evidence.type.toUpperCase(),
                sourceType: evidence.source.type,
                sourceId: evidence.source.id,
                sourceUrl: evidence.source.url,
                collectedAt: new Date(evidence.source.collected_at),
                collectedBy: evidence.source.collected_by,
                method: evidence.source.method.toUpperCase(),
                contentRaw: evidence.content.raw,
                contentNormalized: evidence.content.normalized,
                contentMetadata: (evidence.content.metadata || {}),
                collectionMethod: evidence.provenance.collection_method,
                retentionPolicy: evidence.provenance.retention_policy,
                complianceFlags: evidence.provenance.compliance_flags || [],
                signatureAlgorithm: signature.algorithm,
                signatureValue: signature.signature,
                signatureSignerId: signature.signer_id,
                // Deduplication
                contentHash: finalContentHash,
                // Language detection
                detectedLanguage: detectedLanguage || evidence.content.metadata?.language,
                languageConfidence: languageConfidence || undefined,
                // PII redaction
                piiRedacted: piiRedacted || false,
                piiRedactionMap: (piiRedactionMap || undefined),
                // Embedding storage
                embedding: embedding ? embedding : undefined,
                embeddingModel: embeddingModel || undefined,
                embeddingGeneratedAt: embedding ? new Date() : undefined,
                metadata: (evidence.metadata || {}),
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
            }
            catch (error) {
                logger_1.logger.warn("Failed to store embedding in ChromaDB", {
                    error: error instanceof Error ? error.message : String(error),
                    evidence_id: result.id,
                });
                // Continue - embedding is stored in DB as fallback
            }
        }
        // Create immutable version for chain of custody
        try {
            const mappedEvidence = this.mapToEvidence(result);
            await this.chainOfCustody.createVersion(result.id, mappedEvidence, evidence.source.collected_by, {
                source_type: evidence.source.type,
                source_id: evidence.source.id,
                collection_method: evidence.provenance.collection_method,
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to create evidence version", {
                error: error instanceof Error ? error.message : String(error),
                evidence_id: result.id,
                stack: error instanceof Error ? error.stack : undefined,
            });
            // Continue - versioning failure doesn't prevent evidence storage
        }
        // Log initial access (creation)
        try {
            await this.accessControl.logAccess({
                evidence_id: result.id,
                actor_id: evidence.source.collected_by,
                tenant_id: evidence.tenant_id,
                access_type: "WRITE",
                reason: "Evidence creation",
                allowed: true,
            });
        }
        catch (error) {
            logger_1.logger.warn("Failed to log evidence creation access", {
                error: error instanceof Error ? error.message : String(error),
                evidence_id: result.id,
            });
        }
        return result.id;
    }
    /**
     * Generate content hash for deduplication
     */
    generateContentHash(content, sourceType, sourceId) {
        const hashInput = `${sourceType}:${sourceId}:${content}`;
        return (0, node_crypto_1.createHash)("sha256").update(hashInput).digest("hex");
    }
    /**
     * Sign evidence for integrity verification
     */
    signEvidence(evidence, contentHash) {
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
        const signature = (0, node_crypto_1.createHmac)("sha256", secret)
            .update(payload)
            .digest("hex");
        return {
            algorithm: "HMAC-SHA256",
            signature,
            signer_id: signerId,
        };
    }
    getEvidenceSigningSecret() {
        const configured = process.env.EVIDENCE_SIGNING_SECRET;
        if (configured && configured.trim().length > 0) {
            return configured;
        }
        if (process.env.NODE_ENV === "production") {
            throw new Error("EVIDENCE_SIGNING_SECRET is required in production");
        }
        // Non-production: process-local secret (no hardcoded defaults).
        if (!DatabaseEvidenceVault.signingSecretEphemeral) {
            DatabaseEvidenceVault.signingSecretEphemeral = (0, node_crypto_1.randomBytes)(32).toString("hex");
        }
        return DatabaseEvidenceVault.signingSecretEphemeral;
    }
    async get(evidence_id, actor_id, tenant_id) {
        const result = await client_1.db.evidence.findUnique({
            where: { id: evidence_id },
        });
        if (!result) {
            return null;
        }
        // Log access if actor provided
        if (actor_id && tenant_id) {
            try {
                await this.accessControl.logAccess({
                    evidence_id,
                    actor_id,
                    tenant_id,
                    access_type: "READ",
                    allowed: true,
                });
            }
            catch (error) {
                logger_1.logger.warn("Failed to log evidence access", {
                    error: error instanceof Error ? error.message : String(error),
                    evidence_id,
                    actor_id,
                });
            }
        }
        return this.mapToEvidence(result);
    }
    async query(filters) {
        const where = {};
        if (filters.tenant_id) {
            where.tenantId = filters.tenant_id;
        }
        if (filters.type) {
            where.type = filters.type.toUpperCase();
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
        const results = await client_1.db.evidence.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });
        return results.map((result) => this.mapToEvidence(result));
    }
    async search(query, tenant_id, options) {
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
                const evidenceRecords = await client_1.db.evidence.findMany({
                    where: {
                        id: { in: relevantIds },
                        tenantId: tenant_id,
                    },
                });
                // Map to Evidence interface
                return evidenceRecords.map((result) => this.mapToEvidence(result));
            }
            catch (error) {
                logger_1.logger.warn("ChromaDB search failed, falling back to DB search", {
                    error: error instanceof Error ? error.message : String(error),
                });
                // Fall through to DB-based search
            }
        }
        // Fallback: Use stored embeddings from DB
        const allEvidence = await client_1.db.evidence.findMany({
            where: {
                tenantId: tenant_id,
                embedding: { not: client_2.Prisma.JsonNull },
            },
            take: 1000, // Limit for performance
        });
        if (allEvidence.length === 0) {
            return [];
        }
        // Calculate similarity using stored embeddings
        const scored = allEvidence
            .map((evidence) => {
            const storedEmbedding = evidence.embedding;
            if (!storedEmbedding || storedEmbedding.length === 0) {
                return { evidence, score: 0 };
            }
            const similarity = this.embeddingService.cosineSimilarity(queryEmbedding.vector, storedEmbedding);
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
    mapToEvidence(result) {
        return {
            evidence_id: result.id,
            tenant_id: result.tenantId,
            type: result.type.toLowerCase(),
            source: {
                type: result.sourceType,
                id: result.sourceId,
                url: result.sourceUrl || undefined,
                collected_at: result.collectedAt.toISOString(),
                collected_by: result.collectedBy,
                method: result.method.toLowerCase(),
            },
            content: {
                raw: result.contentRaw || undefined,
                normalized: result.contentNormalized || undefined,
                metadata: result.contentMetadata || undefined,
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
            metadata: result.metadata || undefined,
        };
    }
    async delete(evidence_id) {
        await client_1.db.evidence.delete({
            where: { id: evidence_id },
        });
    }
    async verify(evidence_id) {
        const evidence = await this.get(evidence_id);
        if (!evidence || !evidence.signature) {
            return false;
        }
        // Get the stored record to access contentHash
        const record = await client_1.db.evidence.findUnique({
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
        const expectedSignature = (0, node_crypto_1.createHmac)("sha256", this.getEvidenceSigningSecret())
            .update(payload)
            .digest("hex");
        return evidence.signature.signature === expectedSignature;
    }
}
exports.DatabaseEvidenceVault = DatabaseEvidenceVault;
DatabaseEvidenceVault.signingSecretEphemeral = null;
