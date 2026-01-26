"use strict";
/**
 * Error Recovery Service
 *
 * Provides intelligent error recovery mechanisms for real-world production scenarios.
 * Handles transient failures, partial failures, and provides graceful degradation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorRecoveryService = void 0;
exports.isRecoverableError = isRecoverableError;
exports.shouldUseFallback = shouldUseFallback;
const logger_1 = require("@/lib/logging/logger");
const circuit_breaker_1 = require("@/lib/resilience/circuit-breaker");
const retry_strategy_1 = require("@/lib/resilience/retry-strategy");
/**
 * Error Recovery Service
 */
class ErrorRecoveryService {
    constructor() {
        this.circuitBreakers = new Map();
    }
    /**
     * Best-effort recovery hook
     *
     * Used by callers that just want centralized logging + optional follow-up actions
     * after a failure (without wrapping the original operation).
     */
    async recover(input) {
        const operationName = input.operationName || "unknown_operation";
        logger_1.logger.warn("Recovery invoked", {
            operationName,
            error: input.error.message,
            stack: input.error.stack,
            context: input.context,
        });
        // If we can identify recoverable errors, we keep a slot for future automated recovery
        // actions (e.g., enqueue retry, invalidate caches, open circuit breaker, notify on-call).
        // For now: this is intentionally side-effect minimal and does not throw.
    }
    /**
     * Execute operation with recovery strategy
     */
    async executeWithRecovery(operation, strategy, operationName) {
        const startTime = Date.now();
        let attempts = 0;
        let lastError = null;
        // Circuit breaker is handled via execute() method which tracks failures/successes internally
        // Execute with retry if configured
        if (strategy.retry) {
            try {
                // Use circuit breaker if configured, otherwise execute directly
                const executeOperation = strategy.circuitBreaker
                    ? async () => {
                        const result = await strategy.circuitBreaker.execute(() => this.executeWithTimeout(operation, strategy.timeout), strategy.fallback ? () => strategy.fallback() : undefined);
                        return result;
                    }
                    : async () => {
                        return await this.executeWithTimeout(operation, strategy.timeout);
                    };
                const retryResult = await (0, retry_strategy_1.retryWithBackoff)(async () => {
                    attempts++;
                    return await executeOperation();
                }, {
                    maxRetries: strategy.retry.maxAttempts - 1, // retryWithBackoff uses 0-based attempts
                    initialDelay: strategy.retry.backoffMs,
                    backoffMultiplier: strategy.retry.exponential ? 2 : 1,
                });
                const result = retryResult.result;
                attempts = retryResult.attempts;
                // Circuit breaker tracks success/failure internally via execute() method
                return {
                    success: true,
                    result,
                    attempts,
                    fallbackUsed: false,
                };
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                attempts = strategy.retry.maxAttempts;
                // Record failure in circuit breaker (circuit breaker tracks failures internally via execute)
                // The circuit breaker will automatically track failures when execute() is called
            }
        }
        else {
            // Execute without retry
            try {
                // Use circuit breaker if configured, otherwise execute directly
                const executeOperation = strategy.circuitBreaker
                    ? async () => {
                        const result = await strategy.circuitBreaker.execute(() => this.executeWithTimeout(operation, strategy.timeout), strategy.fallback ? () => strategy.fallback() : undefined);
                        return result;
                    }
                    : async () => {
                        return await this.executeWithTimeout(operation, strategy.timeout);
                    };
                const result = await executeOperation();
                return {
                    success: true,
                    result,
                    attempts: 1,
                    fallbackUsed: false,
                };
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                attempts = 1;
            }
        }
        // Try fallback if available
        if (strategy.fallback && lastError) {
            logger_1.logger.warn("Operation failed, attempting fallback", {
                operationName,
                error: lastError.message,
                attempts,
            });
            try {
                const result = await strategy.fallback();
                return {
                    success: true,
                    result: result,
                    attempts,
                    fallbackUsed: true,
                };
            }
            catch (fallbackError) {
                logger_1.logger.error("Fallback also failed", {
                    operationName,
                    error: fallbackError instanceof Error
                        ? fallbackError.message
                        : String(fallbackError),
                });
                return {
                    success: false,
                    error: fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)),
                    attempts,
                    fallbackUsed: true,
                };
            }
        }
        return {
            success: false,
            error: lastError || new Error("Unknown error"),
            attempts,
            fallbackUsed: false,
        };
    }
    /**
     * Execute operation with timeout
     */
    async executeWithTimeout(operation, timeoutMs) {
        if (!timeoutMs) {
            return await operation();
        }
        return Promise.race([
            operation(),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Operation timeout: ${timeoutMs}ms`)), timeoutMs)),
        ]);
    }
    /**
     * Get or create circuit breaker for operation
     */
    getCircuitBreaker(operationName) {
        if (!this.circuitBreakers.has(operationName)) {
            this.circuitBreakers.set(operationName, new circuit_breaker_1.CircuitBreaker({
                failureThreshold: 5,
                resetTimeout: 60000, // 1 minute
            }));
        }
        return this.circuitBreakers.get(operationName);
    }
}
exports.ErrorRecoveryService = ErrorRecoveryService;
/**
 * Determine if error is recoverable
 */
function isRecoverableError(error) {
    const recoverablePatterns = [
        /timeout/i,
        /network/i,
        /connection/i,
        /temporary/i,
        /rate limit/i,
        /503/i,
        /502/i,
        /504/i,
    ];
    return recoverablePatterns.some((pattern) => pattern.test(error.message));
}
/**
 * Determine if error should trigger fallback
 */
function shouldUseFallback(error) {
    const fallbackPatterns = [
        /circuit breaker/i,
        /service unavailable/i,
        /503/i,
        /timeout/i,
    ];
    return fallbackPatterns.some((pattern) => pattern.test(error.message));
}
