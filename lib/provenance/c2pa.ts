/**
 * C2PA (Content Credentials) Support
 * 
 * Package published artifacts with C2PA credentials so third parties can validate provenance.
 * Based on: https://c2pa.org/specifications/specifications/2.3/specs/C2PA_Specification.html
 */

import { logger } from "@/lib/logging/logger";
import crypto from "crypto";

export interface C2PACredential {
  /** C2PA manifest version */
  version: string;
  /** Claim generator (tool that created this) */
  claim_generator: string;
  /** Assertions */
  assertions: C2PAAssertion[];
  /** Signature */
  signature?: C2PASignature;
}

export interface C2PAAssertion {
  /** Assertion label */
  label: string;
  /** Assertion data */
  data: Record<string, unknown>;
}

export interface C2PASignature {
  /** Algorithm */
  algorithm: string;
  /** Signature value (base64) */
  value: string;
  /** Certificate chain */
  certificates?: string[];
  /** Timestamp */
  timestamp?: string;
}

export interface C2PAPackagingOptions {
  /** Author/creator identifier */
  author_id: string;
  /** Policy reference */
  policy_ref?: string;
  /** Source evidence references */
  evidence_refs?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Sign with private key (optional) */
  sign?: boolean;
  /** Private key for signing (if sign=true) */
  private_key?: string;
}

/**
 * C2PA Credential Builder
 */
export class C2PABuilder {
  /**
   * Create C2PA credential for an artifact
   */
  async createCredential(
    artifact: {
      id: string;
      content: string;
      author_id: string;
      created_at: string;
      evidence_refs?: string[];
      policy_ref?: string;
    },
    options: C2PAPackagingOptions = { author_id: artifact.author_id }
  ): Promise<C2PACredential> {
    const assertions: C2PAAssertion[] = [];

    // Assertion 1: Creative Work
    assertions.push({
      label: "stds.schema.org.CreativeWork",
      data: {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        identifier: artifact.id,
        dateCreated: artifact.created_at,
        creator: {
          "@type": "Person",
          identifier: artifact.author_id,
        },
      },
    });

    // Assertion 2: Actions (what was done)
    assertions.push({
      label: "c2pa.actions",
      data: {
        actions: [
          {
            action: "c2pa.created",
            when: artifact.created_at,
            softwareAgent: {
              name: "Holdwall POS",
              version: "1.1.0",
            },
          },
        ],
      },
    });

    // Assertion 3: Evidence references
    if (artifact.evidence_refs && artifact.evidence_refs.length > 0) {
      assertions.push({
        label: "c2pa.holdwall.evidence",
        data: {
          evidence_refs: artifact.evidence_refs,
          evidence_count: artifact.evidence_refs.length,
        },
      });
    }

    // Assertion 4: Policy reference
    if (artifact.policy_ref || options.policy_ref) {
      assertions.push({
        label: "c2pa.policy",
        data: {
          policy_ref: artifact.policy_ref || options.policy_ref,
        },
      });
    }

    // Assertion 5: Additional metadata
    if (options.metadata) {
      assertions.push({
        label: "c2pa.holdwall.metadata",
        data: options.metadata,
      });
    }

    const credential: C2PACredential = {
      version: "2.3",
      claim_generator: "Holdwall POS 1.1.0",
      assertions,
    };

    // Sign if requested
    if (options.sign && options.private_key) {
      credential.signature = await this.signCredential(credential, options.private_key);
    }

    return credential;
  }

  /**
   * Sign credential with private key
   */
  private async signCredential(
    credential: C2PACredential,
    privateKey: string
  ): Promise<C2PASignature> {
    try {
      // Create signature
      const sign = crypto.createSign("SHA256");
      const credentialJson = JSON.stringify(credential, null, 0);
      sign.update(credentialJson);
      sign.end();

      const signature = sign.sign(privateKey, "base64");

      return {
        algorithm: "RS256",
        value: signature,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("C2PA: Failed to sign credential", { error });
      throw new Error("Failed to sign C2PA credential");
    }
  }

  /**
   * Embed credential into artifact (JSON-LD format)
   */
  embedCredential(artifact: string, credential: C2PACredential): string {
    const embedded = {
      "@context": "https://c2pa.org/specifications/specifications/2.3/specs/",
      "@type": "CreativeWork",
      content: artifact,
      credential: credential,
    };

    return JSON.stringify(embedded, null, 2);
  }

  /**
   * Extract and verify credential from artifact
   */
  async verifyCredential(embeddedArtifact: string): Promise<{
    valid: boolean;
    credential?: C2PACredential;
    errors?: string[];
  }> {
    try {
      const parsed = JSON.parse(embeddedArtifact);

      if (!parsed.credential) {
        return {
          valid: false,
          errors: ["No C2PA credential found"],
        };
      }

      const credential = parsed.credential as C2PACredential;

      // Basic validation
      const errors: string[] = [];

      if (!credential.version) {
        errors.push("Missing version");
      }

      if (!credential.claim_generator) {
        errors.push("Missing claim generator");
      }

      if (!credential.assertions || credential.assertions.length === 0) {
        errors.push("No assertions found");
      }

      // Verify signature if present
      if (credential.signature) {
        // In production, verify against certificate chain
        // For now, just check signature exists
        if (!credential.signature.value) {
          errors.push("Invalid signature");
        }
      }

      return {
        valid: errors.length === 0,
        credential: errors.length === 0 ? credential : undefined,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      logger.error("C2PA: Failed to verify credential", { error });
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : "Parse error"],
      };
    }
  }

  /**
   * Generate C2PA manifest file
   */
  generateManifest(credential: C2PACredential): string {
    return JSON.stringify(credential, null, 2);
  }
}
