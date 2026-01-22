/**
 * Transaction Manager
 * 
 * Provides transaction management for complex multi-step operations
 * ensuring data consistency and rollback capabilities in real-world scenarios.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { Prisma } from "@prisma/client";

export interface TransactionStep {
  id: string;
  name: string;
  execute: (tx: Prisma.TransactionClient) => Promise<unknown>;
  rollback?: (tx: Prisma.TransactionClient, result: unknown) => Promise<void>;
}

export interface TransactionOptions {
  timeout?: number; // milliseconds
  retries?: number;
  retryDelay?: number; // milliseconds
}

export class TransactionManager {
  /**
   * Execute a transaction with multiple steps
   */
  async execute<T>(
    steps: TransactionStep[],
    options: TransactionOptions = {}
  ): Promise<T> {
    const timeout = options.timeout || 30_000; // 30 seconds default
    const retries = options.retries || 0;
    const retryDelay = options.retryDelay || 1000;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        logger.info("Retrying transaction", {
          attempt,
          steps: steps.length,
          delay: retryDelay * attempt,
        });
        await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      }

      try {
        return await this.executeTransaction<T>(steps, timeout);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn("Transaction failed", {
          attempt,
          error: lastError.message,
          steps: steps.length,
        });

        // Don't retry on validation errors
        if (lastError.message.includes("validation") || lastError.message.includes("invalid")) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error("Transaction failed after retries");
  }

  private async executeTransaction<T>(
    steps: TransactionStep[],
    timeout: number
  ): Promise<T> {
    const startTime = Date.now();

    return await db.$transaction(
      async (tx) => {
        const executedSteps: Array<{ step: TransactionStep; result: unknown }> = [];

        try {
          // Execute each step
          for (const step of steps) {
            // Check timeout
            if (Date.now() - startTime > timeout) {
              throw new Error(`Transaction timeout after ${timeout}ms`);
            }

            logger.debug("Executing transaction step", {
              stepId: step.id,
              stepName: step.name,
            });

            const result = await step.execute(tx);
            executedSteps.push({ step, result });
          }

          // Return result from last step
          return executedSteps[executedSteps.length - 1]?.result as T;
        } catch (error) {
          // Rollback executed steps in reverse order
          logger.warn("Rolling back transaction", {
            executedSteps: executedSteps.length,
            error: error instanceof Error ? error.message : String(error),
          });

          for (let i = executedSteps.length - 1; i >= 0; i--) {
            const { step, result } = executedSteps[i];
            if (step.rollback) {
              try {
                await step.rollback(tx, result);
              } catch (rollbackError) {
                logger.error("Error during rollback", {
                  stepId: step.id,
                  stepName: step.name,
                  error:
                    rollbackError instanceof Error
                      ? rollbackError.message
                      : String(rollbackError),
                });
                // Continue with other rollbacks
              }
            }
          }

          throw error;
        }
      },
      {
        timeout,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
  }

  /**
   * Execute a simple transaction with a single operation
   */
  async executeSimple<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    return this.execute<T>(
      [
        {
          id: "single-operation",
          name: "Single Operation",
          execute: operation,
        },
      ],
      options
    );
  }
}

/**
 * Create a transaction step
 */
export function createTransactionStep(
  id: string,
  name: string,
  execute: (tx: Prisma.TransactionClient) => Promise<unknown>,
  rollback?: (tx: Prisma.TransactionClient, result: unknown) => Promise<void>
): TransactionStep {
  return { id, name, execute, rollback };
}
