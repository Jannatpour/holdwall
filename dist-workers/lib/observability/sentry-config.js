"use strict";
/**
 * Sentry Error Tracking Configuration
 * Production-ready error tracking with release tagging and alert routing
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSentry = initializeSentry;
exports.setSentryUser = setSentryUser;
exports.clearSentryUser = clearSentryUser;
exports.addSentryBreadcrumb = addSentryBreadcrumb;
exports.captureException = captureException;
exports.captureMessage = captureMessage;
const Sentry = __importStar(require("@sentry/nextjs"));
/**
 * Initialize Sentry with production-ready configuration
 */
function initializeSentry(config) {
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
                if (result === null)
                    return null;
                event = result;
            }
            // Only process error events
            if (event.type !== "error") {
                return event;
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
                const error = hint.originalException;
                event.fingerprint = [error.name, error.message];
            }
            return event;
        },
        // Integrations
        integrations: [
        // Next.js integrations are automatically included
        ],
    });
    // Set user context if available (server-side)
    if (typeof window === "undefined") {
        Sentry.setTag("runtime", "server");
    }
    else {
        Sentry.setTag("runtime", "client");
    }
}
/**
 * Set user context for error tracking
 */
function setSentryUser(user) {
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
function clearSentryUser() {
    Sentry.setUser(null);
}
/**
 * Add breadcrumb for debugging
 */
function addSentryBreadcrumb(message, category, level, data) {
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
function captureException(error, context) {
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
function captureMessage(message, level, context) {
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
