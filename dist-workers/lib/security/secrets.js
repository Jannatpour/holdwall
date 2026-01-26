"use strict";
/**
 * Production Secrets Management Service
 * Secure storage, rotation, and access control for sensitive credentials
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretsService = exports.SecretsManagementService = void 0;
const crypto_1 = require("crypto");
const client_1 = require("@/lib/db/client");
const redis_1 = require("@/lib/cache/redis");
const logger_1 = require("@/lib/logging/logger");
const ENCRYPTION_KEY = process.env.SECRETS_ENCRYPTION_KEY || "";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
/**
 * Encrypt secret value
 */
function encrypt(value) {
    if (!ENCRYPTION_KEY) {
        throw new Error("SECRETS_ENCRYPTION_KEY not configured");
    }
    const key = (0, crypto_1.createHash)("sha256").update(ENCRYPTION_KEY).digest();
    const iv = (0, crypto_1.randomBytes)(16);
    const cipher = (0, crypto_1.createCipheriv)(ENCRYPTION_ALGORITHM, key, iv);
    let encrypted = cipher.update(value, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");
    return {
        encrypted,
        iv: iv.toString("hex"),
        tag,
    };
}
/**
 * Decrypt secret value
 */
function decrypt(encrypted, iv, tag) {
    if (!ENCRYPTION_KEY) {
        throw new Error("SECRETS_ENCRYPTION_KEY not configured");
    }
    const key = (0, crypto_1.createHash)("sha256").update(ENCRYPTION_KEY).digest();
    const decipher = (0, crypto_1.createDecipheriv)(ENCRYPTION_ALGORITHM, key, Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}
class SecretsManagementService {
    /**
     * Store a secret
     */
    async store(tenantId, name, value, type, options) {
        // Encrypt the value
        const { encrypted, iv, tag } = encrypt(value);
        // Calculate next rotation if scheduled
        let nextRotation;
        if (options?.rotationPolicy === "scheduled" && options?.rotationIntervalDays) {
            nextRotation = new Date();
            nextRotation.setDate(nextRotation.getDate() + options.rotationIntervalDays);
        }
        // Store in database (encrypted)
        const secret = await client_1.db.secret.create({
            data: {
                tenantId,
                name,
                type,
                service: options?.service,
                encryptedValue: encrypted,
                iv,
                tag,
                rotationPolicy: options?.rotationPolicy || "manual",
                rotationIntervalDays: options?.rotationIntervalDays,
                version: 1,
                nextRotation,
            },
        });
        // Store metadata in cache for quick access
        const metadata = {
            id: secret.id,
            name,
            type,
            service: options?.service,
            tenantId,
            rotationPolicy: options?.rotationPolicy || "manual",
            rotationIntervalDays: options?.rotationIntervalDays,
            accessCount: 0,
            createdAt: secret.createdAt,
            updatedAt: secret.updatedAt,
            nextRotation,
        };
        await (0, redis_1.setCache)(`secret:meta:${tenantId}:${name}`, metadata, { ttl: 3600 });
        logger_1.logger.info("Secret stored", {
            tenantId,
            name,
            type,
            service: options?.service,
        });
        return metadata.id;
    }
    /**
     * Retrieve a secret (with access logging)
     */
    async retrieve(tenantId, name) {
        // Cache is an optimization only. Always fall back to DB when cache misses.
        const cacheKey = `secret:meta:${tenantId}:${name}`;
        const cached = await (0, redis_1.getCache)(cacheKey);
        // Fetch encrypted value from database (source of truth)
        const secret = await client_1.db.secret.findFirst({
            where: {
                tenantId,
                name,
                revoked: false,
            },
            orderBy: {
                version: "desc",
            },
        });
        if (!secret) {
            return null;
        }
        // Backfill metadata cache on miss (or if stale/mismatched)
        if (!cached || cached.id !== secret.id) {
            const metadata = {
                id: secret.id,
                name: secret.name,
                type: secret.type,
                service: secret.service || undefined,
                tenantId: secret.tenantId,
                lastRotated: secret.lastRotated || undefined,
                nextRotation: secret.nextRotation || undefined,
                rotationPolicy: secret.rotationPolicy,
                rotationIntervalDays: secret.rotationIntervalDays || undefined,
                accessCount: secret.accessCount,
                lastAccessed: secret.lastAccessed || undefined,
                createdAt: secret.createdAt,
                updatedAt: secret.updatedAt,
            };
            await (0, redis_1.setCache)(cacheKey, metadata, { ttl: 3600 });
        }
        // Decrypt
        const value = decrypt(secret.encryptedValue, secret.iv, secret.tag);
        // Update access metadata
        await client_1.db.secret.updateMany({
            where: {
                tenantId,
                name,
            },
            data: {
                accessCount: {
                    increment: 1,
                },
                lastAccessed: new Date(),
            },
        });
        logger_1.logger.info("Secret retrieved", {
            tenantId,
            name,
        });
        return value;
    }
    /**
     * Rotate a secret
     */
    async rotate(tenantId, name, newValue) {
        // Get current version
        const current = await client_1.db.secret.findFirst({
            where: {
                tenantId,
                name,
                revoked: false,
            },
            orderBy: {
                version: "desc",
            },
        });
        if (!current) {
            throw new Error(`Secret not found: ${name}`);
        }
        const nextVersion = current.version + 1;
        // Encrypt new value
        const { encrypted, iv, tag } = encrypt(newValue);
        // Calculate next rotation if scheduled
        let nextRotation;
        if (current.rotationPolicy === "scheduled" && current.rotationIntervalDays) {
            nextRotation = new Date();
            nextRotation.setDate(nextRotation.getDate() + current.rotationIntervalDays);
        }
        // Store new version
        await client_1.db.secret.create({
            data: {
                tenantId,
                name,
                type: current.type,
                service: current.service,
                encryptedValue: encrypted,
                iv,
                tag,
                rotationPolicy: current.rotationPolicy,
                rotationIntervalDays: current.rotationIntervalDays,
                version: nextVersion,
                lastRotated: new Date(),
                nextRotation,
            },
        });
        // Update metadata
        const metadata = await (0, redis_1.getCache)(`secret:meta:${tenantId}:${name}`);
        if (metadata) {
            metadata.lastRotated = new Date();
            metadata.updatedAt = new Date();
            if (metadata.rotationPolicy === "scheduled" && metadata.rotationIntervalDays) {
                metadata.nextRotation = new Date();
                metadata.nextRotation.setDate(metadata.nextRotation.getDate() + metadata.rotationIntervalDays);
            }
            await (0, redis_1.setCache)(`secret:meta:${tenantId}:${name}`, metadata, { ttl: 3600 });
        }
        logger_1.logger.info("Secret rotated", {
            tenantId,
            name,
            version: nextVersion,
        });
    }
    /**
     * Revoke a secret
     */
    async revoke(tenantId, name) {
        await client_1.db.secret.updateMany({
            where: {
                tenantId,
                name,
            },
            data: {
                revoked: true,
                updatedAt: new Date(),
            },
        });
        // Remove from cache
        await (0, redis_1.setCache)(`secret:meta:${tenantId}:${name}`, null, { ttl: 0 });
        logger_1.logger.info("Secret revoked", {
            tenantId,
            name,
        });
    }
    /**
     * List secrets for a tenant
     */
    async list(tenantId) {
        // Get latest version of each secret
        const secrets = await client_1.db.secret.findMany({
            where: {
                tenantId,
                revoked: false,
            },
            orderBy: [
                { name: "asc" },
                { version: "desc" },
            ],
            distinct: ["name"],
        });
        return secrets.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            service: s.service || undefined,
            tenantId,
            lastRotated: s.lastRotated || undefined,
            nextRotation: s.nextRotation || undefined,
            rotationPolicy: s.rotationPolicy,
            rotationIntervalDays: s.rotationIntervalDays || undefined,
            accessCount: s.accessCount,
            lastAccessed: s.lastAccessed || undefined,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
        }));
    }
    /**
     * Check for secrets requiring rotation
     */
    async checkRotationSchedule() {
        const now = new Date();
        const secrets = await client_1.db.secret.findMany({
            where: {
                revoked: false,
                rotationPolicy: "scheduled",
                nextRotation: {
                    lte: now,
                },
            },
            distinct: ["name", "tenantId"],
            select: {
                tenantId: true,
                name: true,
            },
        });
        return secrets.map((s) => ({
            tenantId: s.tenantId,
            name: s.name,
        }));
    }
}
exports.SecretsManagementService = SecretsManagementService;
exports.secretsService = new SecretsManagementService();
