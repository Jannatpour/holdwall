/**
 * Input Sanitization Utilities
 * 
 * @deprecated Use lib/security/input-sanitizer.ts instead
 * This file re-exports from the canonical sanitization module for backward compatibility
 */

// Re-export from canonical sanitization module
export {
  sanitizeHtml,
  sanitizeText,
  sanitizeUrl,
  sanitizeEmail,
  sanitizeUuid,
  sanitizeSql as sanitizeSqlInput,
  sanitizeObject,
  sanitizePath,
  sanitizeInput,
  sanitizeFileName,
  sanitizeJSON,
  validateAndSanitize,
  type SanitizationOptions,
} from "@/lib/security/input-sanitizer";
