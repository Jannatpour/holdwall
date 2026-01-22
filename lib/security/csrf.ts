/**
 * CSRF Protection
 * Cross-Site Request Forgery protection
 */

import { randomBytes, createHmac } from "crypto";
import { getCache, setCache } from "@/lib/cache/redis";

const CSRF_TOKEN_TTL = 60 * 60; // 1 hour in seconds

let csrfSecretEphemeral: string | null = null;

function getCSRFSecret(): string {
  const configured = process.env.CSRF_SECRET;
  if (configured && configured.trim().length > 0) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("CSRF_SECRET is required in production");
  }

  // Non-production: generate a process-local secret (no hardcoded defaults).
  if (!csrfSecretEphemeral) {
    csrfSecretEphemeral = randomBytes(32).toString("hex");
  }
  return csrfSecretEphemeral;
}

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  const token = randomBytes(32).toString("hex");
  const timestamp = Date.now().toString();
  const hmac = createHmac("sha256", getCSRFSecret())
    .update(token + timestamp)
    .digest("hex");

  return `${token}:${timestamp}:${hmac}`;
}

/**
 * Verify CSRF token with double-submit cookie validation and replay protection
 */
export async function verifyCSRFToken(
  token: string,
  cookieToken?: string,
  maxAge: number = 3600000
): Promise<boolean> {
  const parts = token.split(":");
  if (parts.length !== 3) {
    return false;
  }

  const [tokenPart, timestamp, hmac] = parts;

  // Check age
  const age = Date.now() - parseInt(timestamp, 10);
  if (age > maxAge || age < 0) {
    return false;
  }

  // Verify HMAC
  const expectedHmac = createHmac("sha256", getCSRFSecret())
    .update(tokenPart + timestamp)
    .digest("hex");

  if (hmac !== expectedHmac) {
    return false;
  }

  // Double-submit cookie validation (if cookie token provided)
  if (cookieToken) {
    if (token !== cookieToken) {
      return false; // Tokens must match
    }
  }

  // Check if token was used (prevent replay attacks)
  const tokenKey = `csrf_used:${token}`;
  try {
    const wasUsed = await getCache<boolean>(tokenKey);
    if (wasUsed) {
      return false; // Token already used
    }

    // Mark token as used (short TTL to prevent replay)
    await setCache(tokenKey, true, { ttl: 300 }); // 5 minutes
  } catch {
    // If cache fails, continue without replay protection (graceful degradation)
  }

  return true;
}

/**
 * Synchronous version for backward compatibility
 */
export function verifyCSRFTokenSync(token: string, maxAge: number = 3600000): boolean {
  const parts = token.split(":");
  if (parts.length !== 3) {
    return false;
  }

  const [tokenPart, timestamp, hmac] = parts;

  // Check age
  const age = Date.now() - parseInt(timestamp, 10);
  if (age > maxAge || age < 0) {
    return false;
  }

  // Verify HMAC
  const expectedHmac = createHmac("sha256", getCSRFSecret())
    .update(tokenPart + timestamp)
    .digest("hex");

  return hmac === expectedHmac;
}

/**
 * Get CSRF token from request
 */
export function getCSRFTokenFromRequest(request: Request): string | null {
  // Check header first
  const headerToken = request.headers.get("x-csrf-token");
  if (headerToken) {
    return headerToken;
  }

  // Check form data
  // Note: In Next.js, form data is typically parsed in the route handler
  return null;
}

/**
 * CSRF middleware (async version with enhanced protection)
 */
export async function requireCSRF(request: Request, cookieToken?: string): Promise<boolean> {
  // Skip for GET, HEAD, OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return true;
  }

  const token = getCSRFTokenFromRequest(request);
  if (!token) {
    return false;
  }

  return verifyCSRFToken(token, cookieToken);
}

/**
 * Synchronous version for backward compatibility
 */
export function requireCSRFSync(request: Request): boolean {
  // Skip for GET, HEAD, OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return true;
  }

  const token = getCSRFTokenFromRequest(request);
  if (!token) {
    return false;
  }

  return verifyCSRFTokenSync(token);
}
