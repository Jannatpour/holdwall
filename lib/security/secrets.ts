/**
 * Production Secrets Management Service
 * Secure storage, rotation, and access control for sensitive credentials
 */

import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { db } from "@/lib/db/client";
import { getCache, setCache } from "@/lib/cache/redis";
import { logger } from "@/lib/logging/logger";

const ENCRYPTION_KEY = process.env.SECRETS_ENCRYPTION_KEY || "";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

export interface SecretMetadata {
  id: string;
  name: string;
  type: "api_key" | "password" | "token" | "certificate" | "other";
  service?: string;
  tenantId: string;
  lastRotated?: Date;
  nextRotation?: Date;
  rotationPolicy: "manual" | "scheduled" | "on-demand";
  rotationIntervalDays?: number;
  accessCount: number;
  lastAccessed?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecretValue {
  value: string;
  version: number;
  encrypted: boolean;
}

/**
 * Encrypt secret value
 */
function encrypt(value: string): { encrypted: string; iv: string; tag: string } {
  if (!ENCRYPTION_KEY) {
    throw new Error("SECRETS_ENCRYPTION_KEY not configured");
  }

  const key = createHash("sha256").update(ENCRYPTION_KEY).digest();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

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
function decrypt(encrypted: string, iv: string, tag: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error("SECRETS_ENCRYPTION_KEY not configured");
  }

  const key = createHash("sha256").update(ENCRYPTION_KEY).digest();
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export class SecretsManagementService {
  /**
   * Store a secret
   */
  async store(
    tenantId: string,
    name: string,
    value: string,
    type: SecretMetadata["type"],
    options?: {
      service?: string;
      rotationPolicy?: "manual" | "scheduled" | "on-demand";
      rotationIntervalDays?: number;
    }
  ): Promise<string> {
    // Encrypt the value
    const { encrypted, iv, tag } = encrypt(value);

    // Calculate next rotation if scheduled
    let nextRotation: Date | undefined;
    if (options?.rotationPolicy === "scheduled" && options?.rotationIntervalDays) {
      nextRotation = new Date();
      nextRotation.setDate(nextRotation.getDate() + options.rotationIntervalDays);
    }

    // Store in database (encrypted)
    const secret = await db.secret.create({
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
    const metadata: SecretMetadata = {
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

    await setCache(`secret:meta:${tenantId}:${name}`, metadata, { ttl: 3600 });

    logger.info("Secret stored", {
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
  async retrieve(tenantId: string, name: string): Promise<string | null> {
    // Cache is an optimization only. Always fall back to DB when cache misses.
    const cacheKey = `secret:meta:${tenantId}:${name}`;
    const cached = await getCache<SecretMetadata>(cacheKey);

    // Fetch encrypted value from database (source of truth)
    const secret = await db.secret.findFirst({
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
      const metadata: SecretMetadata = {
        id: secret.id,
        name: secret.name,
        type: secret.type as SecretMetadata["type"],
        service: secret.service || undefined,
        tenantId: secret.tenantId,
        lastRotated: secret.lastRotated || undefined,
        nextRotation: secret.nextRotation || undefined,
        rotationPolicy: secret.rotationPolicy as SecretMetadata["rotationPolicy"],
        rotationIntervalDays: secret.rotationIntervalDays || undefined,
        accessCount: secret.accessCount,
        lastAccessed: secret.lastAccessed || undefined,
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt,
      };
      await setCache(cacheKey, metadata, { ttl: 3600 });
    }

    // Decrypt
    const value = decrypt(secret.encryptedValue, secret.iv, secret.tag);

    // Update access metadata
    await db.secret.updateMany({
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

    logger.info("Secret retrieved", {
      tenantId,
      name,
    });

    return value;
  }

  /**
   * Rotate a secret
   */
  async rotate(tenantId: string, name: string, newValue: string): Promise<void> {
    // Get current version
    const current = await db.secret.findFirst({
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
    let nextRotation: Date | undefined;
    if (current.rotationPolicy === "scheduled" && current.rotationIntervalDays) {
      nextRotation = new Date();
      nextRotation.setDate(nextRotation.getDate() + current.rotationIntervalDays);
    }

    // Store new version
    await db.secret.create({
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
    const metadata = await getCache<SecretMetadata>(`secret:meta:${tenantId}:${name}`);
    if (metadata) {
      metadata.lastRotated = new Date();
      metadata.updatedAt = new Date();
      if (metadata.rotationPolicy === "scheduled" && metadata.rotationIntervalDays) {
        metadata.nextRotation = new Date();
        metadata.nextRotation.setDate(
          metadata.nextRotation.getDate() + metadata.rotationIntervalDays
        );
      }
      await setCache(`secret:meta:${tenantId}:${name}`, metadata, { ttl: 3600 });
    }

    logger.info("Secret rotated", {
      tenantId,
      name,
      version: nextVersion,
    });
  }

  /**
   * Revoke a secret
   */
  async revoke(tenantId: string, name: string): Promise<void> {
    await db.secret.updateMany({
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
    await setCache(`secret:meta:${tenantId}:${name}`, null, { ttl: 0 });

    logger.info("Secret revoked", {
      tenantId,
      name,
    });
  }

  /**
   * List secrets for a tenant
   */
  async list(tenantId: string): Promise<SecretMetadata[]> {
    // Get latest version of each secret
    const secrets = await db.secret.findMany({
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
      type: s.type as SecretMetadata["type"],
      service: s.service || undefined,
      tenantId,
      lastRotated: s.lastRotated || undefined,
      nextRotation: s.nextRotation || undefined,
      rotationPolicy: s.rotationPolicy as SecretMetadata["rotationPolicy"],
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
  async checkRotationSchedule(): Promise<Array<{ tenantId: string; name: string }>> {
    const now = new Date();
    const secrets = await db.secret.findMany({
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

export const secretsService = new SecretsManagementService();
