/**
 * Idempotency Service
 * 
 * Ensures critical operations are idempotent to prevent duplicate processing
 * in real-world scenarios with retries, network issues, and concurrent requests.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { createHash } from "crypto";

export interface IdempotencyKey {
  key: string;
  tenantId: string;
  operation: string;
  parameters: Record<string, unknown>;
}

export interface IdempotencyResult<T> {
  isDuplicate: boolean;
  result?: T;
  error?: string;
}

/**
 * Generate idempotency key from operation parameters
 */
export function generateIdempotencyKey(
  tenantId: string,
  operation: string,
  parameters: Record<string, unknown>
): string {
  // Sort parameters for consistent hashing
  const sortedParams = Object.keys(parameters)
    .sort()
    .reduce((acc, key) => {
      acc[key] = parameters[key];
      return acc;
    }, {} as Record<string, unknown>);

  const keyString = JSON.stringify({
    tenantId,
    operation,
    parameters: sortedParams,
  });

  return createHash("sha256").update(keyString).digest("hex");
}

/**
 * Idempotency Service
 */
export class IdempotencyService {
  /**
   * Check if operation was already executed
   */
  async check<T>(
    key: string,
    tenantId: string,
    operation: string
  ): Promise<IdempotencyResult<T>> {
    try {
      const record = await db.idempotencyKey.findUnique({
        where: {
          key,
        },
      });

      if (!record) {
        return { isDuplicate: false };
      }

      // Check if result exists and is valid
      if (record.result) {
        try {
          const result = JSON.parse(record.result) as T;
          return {
            isDuplicate: true,
            result,
          };
        } catch (error) {
          logger.warn("Failed to parse idempotency result", {
            key,
            error: error instanceof Error ? error.message : String(error),
          });
          // If result is corrupted, allow retry
          return { isDuplicate: false };
        }
      }

      // Check if operation is still in progress (within timeout window)
      const now = new Date();
      const createdAt = new Date(record.createdAt);
      const timeoutMs = 5 * 60 * 1000; // 5 minutes
      const elapsed = now.getTime() - createdAt.getTime();

      if (elapsed < timeoutMs) {
        // Operation might still be in progress
        return {
          isDuplicate: true,
          error: "Operation already in progress",
        };
      }

      // Operation timed out, allow retry
      await this.clear(key);
      return { isDuplicate: false };
    } catch (error) {
      logger.error("Error checking idempotency", {
        key,
        tenantId,
        operation,
        error: error instanceof Error ? error.message : String(error),
      });
      // On error, allow operation to proceed (fail open)
      return { isDuplicate: false };
    }
  }

  /**
   * Store operation result
   */
  async store<T>(
    key: string,
    tenantId: string,
    operation: string,
    result: T,
    ttlSeconds: number = 24 * 60 * 60 // 24 hours default
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      await db.idempotencyKey.upsert({
        where: { key },
        create: {
          key,
          tenantId,
          operation,
          result: JSON.stringify(result),
          expiresAt,
        },
        update: {
          result: JSON.stringify(result),
          expiresAt,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error("Error storing idempotency result", {
        key,
        tenantId,
        operation,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - idempotency is best-effort
    }
  }

  /**
   * Mark operation as in progress
   */
  async markInProgress(
    key: string,
    tenantId: string,
    operation: string
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await db.idempotencyKey.upsert({
        where: { key },
        create: {
          key,
          tenantId,
          operation,
          result: null,
          expiresAt,
        },
        update: {
          expiresAt,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error("Error marking operation in progress", {
        key,
        tenantId,
        operation,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clear idempotency key
   */
  async clear(key: string): Promise<void> {
    try {
      await db.idempotencyKey.delete({
        where: { key },
      });
    } catch (error) {
      logger.error("Error clearing idempotency key", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Cleanup expired keys
   */
  async cleanup(): Promise<number> {
    try {
      const result = await db.idempotencyKey.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
      return result.count;
    } catch (error) {
      logger.error("Error cleaning up idempotency keys", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }
}

/**
 * Idempotency middleware for operations
 */
export async function withIdempotency<T>(
  service: IdempotencyService,
  tenantId: string,
  operation: string,
  parameters: Record<string, unknown>,
  operationFn: () => Promise<T>,
  ttlSeconds?: number
): Promise<T> {
  const key = generateIdempotencyKey(tenantId, operation, parameters);

  // Check if already executed
  const checkResult = await service.check<T>(key, tenantId, operation);
  if (checkResult.isDuplicate) {
    if (checkResult.result !== undefined) {
      return checkResult.result;
    }
    if (checkResult.error) {
      throw new Error(checkResult.error);
    }
  }

  // Mark as in progress
  await service.markInProgress(key, tenantId, operation);

  try {
    // Execute operation
    const result = await operationFn();

    // Store result
    await service.store(key, tenantId, operation, result, ttlSeconds);

    return result;
  } catch (error) {
    // On error, clear the in-progress marker to allow retry
    await service.clear(key);
    throw error;
  }
}
