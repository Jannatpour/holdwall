"use strict";
/**
 * Transaction Manager
 *
 * Provides transaction management for complex multi-step operations
 * ensuring data consistency and rollback capabilities in real-world scenarios.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionManager = void 0;
exports.createTransactionStep = createTransactionStep;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
const client_2 = require("@prisma/client");
class TransactionManager {
    /**
     * Execute a transaction with multiple steps
     */
    async execute(steps, options = {}) {
        const timeout = options.timeout || 30000; // 30 seconds default
        const retries = options.retries || 0;
        const retryDelay = options.retryDelay || 1000;
        let lastError = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
            if (attempt > 0) {
                logger_1.logger.info("Retrying transaction", {
                    attempt,
                    steps: steps.length,
                    delay: retryDelay * attempt,
                });
                await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
            }
            try {
                return await this.executeTransaction(steps, timeout);
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                logger_1.logger.warn("Transaction failed", {
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
    async executeTransaction(steps, timeout) {
        const startTime = Date.now();
        return await client_1.db.$transaction(async (tx) => {
            const executedSteps = [];
            try {
                // Execute each step
                for (const step of steps) {
                    // Check timeout
                    if (Date.now() - startTime > timeout) {
                        throw new Error(`Transaction timeout after ${timeout}ms`);
                    }
                    logger_1.logger.debug("Executing transaction step", {
                        stepId: step.id,
                        stepName: step.name,
                    });
                    const result = await step.execute(tx);
                    executedSteps.push({ step, result });
                }
                // Return result from last step
                return executedSteps[executedSteps.length - 1]?.result;
            }
            catch (error) {
                // Rollback executed steps in reverse order
                logger_1.logger.warn("Rolling back transaction", {
                    executedSteps: executedSteps.length,
                    error: error instanceof Error ? error.message : String(error),
                });
                for (let i = executedSteps.length - 1; i >= 0; i--) {
                    const { step, result } = executedSteps[i];
                    if (step.rollback) {
                        try {
                            await step.rollback(tx, result);
                        }
                        catch (rollbackError) {
                            logger_1.logger.error("Error during rollback", {
                                stepId: step.id,
                                stepName: step.name,
                                error: rollbackError instanceof Error
                                    ? rollbackError.message
                                    : String(rollbackError),
                            });
                            // Continue with other rollbacks
                        }
                    }
                }
                throw error;
            }
        }, {
            timeout,
            isolationLevel: client_2.Prisma.TransactionIsolationLevel.Serializable,
        });
    }
    /**
     * Execute a simple transaction with a single operation
     */
    async executeSimple(operation, options = {}) {
        return this.execute([
            {
                id: "single-operation",
                name: "Single Operation",
                execute: operation,
            },
        ], options);
    }
}
exports.TransactionManager = TransactionManager;
/**
 * Create a transaction step
 */
function createTransactionStep(id, name, execute, rollback) {
    return { id, name, execute, rollback };
}
