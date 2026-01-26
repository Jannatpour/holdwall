"use strict";
/**
 * Application Constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_TTL = exports.RATE_LIMITS = exports.API_ENDPOINTS = exports.ROUTES = exports.APP_VERSION = exports.APP_NAME = void 0;
exports.APP_NAME = "Holdwall POS";
exports.APP_VERSION = "1.0.0";
exports.ROUTES = {
    HOME: "/",
    OVERVIEW: "/overview",
    SIGNALS: "/signals",
    CLAIMS: "/claims",
    GRAPH: "/graph",
    FORECASTS: "/forecasts",
    STUDIO: "/studio",
    TRUST: "/trust",
    FUNNEL: "/funnel",
    PLAYBOOKS: "/playbooks",
    GOVERNANCE: "/governance",
};
exports.API_ENDPOINTS = {
    EVIDENCE: "/api/evidence",
    SIGNALS: "/api/signals",
    CLAIMS: "/api/claims",
    GRAPH: "/api/graph",
    FORECASTS: "/api/forecasts",
    AAAL: "/api/aaal",
    APPROVALS: "/api/approvals",
    PLAYBOOKS: "/api/playbooks",
    OVERVIEW: "/api/overview",
    HEALTH: "/api/health",
    AI_ORCHESTRATE: "/api/ai/orchestrate",
    AUDIT_BUNDLE: "/api/governance/audit-bundle",
};
exports.RATE_LIMITS = {
    API: { limit: 100, window: 60 }, // 100 requests per minute
    AUTH: { limit: 5, window: 60 }, // 5 login attempts per minute
    AI: { limit: 20, window: 60 }, // 20 AI calls per minute
};
exports.CACHE_TTL = {
    SHORT: 60, // 1 minute
    MEDIUM: 300, // 5 minutes
    LONG: 3600, // 1 hour
    VERY_LONG: 86400, // 24 hours
};
