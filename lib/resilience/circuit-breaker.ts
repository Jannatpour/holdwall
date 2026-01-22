/**
 * Circuit Breaker
 * 
 * Circuit breaker pattern for fault tolerance
 * Prevents cascading failures by opening circuit after threshold failures
 */

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  failureThreshold: number; // Open circuit after this many failures
  successThreshold: number; // Close circuit after this many successes (half-open state)
  timeout: number; // Time in ms before attempting to close circuit
  resetTimeout: number; // Time in ms before resetting failure count
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold || 5,
      successThreshold: config?.successThreshold || 2,
      timeout: config?.timeout || 60000, // 1 minute
      resetTimeout: config?.resetTimeout || 300000, // 5 minutes
    };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    // Check if circuit should be opened
    if (this.state === "open") {
      const timeSinceLastFailure = this.lastFailureTime
        ? Date.now() - this.lastFailureTime
        : Infinity;

      if (timeSinceLastFailure >= this.config.timeout) {
        // Transition to half-open
        this.state = "half-open";
        this.successes = 0;
      } else {
        // Circuit is open, use fallback or throw
        if (fallback) {
          return fallback();
        }
        throw new Error("Circuit breaker is open");
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now();

    if (this.state === "half-open") {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        // Close circuit
        this.state = "closed";
        this.failures = 0;
        this.successes = 0;
      }
    } else if (this.state === "closed") {
      // Reset failure count on success
      const timeSinceLastFailure = this.lastFailureTime
        ? Date.now() - this.lastFailureTime
        : Infinity;

      if (timeSinceLastFailure >= this.config.resetTimeout) {
        this.failures = 0;
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failures++;

    if (this.state === "half-open") {
      // Immediately open circuit on failure in half-open state
      this.state = "open";
      this.successes = 0;
    } else if (this.state === "closed" && this.failures >= this.config.failureThreshold) {
      // Open circuit
      this.state = "open";
    }
  }

  /**
   * Get current stats
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
  }
}
