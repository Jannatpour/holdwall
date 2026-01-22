/**
 * Next.js Proxy
 * Security, authentication, rate limiting, CORS, threat detection
 * Migrated from middleware.ts per Next.js 16 requirements
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// Note: auth() and cache functions are not used in proxy to avoid edge runtime issues
// Authentication is handled in route handlers instead

// Threat detection and rate limiting disabled in proxy for edge runtime compatibility
// These features are handled in API route handlers instead

// Rate limiting with Redis fallback to in-memory (legacy fallback)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Simple in-memory rate limiting for edge runtime
async function rateLimit(ip: string, limit: number = 100, windowMs: number = 60000): Promise<boolean> {
  const now = Date.now();
  const key = `rate_limit:${ip}`;
  const record = rateLimitMap.get(key);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= limit) {
    return false;
  }
  record.count++;
  return true;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const userAgent = request.headers.get("user-agent") || "";

  // Best-effort auth gate for protected *pages* without calling auth()
  // (Edge runtime compatibility). This prevents unauthenticated clients from
  // mounting app pages and spamming protected API calls with 401s.
  // Skip auth pages and public routes
  const publicRoutes = ["/auth/signin", "/auth/signup", "/auth/error", "/", "/offline", "/demo"];
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route + "/"));
  
  if (!pathname.startsWith("/api/") && !isPublicRoute) {
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

  // Simple rate limiting (in-memory only for edge runtime compatibility)
  // Advanced threat detection and adaptive rate limiting are handled in API route handlers
  // Skip rate limiting for auth endpoints to avoid blocking session checks
  if (!pathname.startsWith("/api/auth/")) {
    let limit = 100;
    let windowMs = 60000; // 1 minute

    // Stricter limits for write operations
    if (pathname.match(/\/api\/(claims|evidence|signals|aaal|approvals)\//) && request.method === "POST") {
      limit = 20;
      windowMs = 60000;
    }

    const allowed = await rateLimit(ip, limit, windowMs);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retry_after: 60 },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  // CORS headers
  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Enhanced CSP
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval and unsafe-inline
    "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openai.com https://api.anthropic.com https://api.cohere.ai",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  // Authentication check for protected routes
  // Skip auth in proxy for edge runtime compatibility - auth is handled in route handlers
  // if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/")) {
  //   try {
  //     const session = await auth();
  //     if (!session?.user) {
  //       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  //     }
  //   } catch (error) {
  //     // Auth check failed, let route handler handle it
  //     console.warn("Auth check in proxy failed:", error);
  //   }
  // }

  // Protect app routes (except auth pages)
  // Skip auth redirect in proxy - let page handle authentication
  // Authentication is handled client-side and in route handlers

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
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
  ],
};
