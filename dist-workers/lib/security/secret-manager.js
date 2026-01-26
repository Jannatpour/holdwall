"use strict";
/**
 * Secret Manager
 *
 * Integration with secret management services
 * Supports AWS Secrets Manager, HashiCorp Vault, and environment variables
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
exports.getSecret = getSecret;
exports.initializeSecretManager = initializeSecretManager;
exports.rotateSecret = rotateSecret;
const logger_1 = require("@/lib/logging/logger");
const crypto_1 = require("crypto");
let secretManagerConfig = {
    provider: process.env.SECRET_MANAGER_PROVIDER || "env",
    region: process.env.AWS_REGION,
    vaultUrl: process.env.VAULT_URL,
    vaultToken: process.env.VAULT_TOKEN,
};
/**
 * Get secret from secret manager
 */
async function getSecret(secretName) {
    switch (secretManagerConfig.provider) {
        case "aws":
            return getSecretFromAWS(secretName);
        case "vault":
            return getSecretFromVault(secretName);
        case "env":
        default:
            return getSecretFromEnv(secretName);
    }
}
/**
 * Get secret from AWS Secrets Manager
 */
async function getSecretFromAWS(secretName) {
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = secretManagerConfig.region || "us-east-1";
    if (!awsAccessKeyId || !awsSecretAccessKey) {
        console.warn("AWS credentials not configured, falling back to environment variables");
        return getSecretFromEnv(secretName);
    }
    try {
        // Use AWS SDK for Secrets Manager
        try {
            const { SecretsManagerClient, GetSecretValueCommand } = await Promise.resolve().then(() => __importStar(require("@aws-sdk/client-secrets-manager")));
            const client = new SecretsManagerClient({
                region,
                credentials: {
                    accessKeyId: awsAccessKeyId,
                    secretAccessKey: awsSecretAccessKey,
                },
            });
            const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
            if (response.SecretString) {
                return response.SecretString;
            }
            else if (response.SecretBinary) {
                // Decode binary secret
                const buff = Buffer.from(response.SecretBinary);
                return buff.toString("utf-8");
            }
            return null;
        }
        catch (sdkError) {
            if (sdkError.code === "MODULE_NOT_FOUND" || sdkError.message?.includes("Cannot find module")) {
                console.warn(`AWS Secrets Manager SDK not installed. Install with: npm install @aws-sdk/client-secrets-manager`);
                console.warn(`Falling back to environment variables for secret: ${secretName}`);
                return getSecretFromEnv(secretName);
            }
            throw sdkError;
        }
    }
    catch (error) {
        console.error("Failed to get secret from AWS Secrets Manager:", error);
        // Fallback to environment variables
        return getSecretFromEnv(secretName);
    }
}
/**
 * Get secret from HashiCorp Vault
 */
