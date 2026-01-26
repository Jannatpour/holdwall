"use strict";
/**
 * Output Encoder
 *
 * Context-aware output encoding for XSS prevention
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeHtml = encodeHtml;
exports.encodeHtmlAttribute = encodeHtmlAttribute;
exports.encodeJavaScript = encodeJavaScript;
exports.encodeUrl = encodeUrl;
exports.encodeCss = encodeCss;
exports.encodeForContext = encodeForContext;
exports.safeJsonStringify = safeJsonStringify;
/**
 * Encode HTML entities
 */
function encodeHtml(input) {
    const entityMap = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
        "/": "&#x2F;",
    };
    return input.replace(/[&<>"'/]/g, (char) => entityMap[char] || char);
}
/**
 * Encode for HTML attribute context
 */
function encodeHtmlAttribute(input) {
    // More aggressive encoding for attributes
    return encodeHtml(input)
        .replace(/ /g, "&#32;")
        .replace(/\n/g, "&#10;")
        .replace(/\r/g, "&#13;")
        .replace(/\t/g, "&#9;");
}
/**
 * Encode for JavaScript context
 */
function encodeJavaScript(input) {
    return input
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t")
        .replace(/\//g, "\\/");
}
/**
 * Encode for URL context
 */
function encodeUrl(input) {
    return encodeURIComponent(input);
}
/**
 * Encode for CSS context
 */
function encodeCss(input) {
    // CSS encoding: escape special characters
    return input.replace(/[<>'"]/g, (char) => {
        const code = char.charCodeAt(0);
        return `\\${code.toString(16)} `;
    });
}
/**
 * Context-aware encoding
 */
function encodeForContext(input, context) {
    switch (context) {
        case "html":
            return encodeHtml(input);
        case "html-attribute":
            return encodeHtmlAttribute(input);
        case "javascript":
            return encodeJavaScript(input);
        case "url":
            return encodeUrl(input);
        case "css":
            return encodeCss(input);
        default:
            return encodeHtml(input); // Default to HTML encoding
    }
}
/**
 * Safe JSON stringify (prevents XSS in JSON responses)
 */
function safeJsonStringify(obj) {
    return JSON.stringify(obj)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/\//g, "\\/");
}
