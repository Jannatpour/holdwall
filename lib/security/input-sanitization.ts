/**
 * Input Sanitization
 * 
 * @deprecated Use lib/security/input-sanitizer.ts instead
 * This file re-exports from the canonical sanitization module for backward compatibility
 */

// Re-export from canonical sanitization module with aliases
export {
  sanitizeHtml as sanitizeHTML,
  sanitizeText,
  sanitizeUrl as sanitizeURL,
  sanitizeEmail,
  sanitizeUuid,
  sanitizeSql as sanitizeSQL,
  sanitizePath,
  sanitizeInput,
  sanitizeFileName,
  sanitizeObject,
  sanitizeJSON,
  validateAndSanitize,
  type SanitizationOptions,
} from "@/lib/security/input-sanitizer";
