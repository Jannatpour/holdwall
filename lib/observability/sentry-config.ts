/**
 * Sentry Error Tracking Configuration
 * Production-ready error tracking with release tagging and alert routing
 */

import * as Sentry from "@sentry/nextjs";

interface SentryConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
  profilesSampleRate?: number;
  beforeSend?: (event: Sentry.Event, hint?: Sentry.EventHint) => Sentry.Event | null;
}

/**
 * Initialize Sentry with production-ready configuration
 */
export function initializeSentry(config?: SentryConfig): void {
  const dsn = config?.dsn || process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  
  if (!dsn) {
    // Sentry is optional - log but don't fail
    if (process.env.NODE_ENV === "production") {
      console.warn("[Sentry] SENTRY_DSN not configured - error tracking disabled");
    }
    return;
  }

  const environment = config?.environment || process.env.NODE_ENV || "development";
  
  // Generate release from git commit SHA or package version
  const release = config?.release || 
    process.env.VERCEL_GIT_COMMIT_SHA || 
    process.env.GIT_COMMIT_SHA || 
    process.env.npm_package_version || 
    "unknown";

  Sentry.init({
    dsn,
    environment,
    release,
    
    // Performance monitoring
    tracesSampleRate: config?.tracesSampleRate ?? (environment === "production" ? 0.1 : 1.0),
    profilesSampleRate: config?.profilesSampleRate ?? (environment === "production" ? 0.1 : 0),
    
    // Filter out health check noise
    ignoreErrors: [
      // Browser extensions
      /ExtensionContext/,
      /chrome-extension/,
      /moz-extension/,
      // Network errors that are expected
      /NetworkError/,
      /Failed to fetch/,
      // Known non-critical errors
      /ResizeObserver loop/,
      /Non-Error promise rejection/,
    ],
    
    // Filter out transactions we don't care about
    ignoreTransactions: [
      /\/api\/health/,
      /\/api\/metrics/,
      /\/_next/,
      /\/favicon.ico/,
    ],
    
    // Enhanced error context
    beforeSend(event, hint) {
      // Apply custom beforeSend if provided
      if (config?.beforeSend) {
        const result = config.beforeSend(event, hint);
        if (result === null) return null;
        event = result as Sentry.ErrorEvent;
      }
      
      // Only process error events
      if (event.type !== "error") {
        return event as Sentry.ErrorEvent;
      }
      
      // Add additional context
      if (event.request) {
        event.request.headers = {
          ...event.request.headers,
          // Don't log sensitive headers
        };
      }
      
      // Add environment-specific tags
      event.tags = {
        ...event.tags,
        environment,
        release,
        service: "holdwall-pos",
      };
      
      // Add user context if available
      if (hint?.originalException && typeof hint.originalException === "object") {
        const error = hint.originalException as Error;
        event.fingerprint = [error.name, error.message];
      }
      
      return event as Sentry.ErrorEvent;
    },
    
    // Integrations
    integrations: [
      // Next.js integrations are automatically included
    ],
  });

  // Set user context if available (server-side)
  if (typeof window === "undefined") {
    Sentry.setTag("runtime", "server");
  } else {
    Sentry.setTag("runtime", "client");
  }
}

/**
 * Set user context for error tracking
 */
export function setSentryUser(user: { id: string; email?: string; tenantId?: string }): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.email,
    // Add custom context
    tenantId: user.tenantId,
  });
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addSentryBreadcrumb(
  message: string,
  category?: string,
  level?: Sentry.SeverityLevel,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    message,
    category: category || "default",
    level: level || "info",
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Capture exception with context
 */
export function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id: string; email?: string; tenantId?: string };
  }
): string {
  if (context?.user) {
    setSentryUser(context.user);
  }
  
  if (context?.tags) {
    Object.entries(context.tags).forEach(([key, value]) => {
      Sentry.setTag(key, value);
    });
  }
  
  if (context?.extra) {
    Sentry.setExtra("context", context.extra);
  }
  
  return Sentry.captureException(error);
}

/**
 * Capture message (non-exception events)
 */
export function captureMessage(
  message: string,
  level?: Sentry.SeverityLevel,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): string {
  if (context?.tags) {
    Object.entries(context.tags).forEach(([key, value]) => {
      Sentry.setTag(key, value);
    });
  }
  
  if (context?.extra) {
    Sentry.setExtra("context", context.extra);
  }
  
  return Sentry.captureMessage(message, level);
}
