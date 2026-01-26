/**
 * Canonical access control inventory for routing.
 *
 * This file is intentionally small and dependency-free so it can be reused in:
 * - Edge proxy (`app/proxy.ts`)
 * - Tests (Playwright/Jest)
 * - Docs generation (if desired)
 */

/**
 * Public routes (marketing/docs/auth/utility) that must never require a session.
 */
export const publicPagePrefixes = [
  "/auth/signin",
  "/auth/signup",
  "/auth/error",
  "/",
  "/offline",
  "/demo",
  "/product",
  "/solutions",
  "/resources",
  "/security",
  "/ethics",
  "/compliance",
] as const;

/**
 * Public portals/sharing routes that are intentionally unauthenticated.
 * These MUST remain accessible even if their parent segment is protected.
 */
export const publicPortalPrefixes = [
  "/cases/track",
  "/padl",
] as const;

/**
 * Authenticated app routes (session required).
 *
 * Notes:
 * - `/cases/track/*` is explicitly public and is handled via `publicPortalPrefixes`.
 * - `/padl/*` is explicitly public and is handled via `publicPortalPrefixes`.
 */
export const protectedPagePrefixes = [
  "/overview",
  "/signals",
  "/claims",
  "/evidence",
  "/graph",
  "/forecasts",
  "/studio",
  "/trust",
  "/funnel",
  "/playbooks",
  "/governance",
  "/pos",
  "/onboarding",
  "/cases",
  "/security-incidents",
  "/financial-services",
  "/ai-answer-monitor",
  "/integrations",
  "/source-compliance",
  "/metering",
  "/report",
] as const;

export type RoutePrefix =
  | (typeof publicPagePrefixes)[number]
  | (typeof publicPortalPrefixes)[number]
  | (typeof protectedPagePrefixes)[number];

export function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function isPublicPageRoute(pathname: string): boolean {
  return (
    publicPagePrefixes.some((p) => matchesPrefix(pathname, p)) ||
    publicPortalPrefixes.some((p) => matchesPrefix(pathname, p))
  );
}

