"use strict";
/**
 * Retry Utility
 * Production-ready retry logic with exponential backoff
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryApi = exports.retryDatabase = exports.retryNetwork = void 0;
exports.retry = retry;
const defaultOptions = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
};
async function retry(fn, options = {}) {
    const opts = { ...defaultOptions, ...options };
    let lastError;
    let delay = opts.initialDelayMs;
    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
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
const retryNetwork = (fn) => retry(fn, {
    maxAttempts: 3,
    initialDelayMs: 500,
    retryable: (error) => {
        const message = error.message.toLowerCase();
        return (message.includes("network") ||
            message.includes("timeout") ||
            message.includes("econnreset") ||
            message.includes("enotfound"));
    },
});
exports.retryNetwork = retryNetwork;
const retryDatabase = (fn) => retry(fn, {
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    retryable: (error) => {
        const message = error.message.toLowerCase();
        return (message.includes("connection") ||
            message.includes("timeout") ||
            message.includes("deadlock") ||
            message.includes("lock wait timeout"));
    },
});
exports.retryDatabase = retryDatabase;
const retryApi = (fn) => retry(fn, {
    maxAttempts: 3,
    initialDelayMs: 1000,
    retryable: (error) => {
        // Retry on 5xx errors or network errors
        return (error.message.includes("500") ||
            error.message.includes("502") ||
            error.message.includes("503") ||
            error.message.includes("504") ||
            error.message.includes("network"));
    },
});
exports.retryApi = retryApi;
