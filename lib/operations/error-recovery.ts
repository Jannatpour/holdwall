/**
 * Error Recovery Service
 * 
 * Provides intelligent error recovery mechanisms for real-world production scenarios.
 * Handles transient failures, partial failures, and provides graceful degradation.
 */

import { logger } from "@/lib/logging/logger";
import { CircuitBreaker } from "@/lib/resilience/circuit-breaker";
import { retryWithBackoff } from "@/lib/resilience/retry-strategy";

export interface RecoveryStrategy {
  retry?: {
    maxAttempts: number;
    backoffMs: number;
    exponential: boolean;
  };
  fallback?: () => Promise<unknown>;
  circuitBreaker?: CircuitBreaker;
  timeout?: number;
}

export interface RecoveryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  fallbackUsed: boolean;
}

/**
 * Error Recovery Service
 */
export class ErrorRecoveryService {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Execute operation with recovery strategy
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    strategy: RecoveryStrategy,
    operationName: string
  ): Promise<RecoveryResult<T>> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | null = null;

    // Circuit breaker is handled via execute() method which tracks failures/successes internally

    // Execute with retry if configured
    if (strategy.retry) {
      try {
        // Use circuit breaker if configured, otherwise execute directly
        const executeOperation = strategy.circuitBreaker
          ? async () => {
              const result = await strategy.circuitBreaker!.execute(
                () => this.executeWithTimeout(operation, strategy.timeout),
                strategy.fallback ? () => strategy.fallback!() : undefined
              );
              return result as T;
            }
          : async () => {
              return await this.executeWithTimeout(operation, strategy.timeout);
            };

        const retryResult = await retryWithBackoff(
          async () => {
            attempts++;
            return await executeOperation();
          },
          {
            maxRetries: strategy.retry.maxAttempts - 1, // retryWithBackoff uses 0-based attempts
            initialDelay: strategy.retry.backoffMs,
            backoffMultiplier: strategy.retry.exponential ? 2 : 1,
          }
        );
        
        const result = retryResult.result;
        attempts = retryResult.attempts;

        // Circuit breaker tracks success/failure internally via execute() method

        return {
          success: true,
          result,
          attempts,
          fallbackUsed: false,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempts = strategy.retry.maxAttempts;

        // Record failure in circuit breaker (circuit breaker tracks failures internally via execute)
        // The circuit breaker will automatically track failures when execute() is called
      }
    } else {
      // Execute without retry
      try {
        // Use circuit breaker if configured, otherwise execute directly
        const executeOperation = strategy.circuitBreaker
          ? async () => {
              const result = await strategy.circuitBreaker!.execute(
                () => this.executeWithTimeout(operation, strategy.timeout),
                strategy.fallback ? () => strategy.fallback!() : undefined
              );
              return result as T;
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
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempts = 1;
      }
    }

    // Try fallback if available
    if (strategy.fallback && lastError) {
      logger.warn("Operation failed, attempting fallback", {
        operationName,
        error: lastError.message,
        attempts,
      });

      try {
        const result = await strategy.fallback();
        return {
          success: true,
          result: result as T,
          attempts,
          fallbackUsed: true,
        };
      } catch (fallbackError) {
        logger.error("Fallback also failed", {
          operationName,
          error:
            fallbackError instanceof Error
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
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    if (!timeoutMs) {
      return await operation();
    }

    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timeout: ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Get or create circuit breaker for operation
   */
  getCircuitBreaker(operationName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operationName)) {
      this.circuitBreakers.set(
        operationName,
        new CircuitBreaker({
          failureThreshold: 5,
          resetTimeout: 60_000, // 1 minute
        })
      );
    }
    return this.circuitBreakers.get(operationName)!;
  }
}

/**
 * Determine if error is recoverable
 */
export function isRecoverableError(error: Error): boolean {
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
export function shouldUseFallback(error: Error): boolean {
  const fallbackPatterns = [
    /circuit breaker/i,
    /service unavailable/i,
    /503/i,
    /timeout/i,
  ];

  return fallbackPatterns.some((pattern) => pattern.test(error.message));
}
