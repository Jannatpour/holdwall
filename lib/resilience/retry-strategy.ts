/**
 * Retry Strategy
 * 
 * Advanced retry with exponential backoff, jitter, and retryable error detection
 */

export interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number; // Initial delay in ms
  maxDelay?: number; // Maximum delay in ms
  backoffMultiplier?: number; // Exponential backoff multiplier
  jitter?: boolean; // Add random jitter to prevent thundering herd
  retryableErrors?: Array<string | RegExp>; // Error patterns that should be retried
}

export interface RetryResult<T> {
  result: T;
  attempts: number;
  totalDuration: number;
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config?: RetryConfig
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 10000,
    backoffMultiplier = 2,
    jitter = true,
    retryableErrors = [],
  } = config || {};

  let lastError: Error | unknown;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return {
        result,
        attempts: attempt + 1,
        totalDuration: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (attempt < maxRetries && isRetryableError(error, retryableErrors)) {
        // Calculate delay with exponential backoff
        const baseDelay = initialDelay * Math.pow(backoffMultiplier, attempt);
        const delay = Math.min(baseDelay, maxDelay);

        // Add jitter (random 0-20% of delay)
        const jitterAmount = jitter ? Math.random() * delay * 0.2 : 0;
        const finalDelay = delay + jitterAmount;

        await new Promise(resolve => setTimeout(resolve, finalDelay));
      } else {
        // Not retryable or max retries reached
        break;
      }
    }
  }

  throw lastError;
}

/**
 * Check if error is retryable
 */
function isRetryableError(
  error: unknown,
  retryablePatterns: Array<string | RegExp>
): boolean {
  if (retryablePatterns.length === 0) {
    // Default: retry on network errors, timeouts, and 5xx errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    return /timeout|network|ECONNREFUSED|ETIMEDOUT|5\d{2}/i.test(errorMessage);
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorString = errorMessage.toLowerCase();

  for (const pattern of retryablePatterns) {
    if (typeof pattern === "string") {
      if (errorString.includes(pattern.toLowerCase())) {
        return true;
      }
    } else if (pattern instanceof RegExp) {
      if (pattern.test(errorMessage)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Retry with circuit breaker integration
 */
export async function retryWithCircuitBreaker<T>(
  fn: () => Promise<T>,
  circuitBreaker: import("./circuit-breaker").CircuitBreaker,
  config?: RetryConfig
): Promise<RetryResult<T>> {
  return circuitBreaker.execute(
    () => retryWithBackoff(fn, config),
    async () => {
      // Fallback when circuit is open
      throw new Error("Circuit breaker is open, cannot retry");
    }
  );
}
