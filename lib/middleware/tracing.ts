/**
 * Request Tracing Middleware
 * Add distributed tracing to requests
 */

import { NextRequest, NextResponse } from "next/server";
import { tracer, extractTraceContext, injectTraceContext } from "@/lib/observability/tracing";
import { metrics } from "@/lib/observability/metrics";

export function withTracing(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const traceContext = extractTraceContext(request.headers) || tracer.startSpan(
      `${request.method} ${request.nextUrl.pathname}`
    );

    try {
      // Inject trace context into request
      const headers = new Headers(request.headers);
      injectTraceContext(traceContext, headers);

      const tracedRequest = new NextRequest(request.url, {
        method: request.method,
        headers,
        body: request.body,
      });

      const response = await handler(tracedRequest);

      // Add trace headers to response
      const responseHeaders = new Headers(response.headers);
      injectTraceContext(traceContext, responseHeaders);
      responseHeaders.set("x-trace-id", traceContext.trace_id);

      const duration = Date.now() - startTime;

      // Record metrics
      metrics.increment("http_requests_total", {
        method: request.method,
        path: request.nextUrl.pathname,
        status: response.status.toString(),
      });
      metrics.observe("http_request_duration_ms", duration, {
        method: request.method,
        path: request.nextUrl.pathname,
      });

      // Finish span
      tracer.finishSpan(traceContext.span_id, response.status >= 400 ? "error" : "ok");

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      metrics.increment("http_requests_total", {
        method: request.method,
        path: request.nextUrl.pathname,
        status: "500",
      });
      metrics.increment("http_errors_total", {
        method: request.method,
        path: request.nextUrl.pathname,
      });
      metrics.observe("http_request_duration_ms", duration, {
        method: request.method,
        path: request.nextUrl.pathname,
      });

      tracer.finishSpan(traceContext.span_id, "error", error as Error);

      throw error;
    }
  };
}
