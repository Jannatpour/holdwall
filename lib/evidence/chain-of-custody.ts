/**
 * Chain of Custody Service
 * 
 * Tracks immutable evidence versions and provides chain-of-custody verification.
 * Ensures evidence integrity through Merkle tree hashing and version tracking.
 */

import { db } from "@/lib/db/client";
import { createHash } from "node:crypto";
import { logger } from "@/lib/logging/logger";
import { MerkleTreeBuilder } from "./merkle-bundle";
import type { Evidence } from "./vault";

export interface ChainOfCustodyEntry {
  evidence_id: string;
  version_number: number;
  content_hash: string;
  merkle_hash?: string;
  signature: string;
  created_by: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface ChainOfCustodyVerification {
  evidence_id: string;
  valid: boolean;
  version_count: number;
  latest_version: number;
  integrity_verified: boolean;
  merkle_verified: boolean;
  chain_complete: boolean;
  issues: string[];
}

export class ChainOfCustodyService {
  private merkleBuilder: MerkleTreeBuilder;

  constructor() {
    this.merkleBuilder = new MerkleTreeBuilder();
  }

  /**
   * Create immutable version of evidence
   */
  async createVersion(
    evidenceId: string,
    evidence: Evidence,
    createdBy: string,
    metadata?: Record<string, unknown>
  ): Promise<ChainOfCustodyEntry> {
    try {
      // Get current version count
      const currentVersions = await db.evidenceVersion.count({
        where: { evidenceId },
      });

      const versionNumber = currentVersions + 1;

      // Generate content hash
      const contentHash = this.generateContentHash(evidence);

      // Generate Merkle hash if multiple versions exist
      let merkleHash: string | undefined;
      if (currentVersions > 0) {
        const previousVersions = await db.evidenceVersion.findMany({
          where: { evidenceId },
          orderBy: { versionNumber: "asc" },
        });

        const allEvidence = previousVersions.map((v) => ({
          evidence_id: evidenceId,
          version_number: v.versionNumber,
          content_hash: v.contentHash,
        }));

        const merkleTree = this.merkleBuilder.buildTree(
          allEvidence as any
        );
        merkleHash = merkleTree.hash;
      }

      // Generate signature
      const signature = this.signVersion(evidenceId, versionNumber, contentHash, merkleHash);

      // Create version record
      const version = await db.evidenceVersion.create({
        data: {
          evidenceId,
          tenantId: evidence.tenant_id,
          versionNumber: versionNumber,
          contentHash,
          merkleHash: merkleHash || undefined,
          signature,
          createdBy,
          metadata: (metadata as any) || undefined,
        },
      });

      logger.info("Evidence version created", {
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
        metadata: (version.metadata as Record<string, unknown>) || undefined,
      };
    } catch (error) {
      logger.error("Failed to create evidence version", {
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
  async verifyChainOfCustody(evidenceId: string): Promise<ChainOfCustodyVerification> {
    try {
      const versions = await db.evidenceVersion.findMany({
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

      const issues: string[] = [];
      let integrityVerified = true;
      let merkleVerified = true;
      let chainComplete = true;

      // Verify each version's signature
      for (const version of versions) {
        const expectedSignature = this.signVersion(
          version.evidenceId,
          version.versionNumber,
          version.contentHash,
          version.merkleHash || undefined
        );

        if (version.signature !== expectedSignature) {
          integrityVerified = false;
          issues.push(`Version ${version.versionNumber}: Signature mismatch`);
        }
      }

      // Verify Merkle tree if multiple versions
      if (versions.length > 1) {
        const merkleTree = this.merkleBuilder.buildTree(
          versions.map((v) => ({
            evidence_id: v.evidenceId,
            version_number: v.versionNumber,
            content_hash: v.contentHash,
          })) as any
        );

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
    } catch (error) {
      logger.error("Failed to verify chain of custody", {
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
  async getVersions(evidenceId: string): Promise<ChainOfCustodyEntry[]> {
    const versions = await db.evidenceVersion.findMany({
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
      metadata: (v.metadata as Record<string, unknown>) || undefined,
    }));
  }

  /**
   * Get specific version
   */
  async getVersion(evidenceId: string, versionNumber: number): Promise<ChainOfCustodyEntry | null> {
    const version = await db.evidenceVersion.findUnique({
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
      metadata: (version.metadata as Record<string, unknown>) || undefined,
    };
  }

  /**
   * Generate content hash for evidence
   */
  private generateContentHash(evidence: Evidence): string {
    const hashInput = JSON.stringify({
      tenant_id: evidence.tenant_id,
      type: evidence.type,
      source: evidence.source,
      content: evidence.content,
      provenance: evidence.provenance,
      created_at: evidence.created_at,
    });

    return createHash("sha256").update(hashInput).digest("hex");
  }

  /**
   * Sign version
   */
  private signVersion(
    evidenceId: string,
    versionNumber: number,
    contentHash: string,
    merkleHash?: string
  ): string {
    const secret = this.getSigningSecret();
    const payload = JSON.stringify({
      evidence_id: evidenceId,
      version_number: versionNumber,
      content_hash: contentHash,
      merkle_hash: merkleHash,
    });

    return createHash("sha256")
      .update(secret)
      .update(payload)
      .digest("hex");
  }

  /**
   * Get signing secret
   */
  private getSigningSecret(): string {
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
