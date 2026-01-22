/**
 * Request Logging Middleware
 * Structured logging for all API requests
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logging/logger";

export interface RequestLogContext {
  method: string;
  path: string;
  query?: Record<string, string>;
  user?: {
    id: string;
    tenantId: string;
    role?: string;
  };
  ip?: string;
  userAgent?: string;
  duration?: number;
  statusCode?: number;
  error?: Error;
}

export async function logRequest(
  request: NextRequest,
  response: NextResponse | null,
  startTime: number,
  error?: Error
): Promise<void> {
  const duration = Date.now() - startTime;
  const user = (request as any).user;
  const ip = request.headers.get("x-forwarded-for") || 
             request.headers.get("x-real-ip") || 
             "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  const logContext: RequestLogContext = {
    method: request.method,
    path: request.nextUrl.pathname,
    query: Object.fromEntries(request.nextUrl.searchParams.entries()),
    ip,
    userAgent,
    duration,
  };

  if (user) {
    logContext.user = {
      id: user.id || "unknown",
      tenantId: user.tenantId || "unknown",
      role: user.role,
    };
  }

  if (response) {
    logContext.statusCode = response.status;
  }

  if (error) {
    logContext.error = error;
    logger.error("API request failed", logContext);
  } else if (response && response.status >= 400) {
    logger.warn("API request returned error", logContext);
  } else {
    logger.info("API request completed", logContext);
  }
}

export function createRequestLoggerMiddleware() {
  return async (
    request: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> => {
    const startTime = Date.now();
    let response: NextResponse | null = null;
    let error: Error | undefined;

    try {
      response = await handler(request);
      return response;
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      response = NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
      return response;
    } finally {
      await logRequest(request, response, startTime, error);
    }
  };
}
