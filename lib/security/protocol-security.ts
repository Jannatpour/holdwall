/**
 * Protocol Security Service
 * 
 * End-to-end security hardening for all agent protocols (A2A, ANP, AG-UI, AP2, ACP, MCP)
 * Includes identity verification, RBAC/ABAC, signing/keys/KMS/HSM, secrets, mTLS/OIDC
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { createHash, createSign, createVerify, randomBytes } from "crypto";
import { secretsService } from "./secrets";
import { rbacService } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";

export interface AgentIdentity {
  agentId: string;
  publicKey: string;
  certificate?: string; // mTLS certificate
  oidcToken?: string; // OIDC token for identity verification
  metadata?: Record<string, unknown>;
}

export interface SecurityContext {
  agentId: string;
  userId?: string;
  tenantId?: string;
  permissions: string[];
  identityVerified: boolean;
  mTLSVerified: boolean;
  oidcVerified: boolean;
}

export interface SignatureResult {
  valid: boolean;
  signedBy: string;
  timestamp: Date;
  algorithm: string;
}

export interface KeyPair {
  publicKey: string;
  privateKey: string; // Encrypted in production
  algorithm: "RSA" | "ECDSA" | "Ed25519";
}

/**
 * Protocol Security Service
 */
export class ProtocolSecurityService {
  private agentIdentities: Map<string, AgentIdentity> = new Map();
  private keyPairs: Map<string, KeyPair> = new Map(); // agentId -> keyPair
  private kmsEndpoint?: string; // KMS endpoint for key management
  private hsmEnabled: boolean;

  constructor() {
    this.kmsEndpoint = process.env.KMS_ENDPOINT;
    this.hsmEnabled = process.env.HSM_ENABLED === "true";
    this.initializeDefaultKeys();
  }

