"use strict";
/**
 * CSRF Protection
 * Cross-Site Request Forgery protection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCSRFToken = generateCSRFToken;
exports.verifyCSRFToken = verifyCSRFToken;
exports.verifyCSRFTokenSync = verifyCSRFTokenSync;
exports.getCSRFTokenFromRequest = getCSRFTokenFromRequest;
exports.requireCSRF = requireCSRF;
exports.requireCSRFSync = requireCSRFSync;
const crypto_1 = require("crypto");
const redis_1 = require("@/lib/cache/redis");
const CSRF_TOKEN_TTL = 60 * 60; // 1 hour in seconds
let csrfSecretEphemeral = null;
function getCSRFSecret() {
    const configured = process.env.CSRF_SECRET;
    if (configured && configured.trim().length > 0) {
        return configured;
    }
    if (process.env.NODE_ENV === "production") {
        throw new Error("CSRF_SECRET is required in production");
    }
    // Non-production: generate a process-local secret (no hardcoded defaults).
    if (!csrfSecretEphemeral) {
        csrfSecretEphemeral = (0, crypto_1.randomBytes)(32).toString("hex");
    }
    return csrfSecretEphemeral;
}
/**
 * Generate CSRF token
 */
function generateCSRFToken() {
    const token = (0, crypto_1.randomBytes)(32).toString("hex");
    const timestamp = Date.now().toString();
    const hmac = (0, crypto_1.createHmac)("sha256", getCSRFSecret())
        .update(token + timestamp)
        .digest("hex");
    return `${token}:${timestamp}:${hmac}`;
}
/**
 * Verify CSRF token with double-submit cookie validation and replay protection
 */
async function verifyCSRFToken(token, cookieToken, maxAge = 3600000) {
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
    const expectedHmac = (0, crypto_1.createHmac)("sha256", getCSRFSecret())
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
        const wasUsed = await (0, redis_1.getCache)(tokenKey);
        if (wasUsed) {
            return false; // Token already used
        }
        // Mark token as used (short TTL to prevent replay)
        await (0, redis_1.setCache)(tokenKey, true, { ttl: 300 }); // 5 minutes
    }
    catch {
        // If cache fails, continue without replay protection (graceful degradation)
    }
    return true;
}
/**
 * Synchronous version for backward compatibility
 */
function verifyCSRFTokenSync(token, maxAge = 3600000) {
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
    const expectedHmac = (0, crypto_1.createHmac)("sha256", getCSRFSecret())
        .update(tokenPart + timestamp)
        .digest("hex");
    return hmac === expectedHmac;
}
/**
 * Get CSRF token from request
 */
function getCSRFTokenFromRequest(request) {
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
async function requireCSRF(request, cookieToken) {
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
function requireCSRFSync(request) {
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
