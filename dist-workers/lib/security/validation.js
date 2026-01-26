"use strict";
/**
 * Security: Input Validation & Sanitization
 * XSS prevention, SQL injection prevention, input sanitization
 *
 * Note: Sanitization functions are in lib/security/input-sanitizer.ts
 * This file focuses on validation schemas and validation logic
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.evidenceIdSchema = exports.tenantIdSchema = exports.evidenceContentSchema = void 0;
exports.validateCSRFToken = validateCSRFToken;
const zod_1 = require("zod");
const input_sanitizer_1 = require("./input-sanitizer");
/**
 * Validate and sanitize evidence content
 */
exports.evidenceContentSchema = zod_1.z.object({
    raw: zod_1.z.string().transform((val) => (0, input_sanitizer_1.sanitizeInput)(val)).optional(),
    normalized: zod_1.z.string().transform((val) => (0, input_sanitizer_1.sanitizeInput)(val)).optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Validate tenant ID format
 */
exports.tenantIdSchema = zod_1.z.string().regex(/^[a-z0-9-]+$/, {
    message: "Tenant ID must be lowercase alphanumeric with hyphens",
});
/**
 * Validate evidence ID format
 */
exports.evidenceIdSchema = zod_1.z.string().regex(/^ev-[a-z0-9-]+$/, {
    message: "Invalid evidence ID format",
});
/**
 * CSRF token validation (in production, use proper CSRF library)
 */
function validateCSRFToken(token, sessionToken) {
    // In production, use proper CSRF validation
    return token === sessionToken;
}
