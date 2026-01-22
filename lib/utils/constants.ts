/**
 * Application Constants
 */

export const APP_NAME = "Holdwall POS";
export const APP_VERSION = "1.0.0";

export const ROUTES = {
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
} as const;

export const API_ENDPOINTS = {
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
} as const;

export const RATE_LIMITS = {
  API: { limit: 100, window: 60 }, // 100 requests per minute
  AUTH: { limit: 5, window: 60 }, // 5 login attempts per minute
  AI: { limit: 20, window: 60 }, // 20 AI calls per minute
} as const;

export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
} as const;
