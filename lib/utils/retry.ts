/**
 * Retry Utility
 * Production-ready retry logic with exponential backoff
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryable?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

const defaultOptions: Required<Omit<RetryOptions, "retryable" | "onRetry">> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: Error | undefined;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (opts.retryable && !opts.retryable(lastError)) {
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt === opts.maxAttempts) {
        throw lastError;
      }

      // Call onRetry callback
      if (opts.onRetry) {
        opts.onRetry(attempt, lastError);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError || new Error("Retry failed");
}

// Pre-configured retry functions
export const retryNetwork = <T>(fn: () => Promise<T>) =>
  retry(fn, {
    maxAttempts: 3,
    initialDelayMs: 500,
    retryable: (error) => {
      const message = error.message.toLowerCase();
      return (
        message.includes("network") ||
        message.includes("timeout") ||
        message.includes("econnreset") ||
        message.includes("enotfound")
      );
    },
  });

export const retryDatabase = <T>(fn: () => Promise<T>) =>
  retry(fn, {
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    retryable: (error) => {
      const message = error.message.toLowerCase();
      return (
        message.includes("connection") ||
        message.includes("timeout") ||
        message.includes("deadlock") ||
        message.includes("lock wait timeout")
      );
    },
  });

export const retryApi = <T>(fn: () => Promise<T>) =>
  retry(fn, {
    maxAttempts: 3,
    initialDelayMs: 1000,
    retryable: (error: Error) => {
      // Retry on 5xx errors or network errors
      return (
        error.message.includes("500") ||
        error.message.includes("502") ||
        error.message.includes("503") ||
        error.message.includes("504") ||
        error.message.includes("network")
      );
    },
  });
