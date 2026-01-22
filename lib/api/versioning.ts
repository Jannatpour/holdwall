/**
 * API Versioning
 * Production-ready API versioning strategy
 */

import { NextRequest, NextResponse } from "next/server";

export type ApiVersion = "v1" | "v2" | "latest";

export interface VersionedRequest extends NextRequest {
  version?: ApiVersion;
}

/**
 * Extract API version from request
 */
export function extractVersion(request: NextRequest): ApiVersion {
  // Check header first
  const headerVersion = request.headers.get("api-version");
  if (headerVersion && (headerVersion === "v1" || headerVersion === "v2")) {
    return headerVersion as ApiVersion;
  }

  // Check URL path
  const pathname = request.nextUrl.pathname;
  const versionMatch = pathname.match(/^\/api\/(v\d+)\//);
  if (versionMatch) {
    const version = versionMatch[1] as "v1" | "v2";
    return version;
  }

  // Check query parameter
  const queryVersion = request.nextUrl.searchParams.get("version");
  if (queryVersion && (queryVersion === "v1" || queryVersion === "v2")) {
    return queryVersion as ApiVersion;
  }

  // Default to latest
  return "latest";
}

/**
 * Version-aware route handler wrapper
 */
export function withVersioning<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: (request: VersionedRequest, version: ApiVersion) => Promise<NextResponse>
): T {
  return (async (request: NextRequest) => {
    const version = extractVersion(request);
    const versionedRequest = request as VersionedRequest;
    versionedRequest.version = version;

    // Add version to response headers
    const response = await handler(versionedRequest, version);
    response.headers.set("api-version", version);
    response.headers.set("api-supported-versions", "v1, v2, latest");

    return response;
  }) as T;
}

/**
 * Version compatibility check
 */
export function isVersionCompatible(
  requested: ApiVersion,
  supported: ApiVersion[]
): boolean {
  if (requested === "latest") {
    return true;
  }
  return supported.includes(requested);
}

/**
 * Version migration helper
 */
export function migrateResponse<T>(
  data: T,
  fromVersion: ApiVersion,
  toVersion: ApiVersion
): T {
  // In production, implement actual migration logic
  // For now, return as-is
  return data;
}

/**
 * Wrap response payload with API version metadata
 * (used by generic API helpers)
 */
export function versionResponse<T>(
  data: T,
  version: ApiVersion = "latest"
): { version: ApiVersion; data: T } {
  return { version, data };
}
