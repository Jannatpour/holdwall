"use strict";
/**
 * Protocol Security Service
 *
 * End-to-end security hardening for all agent protocols (A2A, ANP, AG-UI, AP2, ACP, MCP)
 * Includes identity verification, RBAC/ABAC, signing/keys/KMS/HSM, secrets, mTLS/OIDC
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtocolSecurityService = void 0;
exports.getProtocolSecurity = getProtocolSecurity;
const logger_1 = require("@/lib/logging/logger");
const metrics_1 = require("@/lib/observability/metrics");
const crypto_1 = require("crypto");
const secrets_1 = require("./secrets");
const rbac_1 = require("@/lib/auth/rbac");
const client_1 = require("@/lib/db/client");
/**
 * Protocol Security Service
 */
class ProtocolSecurityService {
    constructor() {
        this.agentIdentities = new Map();
        this.keyPairs = new Map(); // agentId -> keyPair
        this.kmsEndpoint = process.env.KMS_ENDPOINT;
        this.hsmEnabled = process.env.HSM_ENABLED === "true";
        this.initializeDefaultKeys();
    }
    /**
     * Register agent identity with security credentials
     */
    async registerAgentIdentity(agentId, publicKey, options) {
        const identity = {
            agentId,
            publicKey,
            certificate: options?.certificate,
            oidcToken: options?.oidcToken,
            metadata: options?.metadata,
        };
        this.agentIdentities.set(agentId, identity);
        // Public keys are not secrets. Persisting them in a secrets store makes rotation harder and
        // introduces availability coupling to cache/DB. Keep them in-memory and (when available)
        // rely on protocol registries (e.g. A2A AgentRegistry) for persistence.
        await this.audit("agent_identity_registered", {
            agentId,
            hasCertificate: !!options?.certificate,
            hasOidcToken: !!options?.oidcToken,
        });
        logger_1.logger.info("Agent identity registered", { agentId });
    }
    /**
     * Verify agent identity
     */
    async verifyAgentIdentity(agentId) {
        let identity = this.agentIdentities.get(agentId);
        // Best-effort DB backfill for persisted agent registries (public keys are stored in Prisma AgentRegistry).
        if (!identity) {
            try {
                const record = await client_1.db.agentRegistry.findUnique({
                    where: { agentId },
                    select: { publicKey: true, metadata: true },
                });
                if (record?.publicKey) {
                    identity = {
                        agentId,
                        publicKey: record.publicKey,
                        metadata: record.metadata || undefined,
                    };
                    this.agentIdentities.set(agentId, identity);
                }
            }
            catch {
                // Ignore DB lookup failures (unit tests / offline DB)
            }
        }
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
        const permissions = [];
        if (identity.metadata?.userId) {
            const userPermissions = await rbac_1.rbacService.getPermissions(identity.metadata.userId);
            permissions.push(...userPermissions.map((p) => `${p.resource}:${p.action}`));
        }
        return {
            agentId,
            userId: identity.metadata?.userId,
            tenantId: identity.metadata?.tenantId,
            permissions,
            identityVerified,
            mTLSVerified,
            oidcVerified,
        };
    }
    /**
     * Sign message with agent's private key
     */
    async signMessage(agentId, message, options) {
        // Only agents with locally-managed keys can be used for server-side signing.
        // Typical agents sign with their own private keys externally; the server verifies via public keys.
        if (!this.keyPairs.has(agentId)) {
            // For internal/system agents we generate a signing key on first use.
            // This requires SECRETS_ENCRYPTION_KEY to be configured.
            await this.generateKeyPair(agentId, "RSA");
        }
        // In production, use KMS/HSM for signing
        if (options?.useKMS && this.kmsEndpoint) {
            return await this.signWithKMS(agentId, message);
        }
        if (options?.useHSM && this.hsmEnabled) {
            return await this.signWithHSM(agentId, message);
        }
        // Local signing (for development/sandbox)
        const sign = (0, crypto_1.createSign)("RSA-SHA256");
        sign.update(message);
        sign.end();
        // Decrypt private key from secrets service
        const privateKey = await secrets_1.secretsService.retrieve("system", `agent_private_key_${agentId}`);
        if (!privateKey) {
            throw new Error(`Private key not found for agent ${agentId}`);
        }
        return sign.sign(privateKey, "base64");
    }
    /**
     * Verify message signature
     */
    async verifySignature(agentId, message, signature) {
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
            const verify = (0, crypto_1.createVerify)("RSA-SHA256");
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
        }
        catch (error) {
            logger_1.logger.warn("Signature verification failed", {
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
    async checkProtocolPermission(agentId, protocol, action, resource) {
        const identity = this.agentIdentities.get(agentId);
        if (!identity) {
            return false;
        }
        const userId = identity.metadata?.userId;
        if (!userId) {
            // System agent - check agent-specific permissions
            return await this.checkAgentPermission(agentId, protocol, action);
        }
        // User agent - check RBAC/ABAC
        const resourceName = resource || `${protocol}:${action}`;
        const hasPermission = await rbac_1.rbacService.hasPermission(userId, resourceName, action, [
            { key: "protocol", value: protocol },
            { key: "agentId", value: agentId },
            { key: "tenantId", value: identity.metadata?.tenantId },
        ]);
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
    async checkAgentPermission(agentId, protocol, action) {
        // System agents have limited permissions
        const allowedActions = {
            a2a: ["register", "discover", "connect", "send_message", "receive_messages"],
            anp: ["discover_networks", "join_network", "send_network_message"],
            "ag-ui": ["start_session", "process_input"],
            ap2: ["create_mandate", "approve_mandate", "execute_payment", "credit_wallet", "revoke_mandate", "get_audit_logs"],
            acp: ["send_message", "receive_message"],
            mcp: ["list_tools", "execute_tool"],
        };
        const allowed = allowedActions[protocol] || [];
        return allowed.includes(action);
    }
    /**
     * Verify mTLS certificate
     */
    async verifyMTLSCertificate(certificate, agentId) {
        // In production, use proper certificate verification
        // For now, simplified check
        try {
            // Verify certificate format
            if (!certificate.includes("BEGIN CERTIFICATE")) {
                return false;
            }
            // Verify certificate matches agent
            const certHash = (0, crypto_1.createHash)("sha256").update(certificate).digest("hex");
            const storedCert = await secrets_1.secretsService.retrieve("system", `agent_cert_${agentId}`);
            if (storedCert) {
                const storedHash = (0, crypto_1.createHash)("sha256").update(storedCert).digest("hex");
                return certHash === storedHash;
            }
            // First time - store certificate
            await secrets_1.secretsService.store("system", `agent_cert_${agentId}`, certificate, "certificate", {
                service: "protocol_security",
                rotationPolicy: "manual",
            });
            return true;
        }
        catch (error) {
            logger_1.logger.warn("mTLS certificate verification failed", {
                agentId,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    /**
     * Verify OIDC token
     */
    async verifyOIDCToken(token, agentId) {
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
        }
        catch (error) {
            logger_1.logger.warn("OIDC token verification failed", {
                agentId,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    /**
     * Sign with KMS
     */
    async signWithKMS(agentId, message) {
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
        }
        catch (error) {
            logger_1.logger.error("KMS signing failed", {
                agentId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    /**
     * Sign with HSM
     */
    async signWithHSM(agentId, message) {
        // HSM integration would go here
        // For now, fallback to local signing
        logger_1.logger.warn("HSM signing not fully implemented, using local signing", { agentId });
        return await this.signMessage(agentId, message, { useKMS: false, useHSM: false });
    }
    /**
     * Generate key pair for agent
     * Uses crypto module for RSA key generation, with KMS/HSM fallback support
     */
    async generateKeyPair(agentId, algorithm = "RSA") {
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
                    const keyPair = {
                        publicKey: data.publicKey,
                        privateKey: data.privateKey, // KMS manages private key, this is for local use only
                        algorithm,
                    };
                    this.keyPairs.set(agentId, keyPair);
                    await secrets_1.secretsService.store("system", `agent_public_key_${agentId}`, data.publicKey, "certificate", {
                        service: "protocol_security",
                        rotationPolicy: "manual",
                    });
                    logger_1.logger.info("Key pair generated via KMS", { agentId, algorithm });
                    return keyPair;
                }
            }
            catch (error) {
                logger_1.logger.warn("KMS key generation failed, falling back to local generation", {
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
            const { generateKeyPairSync } = await Promise.resolve().then(() => __importStar(require("crypto")));
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
            const keyPair = {
                publicKey,
                privateKey,
                algorithm,
            };
            this.keyPairs.set(agentId, keyPair);
            // Store private key encrypted
            await secrets_1.secretsService.store("system", `agent_private_key_${agentId}`, privateKey, "certificate", {
                service: "protocol_security",
                rotationPolicy: "manual",
            });
            logger_1.logger.info("Key pair generated locally", { agentId, algorithm });
            return keyPair;
        }
        else {
            // For ECDSA/Ed25519, use appropriate key generation
            // This is a simplified implementation - in production, use proper curves
            throw new Error(`Key generation for ${algorithm} not fully implemented. Use RSA or configure KMS.`);
        }
    }
    /**
     * Initialize default keys
     */
    initializeDefaultKeys() {
        // Default system keys can be initialized here
    }
    /**
     * Audit log
     */
    async audit(action, metadata) {
        logger_1.logger.debug("Protocol security audit", {
            action,
            ...metadata,
        });
        metrics_1.metrics.increment("protocol_security_audit_total", {
            action,
        });
    }
    /**
     * Get security context for agent
     */
    async getSecurityContext(agentId) {
        return await this.verifyAgentIdentity(agentId);
    }
    /**
     * Get identity count (for health checks)
     */
    getIdentityCount() {
        return this.agentIdentities.size;
    }
}
exports.ProtocolSecurityService = ProtocolSecurityService;
// Singleton instance
let protocolSecurityInstance = null;
function getProtocolSecurity() {
    if (!protocolSecurityInstance) {
        protocolSecurityInstance = new ProtocolSecurityService();
    }
    return protocolSecurityInstance;
}