async function getSecretFromVault(secretName) {
    const vaultUrl = secretManagerConfig.vaultUrl;
    const vaultToken = secretManagerConfig.vaultToken;
    if (!vaultUrl || !vaultToken) {
        console.warn("Vault not configured, falling back to environment variables");
        return getSecretFromEnv(secretName);
    }
    try {
        // Use HashiCorp Vault HTTP API
        // Vault API path: /v1/secret/data/{path} for KV v2, or /v1/secret/{path} for KV v1
        const vaultPath = process.env.VAULT_SECRET_PATH || "secret";
        const vaultApiVersion = process.env.VAULT_KV_VERSION || "2"; // Default to KV v2
        let apiPath;
        if (vaultApiVersion === "2") {
            // KV v2: /v1/secret/data/{path}
            apiPath = `${vaultUrl}/v1/${vaultPath}/data/${secretName}`;
        }
        else {
            // KV v1: /v1/secret/{path}
            apiPath = `${vaultUrl}/v1/${vaultPath}/${secretName}`;
        }
        const response = await fetch(apiPath, {
            method: "GET",
            headers: {
                "X-Vault-Token": vaultToken,
            },
        });
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`Secret not found in Vault: ${secretName}`);
                return getSecretFromEnv(secretName);
            }
            throw new Error(`Vault API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        // Extract secret value based on KV version
        if (vaultApiVersion === "2") {
            // KV v2 structure: { data: { data: { key: value } } }
            return data.data?.data?.value || data.data?.data?.[secretName] || null;
        }
        else {
            // KV v1 structure: { data: { key: value } }
            return data.data?.value || data.data?.[secretName] || null;
        }
    }
    catch (error) {
        console.error("Failed to get secret from HashiCorp Vault:", error);
        // Fallback to environment variables
        return getSecretFromEnv(secretName);
    }
}
/**
 * Get secret from environment variables
 */
function getSecretFromEnv(secretName) {
    // Convert secret name to environment variable format
    const envKey = secretName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "_")
        .replace(/_+/g, "_");
    return process.env[envKey] || process.env[secretName] || null;
}
/**
 * Initialize secret manager
 */
function initializeSecretManager(config) {
    if (config) {
        secretManagerConfig = { ...secretManagerConfig, ...config };
    }
}
/**
 * Rotate secret - triggers rotation in the secret manager service
 */
async function rotateSecret(secretName) {
    logger_1.logger.info("Secret rotation requested", { secretName });
    switch (secretManagerConfig.provider) {
        case "aws":
            await rotateSecretInAWS(secretName);
            break;
        case "vault":
            await rotateSecretInVault(secretName);
            break;
        case "env":
        default:
            logger_1.logger.warn("Secret rotation not supported for environment variable provider", { secretName });
            throw new Error("Secret rotation not supported for environment variable provider");
    }
}
/**
 * Rotate secret in AWS Secrets Manager
 */
async function rotateSecretInAWS(secretName) {
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = secretManagerConfig.region || "us-east-1";
    if (!awsAccessKeyId || !awsSecretAccessKey) {
        throw new Error("AWS credentials not configured for secret rotation");
    }
    try {
        const { SecretsManagerClient, RotateSecretCommand, DescribeSecretCommand } = await Promise.resolve().then(() => __importStar(require("@aws-sdk/client-secrets-manager")));
        const client = new SecretsManagerClient({
            region,
            credentials: {
                accessKeyId: awsAccessKeyId,
                secretAccessKey: awsSecretAccessKey,
            },
        });
        // Check if secret exists and supports rotation
        const describeResponse = await client.send(new DescribeSecretCommand({ SecretId: secretName }));
        if (!describeResponse.ARN) {
            throw new Error(`Secret not found: ${secretName}`);
        }
        // Trigger rotation
        await client.send(new RotateSecretCommand({ SecretId: secretName }));
        logger_1.logger.info("Secret rotation triggered in AWS Secrets Manager", {
            secretName,
            arn: describeResponse.ARN,
        });
    }
    catch (error) {
        if (error.code === "MODULE_NOT_FOUND" || error.message?.includes("Cannot find module")) {
            throw new Error("AWS Secrets Manager SDK not installed. Install with: npm install @aws-sdk/client-secrets-manager");
        }
        logger_1.logger.error("Failed to rotate secret in AWS Secrets Manager", {
            secretName,
            error: error.message,
        });
        throw error;
    }
}
/**
 * Rotate secret in HashiCorp Vault
 */
async function rotateSecretInVault(secretName) {
    const vaultUrl = secretManagerConfig.vaultUrl;
    const vaultToken = secretManagerConfig.vaultToken;
    if (!vaultUrl || !vaultToken) {
        throw new Error("Vault not configured for secret rotation");
    }
    try {
        const vaultPath = process.env.VAULT_SECRET_PATH || "secret";
        const vaultApiVersion = process.env.VAULT_KV_VERSION || "2";
        // For KV v2, we need to read the current secret, generate a new value, and write it back
        // In production, you might use Vault's rotation API or a custom rotation function
        let apiPath;
        if (vaultApiVersion === "2") {
            apiPath = `${vaultUrl}/v1/${vaultPath}/data/${secretName}`;
        }
        else {
            apiPath = `${vaultUrl}/v1/${vaultPath}/${secretName}`;
        }
        // Read current secret
        const readResponse = await fetch(apiPath, {
            method: "GET",
            headers: {
                "X-Vault-Token": vaultToken,
            },
        });
        if (!readResponse.ok) {
            throw new Error(`Failed to read secret from Vault: ${readResponse.status} ${readResponse.statusText}`);
        }
        const currentData = await readResponse.json();
        // Generate new secret value (in production, use a proper rotation function)
        const newSecretValue = generateNewSecretValue();
        // Write new secret value
        let writePath;
        let writePayload;
        if (vaultApiVersion === "2") {
            writePath = `${vaultUrl}/v1/${vaultPath}/data/${secretName}`;
            writePayload = {
                data: {
                    ...(currentData.data?.data || {}),
                    value: newSecretValue,
                    rotated_at: new Date().toISOString(),
                },
            };
        }
        else {
            writePath = `${vaultUrl}/v1/${vaultPath}/${secretName}`;
            writePayload = {
                ...(currentData.data || {}),
                value: newSecretValue,
                rotated_at: new Date().toISOString(),
            };
        }
        const writeResponse = await fetch(writePath, {
            method: "POST",
            headers: {
                "X-Vault-Token": vaultToken,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(writePayload),
        });
        if (!writeResponse.ok) {
            throw new Error(`Failed to write rotated secret to Vault: ${writeResponse.status} ${writeResponse.statusText}`);
        }
        logger_1.logger.info("Secret rotated in HashiCorp Vault", { secretName });
    }
    catch (error) {
        logger_1.logger.error("Failed to rotate secret in HashiCorp Vault", {
            secretName,
            error: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
    }
}
/**
 * Generate new secret value
 */
function generateNewSecretValue() {
    return (0, crypto_1.randomBytes)(32).toString("hex");
}