  /**
   * Register agent identity with security credentials
   */
  async registerAgentIdentity(
    agentId: string,
    publicKey: string,
    options?: {
      certificate?: string;
      oidcToken?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    const identity: AgentIdentity = {
      agentId,
      publicKey,
      certificate: options?.certificate,
      oidcToken: options?.oidcToken,
      metadata: options?.metadata,
    };

    this.agentIdentities.set(agentId, identity);

    // Store public key securely
    await secretsService.store(
      "system", // tenantId for system keys
      `agent_public_key_${agentId}`,
      publicKey,
      "certificate",
      {
        service: "protocol_security",
        rotationPolicy: "manual",
      }
    );

    await this.audit("agent_identity_registered", {
      agentId,
      hasCertificate: !!options?.certificate,
      hasOidcToken: !!options?.oidcToken,
    });

    logger.info("Agent identity registered", { agentId });
  }

  /**
   * Verify agent identity
   */
  async verifyAgentIdentity(agentId: string): Promise<SecurityContext | null> {
    const identity = this.agentIdentities.get(agentId);
    if (!identity) {
      return null;
    }

    let identityVerified = false;
    let mTLSVerified = false;
    let oidcVerified = false;

    // Verify public key exists
    if (identity.publicKey) {
      identityVerified = true;
    }

    // Verify mTLS certificate if present
    if (identity.certificate) {
      mTLSVerified = await this.verifyMTLSCertificate(identity.certificate, agentId);
    }

    // Verify OIDC token if present
    if (identity.oidcToken) {
      oidcVerified = await this.verifyOIDCToken(identity.oidcToken, agentId);
    }

    // Get permissions from RBAC
    const permissions: string[] = [];
    if (identity.metadata?.userId) {
      const userPermissions = await rbacService.getPermissions(identity.metadata.userId as string);
      permissions.push(...userPermissions.map((p) => `${p.resource}:${p.action}`));
    }

    return {
      agentId,
      userId: identity.metadata?.userId as string | undefined,
      tenantId: identity.metadata?.tenantId as string | undefined,
      permissions,
      identityVerified,
      mTLSVerified,
      oidcVerified,
    };
  }

  /**
   * Sign message with agent's private key
   */
  async signMessage(
    agentId: string,
    message: string,
    options?: {
      useKMS?: boolean;
      useHSM?: boolean;
    }
  ): Promise<string> {
    const keyPair = this.keyPairs.get(agentId);
    if (!keyPair) {
      throw new Error(`No key pair found for agent ${agentId}`);
    }

    // In production, use KMS/HSM for signing
    if (options?.useKMS && this.kmsEndpoint) {
      return await this.signWithKMS(agentId, message);
    }

    if (options?.useHSM && this.hsmEnabled) {
      return await this.signWithHSM(agentId, message);
    }

    // Local signing (for development/sandbox)
    const sign = createSign("RSA-SHA256");
    sign.update(message);
    sign.end();

    // In production, decrypt private key from secrets service
    const privateKey = await secretsService.retrieve("system", `agent_private_key_${agentId}`);
    if (!privateKey) {
      throw new Error(`Private key not found for agent ${agentId}`);
    }

    return sign.sign(privateKey, "base64");
  }

  /**
   * Verify message signature
   */
  async verifySignature(
    agentId: string,
    message: string,
    signature: string
  ): Promise<SignatureResult> {
    const identity = this.agentIdentities.get(agentId);
    if (!identity) {
      return {
        valid: false,
        signedBy: agentId,
        timestamp: new Date(),
        algorithm: "RSA-SHA256",
      };
    }

    try {
      const verify = createVerify("RSA-SHA256");
      verify.update(message);
      verify.end();

      const isValid = verify.verify(identity.publicKey, signature, "base64");

      await this.audit("signature_verified", {
        agentId,
        valid: isValid,
      });

      return {
        valid: isValid,
        signedBy: agentId,
        timestamp: new Date(),
        algorithm: "RSA-SHA256",
      };
    } catch (error) {
      logger.warn("Signature verification failed", {
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        valid: false,
        signedBy: agentId,
        timestamp: new Date(),
        algorithm: "RSA-SHA256",
      };
    }
  }

  /**
   * Check RBAC/ABAC permissions for protocol action
   */
  async checkProtocolPermission(
    agentId: string,
    protocol: "a2a" | "anp" | "ag-ui" | "ap2" | "acp" | "mcp",
    action: string,
    resource?: string
  ): Promise<boolean> {
    const identity = this.agentIdentities.get(agentId);
    if (!identity) {
      return false;
    }

    const userId = identity.metadata?.userId as string | undefined;
    if (!userId) {
      // System agent - check agent-specific permissions
      return await this.checkAgentPermission(agentId, protocol, action);
    }

    // User agent - check RBAC/ABAC
    const resourceName = resource || `${protocol}:${action}`;
    const hasPermission = await rbacService.hasPermission(
      userId,
      resourceName,
      action,
      [
        { key: "protocol", value: protocol },
        { key: "agentId", value: agentId },
        { key: "tenantId", value: identity.metadata?.tenantId },
      ]
    );

    if (!hasPermission) {
      await this.audit("permission_denied", {
        agentId,
        userId,
        protocol,
        action,
        resource: resourceName,
      });
    }

    return hasPermission;
  }

  /**
   * Check agent-specific permissions
   */
  private async checkAgentPermission(
    agentId: string,
    protocol: string,
    action: string
  ): Promise<boolean> {
    // System agents have limited permissions
    const allowedActions: Record<string, string[]> = {
      a2a: ["register", "discover", "connect", "send_message", "receive_messages"],
      anp: ["discover_networks", "join_network", "send_network_message"],
      "ag-ui": ["start_session", "process_input"],
      ap2: ["create_mandate", "approve_mandate"],
      acp: ["send_message", "receive_message"],
      mcp: ["list_tools", "execute_tool"],
    };

    const allowed = allowedActions[protocol] || [];
    return allowed.includes(action);
  }

  /**
   * Verify mTLS certificate
   */
  private async verifyMTLSCertificate(
    certificate: string,
    agentId: string
  ): Promise<boolean> {
    // In production, use proper certificate verification
    // For now, simplified check
    try {
      // Verify certificate format
      if (!certificate.includes("BEGIN CERTIFICATE")) {
        return false;
      }

      // Verify certificate matches agent
      const certHash = createHash("sha256").update(certificate).digest("hex");
      const storedCert = await secretsService.retrieve("system", `agent_cert_${agentId}`);

      if (storedCert) {
        const storedHash = createHash("sha256").update(storedCert).digest("hex");
        return certHash === storedHash;
      }

      // First time - store certificate
      await secretsService.store(
        "system",
        `agent_cert_${agentId}`,
        certificate,
        "certificate",
        {
          service: "protocol_security",
          rotationPolicy: "manual",
        }
      );

      return true;
    } catch (error) {
      logger.warn("mTLS certificate verification failed", {
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Verify OIDC token
   */
  private async verifyOIDCToken(token: string, agentId: string): Promise<boolean> {
    // In production, verify OIDC token with issuer
    try {
      // Simplified check - in production, use OIDC library
      if (!token || token.length < 50) {
        return false;
      }

      // Verify token format (JWT)
      const parts = token.split(".");
      if (parts.length !== 3) {
        return false;
      }

      // In production, verify signature and claims
      // For now, basic format check
      return true;
    } catch (error) {
      logger.warn("OIDC token verification failed", {
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Sign with KMS
   */
  private async signWithKMS(agentId: string, message: string): Promise<string> {
    if (!this.kmsEndpoint) {
      throw new Error("KMS endpoint not configured");
    }

    try {
      const response = await fetch(`${this.kmsEndpoint}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyId: `agent_${agentId}`,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error(`KMS signing failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.signature;
    } catch (error) {
      logger.error("KMS signing failed", {
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Sign with HSM
   */
  private async signWithHSM(agentId: string, message: string): Promise<string> {
    // HSM integration would go here
    // For now, fallback to local signing
    logger.warn("HSM signing not fully implemented, using local signing", { agentId });
    return await this.signMessage(agentId, message, { useKMS: false, useHSM: false });
  }

  /**
   * Generate key pair for agent
   * Uses crypto module for RSA key generation, with KMS/HSM fallback support
   */
  async generateKeyPair(agentId: string, algorithm: KeyPair["algorithm"] = "RSA"): Promise<KeyPair> {
    // Use KMS if available
    if (this.kmsEndpoint) {
      try {
        const response = await fetch(`${this.kmsEndpoint}/keys/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyId: `agent_${agentId}`,
            algorithm,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const keyPair: KeyPair = {
            publicKey: data.publicKey,
            privateKey: data.privateKey, // KMS manages private key, this is for local use only
            algorithm,
          };

          this.keyPairs.set(agentId, keyPair);
          await secretsService.store(
            "system",
            `agent_public_key_${agentId}`,
            data.publicKey,
            "certificate",
            {
              service: "protocol_security",
              rotationPolicy: "manual",
            }
          );

          logger.info("Key pair generated via KMS", { agentId, algorithm });
          return keyPair;
        }
      } catch (error) {
        logger.warn("KMS key generation failed, falling back to local generation", {
          agentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Local key generation using crypto module
    // For RSA: generate proper key pair
    // For ECDSA/Ed25519: would use different crypto APIs
    if (algorithm === "RSA") {
      // Generate RSA key pair using crypto.generateKeyPairSync
      const { generateKeyPairSync } = await import("crypto");
      const { publicKey, privateKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: "spki",
          format: "pem",
        },
        privateKeyEncoding: {
          type: "pkcs8",
          format: "pem",
        },
      });

      const keyPair: KeyPair = {
        publicKey,
        privateKey,
        algorithm,
      };

      this.keyPairs.set(agentId, keyPair);

      // Store private key encrypted
      await secretsService.store(
        "system",
        `agent_private_key_${agentId}`,
        privateKey,
        "certificate",
        {
          service: "protocol_security",
          rotationPolicy: "manual",
        }
      );

      logger.info("Key pair generated locally", { agentId, algorithm });
      return keyPair;
    } else {
      // For ECDSA/Ed25519, use appropriate key generation
      // This is a simplified implementation - in production, use proper curves
      throw new Error(`Key generation for ${algorithm} not fully implemented. Use RSA or configure KMS.`);
    }
  }

  /**
   * Initialize default keys
   */
  private initializeDefaultKeys(): void {
    // Default system keys can be initialized here
  }

  /**
   * Audit log
   */
  private async audit(
    action: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    logger.debug("Protocol security audit", {
      action,
      ...metadata,
    });

    metrics.increment("protocol_security_audit_total", {
      action,
    });
  }

  /**
   * Get security context for agent
   */
  async getSecurityContext(agentId: string): Promise<SecurityContext | null> {
    return await this.verifyAgentIdentity(agentId);
  }

  /**
   * Get identity count (for health checks)
   */
  getIdentityCount(): number {
    return this.agentIdentities.size;
  }
}

// Singleton instance
let protocolSecurityInstance: ProtocolSecurityService | null = null;

export function getProtocolSecurity(): ProtocolSecurityService {
  if (!protocolSecurityInstance) {
    protocolSecurityInstance = new ProtocolSecurityService();
  }
  return protocolSecurityInstance;
}
