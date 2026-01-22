/**
 * Security: Input Validation & Sanitization
 * XSS prevention, SQL injection prevention, input sanitization
 * 
 * Note: Sanitization functions are in lib/security/input-sanitizer.ts
 * This file focuses on validation schemas and validation logic
 */

import { z } from "zod";
import { sanitizeInput, sanitizeHtml } from "./input-sanitizer";

/**
 * Validate and sanitize evidence content
 */
export const evidenceContentSchema = z.object({
  raw: z.string().transform((val) => sanitizeInput(val)).optional(),
  normalized: z.string().transform((val) => sanitizeInput(val)).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Validate tenant ID format
 */
export const tenantIdSchema = z.string().regex(/^[a-z0-9-]+$/, {
  message: "Tenant ID must be lowercase alphanumeric with hyphens",
});

/**
 * Validate evidence ID format
 */
export const evidenceIdSchema = z.string().regex(/^ev-[a-z0-9-]+$/, {
  message: "Invalid evidence ID format",
});

/**
 * CSRF token validation (in production, use proper CSRF library)
 */
export function validateCSRFToken(token: string, sessionToken: string): boolean {
  // In production, use proper CSRF validation
  return token === sessionToken;
}
