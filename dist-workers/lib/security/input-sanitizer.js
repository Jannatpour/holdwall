"use strict";
/**
 * Input Sanitizer
 *
 * Comprehensive input sanitization for security
 * HTML sanitization, SQL injection prevention, path traversal prevention
 * Canonical file for all sanitization utilities
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeURL = exports.sanitizeHTML = exports.sanitizeSQL = exports.sanitizeText = void 0;
exports.sanitizeHtml = sanitizeHtml;
exports.sanitizeSql = sanitizeSql;
exports.sanitizePath = sanitizePath;
exports.sanitizeInput = sanitizeInput;
exports.sanitizeEmail = sanitizeEmail;
exports.sanitizeEmailStrict = sanitizeEmailStrict;
exports.sanitizeUrl = sanitizeUrl;
exports.sanitizeUuid = sanitizeUuid;
exports.sanitizeFileName = sanitizeFileName;
exports.sanitizeObject = sanitizeObject;
exports.sanitizeJSON = sanitizeJSON;
exports.validateAndSanitize = validateAndSanitize;
const isomorphic_dompurify_1 = __importDefault(require("isomorphic-dompurify"));
/**
 * Sanitize HTML input
 */
function sanitizeHtml(input, options) {
    if (!options?.allowHtml) {
        // Strip all HTML
        return String(isomorphic_dompurify_1.default.sanitize(input, {
            ALLOWED_TAGS: [],
            RETURN_TRUSTED_TYPE: false,
        }));
    }
    const config = {
        ALLOWED_TAGS: options.allowedTags || ["p", "br", "strong", "em", "ul", "ol", "li", "a"],
        ALLOWED_ATTR: options.allowedAttributes
            ? Object.values(options.allowedAttributes).flat()
            : ["href", "title"],
        RETURN_TRUSTED_TYPE: false,
    };
    return String(isomorphic_dompurify_1.default.sanitize(input, config));
}
/**
 * Sanitize SQL input (prevent SQL injection)
 */
function sanitizeSql(input) {
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
function sanitizePath(input) {
    return input
        .replace(/\.\./g, "") // Remove parent directory references
        .replace(/\/\//g, "/") // Remove double slashes
        .replace(/^\/+/, "") // Remove leading slashes
        .replace(/\/+$/, ""); // Remove trailing slashes
}
/**
 * Sanitize user input comprehensively
 */
function sanitizeInput(input, options) {
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
function sanitizeEmail(email) {
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
function sanitizeEmailStrict(email) {
    const result = sanitizeEmail(email);
    if (!result) {
        throw new Error("Invalid email format");
    }
    return result;
}
/**
 * Validate and sanitize URL
 */
function sanitizeUrl(url) {
    try {
        const parsed = new URL(url);
        // Only allow http and https
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new Error("Invalid URL protocol");
        }
        // Sanitize path
        parsed.pathname = sanitizePath(parsed.pathname);
        return parsed.toString();
    }
    catch {
        throw new Error("Invalid URL format");
    }
}
/**
 * Sanitize UUID
 */
function sanitizeUuid(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const sanitized = uuid.trim();
    return uuidRegex.test(sanitized) ? sanitized : null;
}
/**
 * Sanitize file name
 */
function sanitizeFileName(fileName) {
    return fileName
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/\.\./g, "_")
        .substring(0, 255);
}
/**
 * Sanitize object recursively
 */
function sanitizeObject(obj, options = {}) {
    const { sanitizeStrings = true, sanitizeUrls = true, maxDepth = 10, } = options;
    if (maxDepth <= 0) {
        return obj;
    }
    const sanitized = { ...obj };
    for (const key in sanitized) {
        const value = sanitized[key];
        if (typeof value === "string") {
            if (sanitizeUrls && (key.includes("url") || key.includes("link"))) {
                try {
                    sanitized[key] = sanitizeUrl(value);
                }
                catch {
                    sanitized[key] = "";
                }
            }
            else if (sanitizeStrings) {
                sanitized[key] = sanitizeHtml(value, { allowHtml: false });
            }
        }
        else if (value && typeof value === "object" && !Array.isArray(value)) {
            sanitized[key] = sanitizeObject(value, {
                ...options,
                maxDepth: maxDepth - 1,
            });
        }
        else if (Array.isArray(value)) {
            sanitized[key] = value.map((item) => {
                if (typeof item === "string") {
                    return sanitizeStrings ? sanitizeHtml(item, { allowHtml: false }) : item;
                }
                else if (item && typeof item === "object") {
                    return sanitizeObject(item, { ...options, maxDepth: maxDepth - 1 });
                }
                return item;
            });
        }
    }
    return sanitized;
}
/**
 * Sanitize JSON string
 */
function sanitizeJSON(json) {
    try {
        const parsed = JSON.parse(json);
        return sanitizeObject(parsed);
    }
    catch {
        return null;
    }
}
/**
 * Validate input against schema and sanitize
 */
function validateAndSanitize(input, schema) {
    const result = schema.safeParse(input);
    if (result.success) {
        return result;
    }
    return { success: false, error: result.error };
}
// Aliases for backward compatibility
const sanitizeText = (text) => sanitizeHtml(text, { allowHtml: false });
exports.sanitizeText = sanitizeText;
exports.sanitizeSQL = sanitizeSql;
exports.sanitizeHTML = sanitizeHtml;
const sanitizeURL = (url) => {
    try {
        return sanitizeUrl(url);
    }
    catch {
        return null;
    }
};
exports.sanitizeURL = sanitizeURL;
