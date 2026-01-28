/**
 * API Route Wrapper
 * Production-ready wrapper that adds rate limiting, logging, and error handling
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, createRateLimitMiddleware } from "./rate-limit";
import { logRequest } from "./request-logger";
import { handleError } from "@/lib/errors/handler";
import { AppError } from "@/lib/errors/app-error";
import { enforceTenantId } from "@/lib/db/client";
import { tracer } from "@/lib/observability/tracing";
import { metrics } from "@/lib/observability/metrics";

export interface ApiHandlerOptions {
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
  requireAuth?: boolean;
  requireRole?: string | string[];
  skipLogging?: boolean;
}

export type ApiHandler = (
  request: NextRequest,
  context?: { user?: any; tenantId?: string }
) => Promise<NextResponse>;

export function createApiHandler(
  handler: ApiHandler,
  options: ApiHandlerOptions = {}
): ApiHandler {
  return async (request: NextRequest, context?: any) => {
    const startTime = Date.now();
    let response: NextResponse | null = null;
    let error: Error | undefined;

    try {
      // Rate limiting
      if (options.rateLimit) {
        const rateLimitResult = await rateLimit(request, {
          windowMs: options.rateLimit.windowMs,
          maxRequests: options.rateLimit.maxRequests,
        });

        if (!rateLimitResult.success) {
          return NextResponse.json(
            {
              error: "Too many requests",
              message: `Rate limit exceeded. Try again after ${new Date(rateLimitResult.resetTime).toISOString()}`,
            },
            {
              status: 429,
              headers: {
                "X-RateLimit-Limit": options.rateLimit.maxRequests.toString(),
                "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
                "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
                "Retry-After": Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
              },
            }
          );
        }
      }

      // Authentication
      if (options.requireAuth !== false) {
        const { requireAuth, requireRole } = await import("@/lib/auth/session");
        const user = await requireAuth();
        
        if (options.requireRole) {
          const roles = Array.isArray(options.requireRole) 
            ? options.requireRole 
            : [options.requireRole];
          
          let hasRole = false;
          for (const role of roles) {
            try {
              await requireRole(role);
              hasRole = true;
              break;
            } catch {
              // Continue checking other roles
            }
          }
          
          if (!hasRole) {
            throw new AppError("Forbidden", 403, "FORBIDDEN");
          }
        }

        context = context || {};
        context.user = user;
        
        // Enforce tenant ID validation and normalization
        const userTenantId = (user as any).tenantId;
        if (!userTenantId) {
          throw new AppError("User tenant ID missing", 403, "TENANT_ID_REQUIRED");
        }
        
        // Validate and normalize tenant ID
        context.tenantId = enforceTenantId(userTenantId, "API request");
        
        // Add tenant ID to trace context for observability
        const activeSpan = tracer.getActiveSpan();
        if (activeSpan) {
          tracer.setTag(activeSpan.spanId, "tenant_id", context.tenantId);
        }
      }

      // Execute handler
      response = await handler(request, context);

      return response;
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      response = handleError(err);
      return response;
    } finally {
      // Logging
      if (!options.skipLogging) {
        await logRequest(request, response, startTime, error);
      }
    }
  };
}

// Convenience functions for common patterns
export function withAuth(handler: ApiHandler, role?: string | string[]) {
  return createApiHandler(handler, {
    requireAuth: true,
    requireRole: role,
  });
}

export function withRateLimit(
  handler: ApiHandler,
  windowMs: number = 60 * 1000,
  maxRequests: number = 100
) {
  return createApiHandler(handler, {
    rateLimit: { windowMs, maxRequests },
  });
}

export function withAuthAndRateLimit(
  handler: ApiHandler,
  options: {
    role?: string | string[];
    windowMs?: number;
    maxRequests?: number;
  } = {}
) {
  return createApiHandler(handler, {
    requireAuth: true,
    requireRole: options.role,
    rateLimit: {
      windowMs: options.windowMs || 60 * 1000,
      maxRequests: options.maxRequests || 100,
    },
  });
}
