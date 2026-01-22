/**
 * Input Sanitizer
 * 
 * Comprehensive input sanitization for security
 * HTML sanitization, SQL injection prevention, path traversal prevention
 * Canonical file for all sanitization utilities
 */

import DOMPurify from "isomorphic-dompurify";
import type { Config } from "dompurify";
import { z } from "zod";

export interface SanitizationOptions {
  allowHtml?: boolean;
  maxLength?: number;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
}

/**
 * Sanitize HTML input
 */
export function sanitizeHtml(
  input: string,
  options?: SanitizationOptions
): string {
  if (!options?.allowHtml) {
    // Strip all HTML
    return String(
      DOMPurify.sanitize(input, {
        ALLOWED_TAGS: [],
        RETURN_TRUSTED_TYPE: false,
      } as unknown as Config)
    );
  }

  const config: Config = {
    ALLOWED_TAGS: options.allowedTags || ["p", "br", "strong", "em", "ul", "ol", "li", "a"],
    ALLOWED_ATTR: options.allowedAttributes
      ? Object.values(options.allowedAttributes).flat()
      : ["href", "title"],
    RETURN_TRUSTED_TYPE: false,
  };

  return String(DOMPurify.sanitize(input, config as any));
}

/**
 * Sanitize SQL input (prevent SQL injection)
 */
export function sanitizeSql(input: string): string {
  // Remove SQL injection patterns
  return input
    .replace(/['";\\]/g, "") // Remove quotes and semicolons
    .replace(/--/g, "") // Remove SQL comments
    .replace(/\/\*/g, "") // Remove block comment start
    .replace(/\*\//g, "") // Remove block comment end
    .replace(/union\s+select/gi, "") // Remove UNION SELECT
    .replace(/drop\s+table/gi, "") // Remove DROP TABLE
    .replace(/delete\s+from/gi, ""); // Remove DELETE FROM
}

/**
 * Sanitize file path (prevent path traversal)
 */
export function sanitizePath(input: string): string {
  return input
    .replace(/\.\./g, "") // Remove parent directory references
    .replace(/\/\//g, "/") // Remove double slashes
    .replace(/^\/+/, "") // Remove leading slashes
    .replace(/\/+$/, ""); // Remove trailing slashes
}

/**
 * Sanitize user input comprehensively
 */
export function sanitizeInput(
  input: string,
  options?: SanitizationOptions
): string {
  let sanitized = input;

  // Apply length limit
  if (options?.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");

  // Remove control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  // Sanitize HTML
  sanitized = sanitizeHtml(sanitized, options);

  // Remove dangerous patterns
  sanitized = sanitized
    .replace(/javascript:/gi, "")
    .replace(/data:text\/html/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/<script/gi, "")
    .replace(/<\/script>/gi, "");

  return sanitized.trim();
}

/**
 * Validate and sanitize email
 * Returns null if invalid (non-throwing version)
 */
export function sanitizeEmail(email: string): string | null {
  // Basic email validation and sanitization
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const sanitized = email.trim().toLowerCase();
  
  if (!emailRegex.test(sanitized)) {
    return null;
  }

  // Remove potentially dangerous characters
  return sanitized.replace(/[<>\"']/g, "");
}

/**
 * Validate and sanitize email (throws on invalid)
 */
export function sanitizeEmailStrict(email: string): string {
  const result = sanitizeEmail(email);
  if (!result) {
    throw new Error("Invalid email format");
  }
  return result;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Only allow http and https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid URL protocol");
    }

    // Sanitize path
    parsed.pathname = sanitizePath(parsed.pathname);

    return parsed.toString();
  } catch {
    throw new Error("Invalid URL format");
  }
}

/**
 * Sanitize UUID
 */
export function sanitizeUuid(uuid: string): string | null {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const sanitized = uuid.trim();
  return uuidRegex.test(sanitized) ? sanitized : null;
}

/**
 * Sanitize file name
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.\./g, "_")
    .substring(0, 255);
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  options: {
    sanitizeStrings?: boolean;
    sanitizeUrls?: boolean;
    maxDepth?: number;
  } = {}
): T {
  const {
    sanitizeStrings = true,
    sanitizeUrls = true,
    maxDepth = 10,
  } = options;

  if (maxDepth <= 0) {
    return obj;
  }

  const sanitized: Record<string, unknown> = { ...obj };

  for (const key in sanitized) {
    const value = sanitized[key];

    if (typeof value === "string") {
      if (sanitizeUrls && (key.includes("url") || key.includes("link"))) {
        try {
          sanitized[key] = sanitizeUrl(value);
        } catch {
          sanitized[key] = "";
        }
      } else if (sanitizeStrings) {
        sanitized[key] = sanitizeHtml(value, { allowHtml: false });
      }
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value, {
        ...options,
        maxDepth: maxDepth - 1,
      });
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item: any) => {
        if (typeof item === "string") {
          return sanitizeStrings ? sanitizeHtml(item, { allowHtml: false }) : item;
        } else if (item && typeof item === "object") {
          return sanitizeObject(item, { ...options, maxDepth: maxDepth - 1 });
        }
        return item;
      });
    }
  }

  return sanitized as T;
}

/**
 * Sanitize JSON string
 */
export function sanitizeJSON<T>(json: string): T | null {
  try {
    const parsed = JSON.parse(json);
    return sanitizeObject(parsed) as T;
  } catch {
    return null;
  }
}

/**
 * Validate input against schema and sanitize
 */
export function validateAndSanitize<T>(
  input: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(input);
  if (result.success) {
    return result;
  }
  return { success: false, error: result.error };
}

// Aliases for backward compatibility
export const sanitizeText = (text: string) => sanitizeHtml(text, { allowHtml: false });
export const sanitizeSQL = sanitizeSql;
export const sanitizeHTML = sanitizeHtml;
export const sanitizeURL = (url: string): string | null => {
  try {
    return sanitizeUrl(url);
  } catch {
    return null;
  }
};

