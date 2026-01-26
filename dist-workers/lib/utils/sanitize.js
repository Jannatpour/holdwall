"use strict";
/**
 * Input Sanitization Utilities
 *
 * @deprecated Use lib/security/input-sanitizer.ts instead
 * This file re-exports from the canonical sanitization module for backward compatibility
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAndSanitize = exports.sanitizeJSON = exports.sanitizeFileName = exports.sanitizeInput = exports.sanitizePath = exports.sanitizeObject = exports.sanitizeSqlInput = exports.sanitizeUuid = exports.sanitizeEmail = exports.sanitizeUrl = exports.sanitizeText = exports.sanitizeHtml = void 0;
// Re-export from canonical sanitization module
var input_sanitizer_1 = require("@/lib/security/input-sanitizer");
Object.defineProperty(exports, "sanitizeHtml", { enumerable: true, get: function () { return input_sanitizer_1.sanitizeHtml; } });
Object.defineProperty(exports, "sanitizeText", { enumerable: true, get: function () { return input_sanitizer_1.sanitizeText; } });
Object.defineProperty(exports, "sanitizeUrl", { enumerable: true, get: function () { return input_sanitizer_1.sanitizeUrl; } });
Object.defineProperty(exports, "sanitizeEmail", { enumerable: true, get: function () { return input_sanitizer_1.sanitizeEmail; } });
Object.defineProperty(exports, "sanitizeUuid", { enumerable: true, get: function () { return input_sanitizer_1.sanitizeUuid; } });
Object.defineProperty(exports, "sanitizeSqlInput", { enumerable: true, get: function () { return input_sanitizer_1.sanitizeSql; } });
Object.defineProperty(exports, "sanitizeObject", { enumerable: true, get: function () { return input_sanitizer_1.sanitizeObject; } });
Object.defineProperty(exports, "sanitizePath", { enumerable: true, get: function () { return input_sanitizer_1.sanitizePath; } });
Object.defineProperty(exports, "sanitizeInput", { enumerable: true, get: function () { return input_sanitizer_1.sanitizeInput; } });
Object.defineProperty(exports, "sanitizeFileName", { enumerable: true, get: function () { return input_sanitizer_1.sanitizeFileName; } });
Object.defineProperty(exports, "sanitizeJSON", { enumerable: true, get: function () { return input_sanitizer_1.sanitizeJSON; } });
Object.defineProperty(exports, "validateAndSanitize", { enumerable: true, get: function () { return input_sanitizer_1.validateAndSanitize; } });
