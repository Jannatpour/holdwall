/**
 * Next.js Proxy
 *
 * Next.js 16+ replacement for `middleware.ts`.
 * This file enforces page-level authentication gating at the edge without calling `auth()`.
 *
 * API routes enforce auth/roles within their handlers; proxy focuses on pages.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isPublicPageRoute } from "@/lib/routing/access-control";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow explicitly public routes (marketing/docs/auth/portals/shares).
  if (isPublicPageRoute(pathname)) {
    return NextResponse.next();
  }

  // Best-effort auth gate for protected *pages* without calling auth()
  // (Edge runtime compatibility). We only check for existence of a session cookie.
  const cookieNamesToCheck = [
    // NextAuth v4/v5 common names
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    // Auth.js (NextAuth v5) names
    "authjs.session-token",
    "__Secure-authjs.session-token",
  ];

  const hasSessionCookie = cookieNamesToCheck.some((name) => {
    const v = request.cookies.get(name)?.value;
    return typeof v === "string" && v.length > 0;
  });

  if (!hasSessionCookie) {
    const callbackUrl = request.nextUrl.pathname + request.nextUrl.search;
    const url = request.nextUrl.clone();
    url.pathname = "/auth/signin";
    url.search = `?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// IMPORTANT: Next.js requires this to be statically analyzable.
export const config = {
  matcher: [
    "/overview/:path*",
    "/signals/:path*",
    "/claims/:path*",
    "/evidence/:path*",
    "/graph/:path*",
    "/forecasts/:path*",
    "/studio/:path*",
    "/trust/:path*",
    "/funnel/:path*",
    "/playbooks/:path*",
    "/governance/:path*",
    "/pos/:path*",
    "/onboarding/:path*",
    "/cases/:path*",
    "/security-incidents/:path*",
    "/financial-services/:path*",
    "/ai-answer-monitor/:path*",
    "/integrations/:path*",
    "/source-compliance/:path*",
    "/metering/:path*",
    "/report/:path*",
  ],
};

