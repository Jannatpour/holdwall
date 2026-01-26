"use strict";
/**
 * Chain of Custody Service
 *
 * Tracks immutable evidence versions and provides chain-of-custody verification.
 * Ensures evidence integrity through Merkle tree hashing and version tracking.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChainOfCustodyService = void 0;
const client_1 = require("@/lib/db/client");
const node_crypto_1 = require("node:crypto");
const logger_1 = require("@/lib/logging/logger");
const merkle_bundle_1 = require("./merkle-bundle");
class ChainOfCustodyService {
    constructor() {
        this.merkleBuilder = new merkle_bundle_1.MerkleTreeBuilder();
    }
    /**
     * Create immutable version of evidence
     */
    async createVersion(evidenceId, evidence, createdBy, metadata) {
        try {
            // Get current version count
            const currentVersions = await client_1.db.evidenceVersion.count({
                where: { evidenceId },
            });
            const versionNumber = currentVersions + 1;
            // Generate content hash
            const contentHash = this.generateContentHash(evidence);
            // Generate Merkle hash if multiple versions exist
            let merkleHash;
            if (currentVersions > 0) {
                const previousVersions = await client_1.db.evidenceVersion.findMany({
                    where: { evidenceId },
                    orderBy: { versionNumber: "asc" },
                });
                const allEvidence = previousVersions.map((v) => ({
                    evidence_id: evidenceId,
                    version_number: v.versionNumber,
                    content_hash: v.contentHash,
                }));
                const merkleTree = this.merkleBuilder.buildTree(allEvidence);
                merkleHash = merkleTree.hash;
            }
            // Generate signature
            const signature = this.signVersion(evidenceId, versionNumber, contentHash, merkleHash);
            // Create version record
            const version = await client_1.db.evidenceVersion.create({
                data: {
                    evidenceId,
                    tenantId: evidence.tenant_id,
                    versionNumber: versionNumber,
                    contentHash,
                    merkleHash: merkleHash || undefined,
                    signature,
                    createdBy,
                    metadata: metadata || undefined,
                },
            });
            logger_1.logger.info("Evidence version created", {
                evidenceId,
                versionNumber,
                contentHash,
                createdBy,
            });
            return {
                evidence_id: version.evidenceId,
                version_number: version.versionNumber,
                content_hash: version.contentHash,
                merkle_hash: version.merkleHash || undefined,
                signature: version.signature,
                created_by: version.createdBy,
                created_at: version.createdAt.toISOString(),
                metadata: version.metadata || undefined,
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to create evidence version", {
                error: error instanceof Error ? error.message : String(error),
                evidenceId,
                createdBy,
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }
    /**
     * Verify chain of custody for evidence
     */
    async verifyChainOfCustody(evidenceId) {
        try {
            const versions = await client_1.db.evidenceVersion.findMany({
                where: { evidenceId },
                orderBy: { versionNumber: "asc" },
            });
            if (versions.length === 0) {
                return {
                    evidence_id: evidenceId,
                    valid: false,
                    version_count: 0,
                    latest_version: 0,
                    integrity_verified: false,
                    merkle_verified: false,
                    chain_complete: false,
                    issues: ["No versions found"],
                };
            }
            const issues = [];
            let integrityVerified = true;
            let merkleVerified = true;
            let chainComplete = true;
            // Verify each version's signature
            for (const version of versions) {
                const expectedSignature = this.signVersion(version.evidenceId, version.versionNumber, version.contentHash, version.merkleHash || undefined);
                if (version.signature !== expectedSignature) {
                    integrityVerified = false;
                    issues.push(`Version ${version.versionNumber}: Signature mismatch`);
                }
            }
            // Verify Merkle tree if multiple versions
            if (versions.length > 1) {
                const merkleTree = this.merkleBuilder.buildTree(versions.map((v) => ({
                    evidence_id: v.evidenceId,
                    version_number: v.versionNumber,
                    content_hash: v.contentHash,
                })));
                const latestVersion = versions[versions.length - 1];
                if (latestVersion.merkleHash && latestVersion.merkleHash !== merkleTree.hash) {
                    merkleVerified = false;
                    issues.push("Merkle tree verification failed");
                }
            }
            // Check for gaps in version numbers
            for (let i = 0; i < versions.length; i++) {
                if (versions[i].versionNumber !== i + 1) {
                    chainComplete = false;
                    issues.push(`Version gap detected: expected ${i + 1}, got ${versions[i].versionNumber}`);
                }
            }
            const valid = integrityVerified && merkleVerified && chainComplete;
            return {
                evidence_id: evidenceId,
                valid,
                version_count: versions.length,
                latest_version: versions[versions.length - 1].versionNumber,
                integrity_verified: integrityVerified,
                merkle_verified: merkleVerified,
                chain_complete: chainComplete,
                issues,
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to verify chain of custody", {
                error: error instanceof Error ? error.message : String(error),
                evidenceId,
                stack: error instanceof Error ? error.stack : undefined,
            });
            return {
                evidence_id: evidenceId,
                valid: false,
                version_count: 0,
                latest_version: 0,
                integrity_verified: false,
                merkle_verified: false,
                chain_complete: false,
                issues: [`Verification error: ${error instanceof Error ? error.message : String(error)}`],
            };
        }
    }
    /**
     * Get all versions for evidence
     */
    async getVersions(evidenceId) {
        const versions = await client_1.db.evidenceVersion.findMany({
            where: { evidenceId },
            orderBy: { versionNumber: "asc" },
        });
        return versions.map((v) => ({
            evidence_id: v.evidenceId,
            version_number: v.versionNumber,
            content_hash: v.contentHash,
            merkle_hash: v.merkleHash || undefined,
            signature: v.signature,
            created_by: v.createdBy,
            created_at: v.createdAt.toISOString(),
            metadata: v.metadata || undefined,
        }));
    }
    /**
     * Get specific version
     */
    async getVersion(evidenceId, versionNumber) {
        const version = await client_1.db.evidenceVersion.findUnique({
            where: {
                evidenceId_versionNumber: {
                    evidenceId,
                    versionNumber,
                },
            },
        });
        if (!version) {
            return null;
        }
        return {
            evidence_id: version.evidenceId,
            version_number: version.versionNumber,
            content_hash: version.contentHash,
            merkle_hash: version.merkleHash || undefined,
            signature: version.signature,
            created_by: version.createdBy,
            created_at: version.createdAt.toISOString(),
            metadata: version.metadata || undefined,
        };
    }
    /**
     * Generate content hash for evidence
     */
    generateContentHash(evidence) {
        const hashInput = JSON.stringify({
            tenant_id: evidence.tenant_id,
            type: evidence.type,
            source: evidence.source,
            content: evidence.content,
            provenance: evidence.provenance,
            created_at: evidence.created_at,
        });
        return (0, node_crypto_1.createHash)("sha256").update(hashInput).digest("hex");
    }
    /**
     * Sign version
     */
    signVersion(evidenceId, versionNumber, contentHash, merkleHash) {
        const secret = this.getSigningSecret();
        const payload = JSON.stringify({
            evidence_id: evidenceId,
            version_number: versionNumber,
            content_hash: contentHash,
            merkle_hash: merkleHash,
        });
        return (0, node_crypto_1.createHash)("sha256")
            .update(secret)
            .update(payload)
            .digest("hex");
    }
    /**
     * Get signing secret
     */
    getSigningSecret() {
        const configured = process.env.EVIDENCE_SIGNING_SECRET;
        if (configured && configured.trim().length > 0) {
            return configured;
        }
        if (process.env.NODE_ENV === "production") {
            throw new Error("EVIDENCE_SIGNING_SECRET is required in production");
        }
        // Non-production: use a default (not secure, but allows development)
        return "development-secret-change-in-production";
    }
}
exports.ChainOfCustodyService = ChainOfCustodyService;
