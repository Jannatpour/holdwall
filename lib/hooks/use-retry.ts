/**
 * React Hook for Retry Logic
 * Client-side retry with exponential backoff
 */

import { useState, useCallback } from "react";
import { retry, RetryOptions } from "@/lib/utils/retry";

export function useRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  const execute = useCallback(
    async (...args: Parameters<T>): Promise<ReturnType<T> | null> => {
      setLoading(true);
      setError(null);
      setAttempt(0);

      try {
        const result = await retry(
          () => {
            setAttempt((prev) => prev + 1);
            return fn(...args);
          },
          {
            ...options,
            onRetry: (attemptNum, err) => {
              setAttempt(attemptNum);
              setError(err);
              options.onRetry?.(attemptNum, err);
            },
          }
        );

        setLoading(false);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setLoading(false);
        return null;
      }
    },
    [fn, options]
  );

  return { execute, loading, error, attempt };
}
