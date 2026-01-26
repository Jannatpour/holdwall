"use strict";
/**
 * API Versioning
 * Production-ready API versioning strategy
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractVersion = extractVersion;
exports.withVersioning = withVersioning;
exports.isVersionCompatible = isVersionCompatible;
exports.migrateResponse = migrateResponse;
exports.versionResponse = versionResponse;
/**
 * Extract API version from request
 */
function extractVersion(request) {
    // Check header first
    const headerVersion = request.headers.get("api-version");
    if (headerVersion && (headerVersion === "v1" || headerVersion === "v2")) {
        return headerVersion;
    }
    // Check URL path
    const pathname = request.nextUrl.pathname;
    const versionMatch = pathname.match(/^\/api\/(v\d+)\//);
    if (versionMatch) {
        const version = versionMatch[1];
        return version;
    }
    // Check query parameter
    const queryVersion = request.nextUrl.searchParams.get("version");
    if (queryVersion && (queryVersion === "v1" || queryVersion === "v2")) {
        return queryVersion;
    }
    // Default to latest
    return "latest";
}
/**
 * Version-aware route handler wrapper
 */
function withVersioning(handler) {
    return (async (request) => {
        const version = extractVersion(request);
        const versionedRequest = request;
        versionedRequest.version = version;
        // Add version to response headers
        const response = await handler(versionedRequest, version);
        response.headers.set("api-version", version);
        response.headers.set("api-supported-versions", "v1, v2, latest");
        return response;
    });
}
/**
 * Version compatibility check
 */
function isVersionCompatible(requested, supported) {
    if (requested === "latest") {
        return true;
    }
    return supported.includes(requested);
}
/**
 * Version migration helper
 */
function migrateResponse(data, fromVersion, toVersion) {
    // In production, implement actual migration logic
    // For now, return as-is
    return data;
}
/**
 * Wrap response payload with API version metadata
 * (used by generic API helpers)
 */
function versionResponse(data, version = "latest") {
    return { version, data };
}
