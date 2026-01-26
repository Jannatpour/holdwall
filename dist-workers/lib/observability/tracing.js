"use strict";
/**
 * Distributed Tracing
 * Production tracing implementation with OpenTelemetry compatibility
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tracer = void 0;
exports.startTrace = startTrace;
exports.getCurrentTrace = getCurrentTrace;
exports.createChildSpan = createChildSpan;
exports.endTrace = endTrace;
exports.extractTraceContext = extractTraceContext;
exports.injectTraceContext = injectTraceContext;
exports.trace = trace;
const crypto_1 = require("crypto");
const logger_1 = require("@/lib/logging/logger");
let currentTrace = null;
function startTrace(correlation_id) {
    const trace_id = crypto.randomUUID();
    const span_id = crypto.randomUUID().substring(0, 16);
    currentTrace = {
        trace_id,
        span_id,
        correlation_id,
    };
    return currentTrace;
}
function getCurrentTrace() {
    return currentTrace;
}
function createChildSpan(parent) {
    const parentTrace = parent || currentTrace;
    if (!parentTrace) {
        return startTrace();
    }
    return {
        trace_id: parentTrace.trace_id,
        span_id: crypto.randomUUID().substring(0, 16),
        parent_span_id: parentTrace.span_id,
        correlation_id: parentTrace.correlation_id,
    };
}
function endTrace() {
    currentTrace = null;
}
/**
 * Send trace to tracing backend
 */
async function sendTraceToBackend(span) {
    // Try OpenTelemetry collector endpoint
    const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (otelEndpoint) {
        try {
            await fetch(`${otelEndpoint}/v1/traces`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    resourceSpans: [
                        {
                            resource: {
                                attributes: [
                                    { key: "service.name", value: { stringValue: "holdwall" } },
                                ],
                            },
                            scopeSpans: [
                                {
                                    spans: [
                                        {
                                            traceId: span.trace_id,
                                            spanId: span.span_id,
                                            parentSpanId: span.parent_span_id,
                                            name: span.operation,
                                            startTimeUnixNano: new Date(span.timestamp).getTime() * 1000000,
                                            endTimeUnixNano: (new Date(span.timestamp).getTime() + span.duration_ms) * 1000000,
                                            status: {
                                                code: span.status === "error" ? 2 : 1, // 1=OK, 2=ERROR
                                                message: span.error,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }),
            }).catch(() => {
                // Fallback to structured logging
                console.log(`[Trace] ${span.operation}`, span);
            });
            return;
        }
        catch {
            // Fallback to logging
        }
    }
    // Try Datadog agent endpoint
    const datadogAgentUrl = process.env.DD_AGENT_HOST;
    if (datadogAgentUrl) {
        try {
            await fetch(`http://${datadogAgentUrl}:8126/v0.4/traces`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/msgpack",
                },
                body: JSON.stringify([
                    [
                        {
                            trace_id: parseInt(span.trace_id.substring(0, 16), 16),
                            span_id: parseInt(span.span_id, 16),
                            parent_id: span.parent_span_id ? parseInt(span.parent_span_id, 16) : 0,
                            name: span.operation,
                            service: "holdwall",
                            resource: span.operation,
                            start: new Date(span.timestamp).getTime() * 1000000,
                            duration: span.duration_ms * 1000000,
                            error: span.status === "error" ? 1 : 0,
                        },
                    ],
                ]),
            }).catch(() => {
                // Fallback to structured logging
                console.log(`[Trace] ${span.operation}`, span);
            });
            return;
        }
        catch {
            // Fallback to logging
        }
    }
    // Fallback: structured logging
    if (span.status === "error") {
        console.error(`[Trace] ${span.operation}`, span);
    }
    else {
        console.log(`[Trace] ${span.operation}`, span);
    }
}
/**
 * Enhanced Tracer class with span management
 */
class Tracer {
    constructor() {
        this.spans = new Map();
        this.activeSpans = new Map();
    }
    /**
     * Start a new span
     */
    startSpan(operationName, context, tags) {
        const traceId = context?.trace_id || (0, crypto_1.randomUUID)();
        const spanId = (0, crypto_1.randomUUID)();
        const parentSpanId = context?.span_id;
        const span = {
            traceId,
            spanId,
            parentSpanId,
            operationName,
            startTime: Date.now(),
            tags: tags || {},
            logs: [],
            status: "ok",
        };
        this.spans.set(spanId, span);
        const contextKey = this.getContextKey();
        this.activeSpans.set(contextKey, spanId);
        return {
            trace_id: traceId,
            span_id: spanId,
            parent_span_id: parentSpanId,
            correlation_id: context?.correlation_id,
            baggage: context?.baggage,
        };
    }
    /**
     * Finish a span
     */
    finishSpan(spanId, status = "ok", error) {
        const span = this.spans.get(spanId);
        if (!span) {
            return;
        }
        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
        span.status = status;
        if (error) {
            span.error = error;
        }
        logger_1.logger.info("span", {
            traceId: span.traceId,
            spanId: span.spanId,
            operationName: span.operationName,
            duration: span.duration,
            status: span.status,
            tags: span.tags,
            error: error?.message,
        });
        // Send to backend
        sendTraceToBackend({
            operation: span.operationName,
            trace_id: span.traceId,
            span_id: span.spanId,
            parent_span_id: span.parentSpanId,
            duration_ms: span.duration,
            status: status === "ok" ? "success" : "error",
            error: error?.message,
            timestamp: new Date(span.startTime).toISOString(),
        }).catch(() => {
            // Ignore backend errors
        });
        const contextKey = this.getContextKey();
        if (this.activeSpans.get(contextKey) === spanId) {
            this.activeSpans.delete(contextKey);
        }
    }
    /**
     * Add tag to span
     */
    setTag(spanId, key, value) {
        const span = this.spans.get(spanId);
        if (span) {
            span.tags[key] = value;
        }
    }
    /**
     * Add log to span
     */
    log(spanId, fields) {
        const span = this.spans.get(spanId);
        if (span) {
            span.logs.push({
                timestamp: Date.now(),
                fields,
            });
        }
    }
    /**
     * Get active span
     */
    getActiveSpan() {
        const contextKey = this.getContextKey();
        const spanId = this.activeSpans.get(contextKey);
        if (!spanId) {
            return null;
        }
        return this.spans.get(spanId) || null;
    }
    /**
     * Get trace by ID
     */
    getTrace(traceId) {
        return Array.from(this.spans.values()).filter((s) => s.traceId === traceId);
    }
    /**
     * Get all spans
     */
    getAllSpans() {
        return Array.from(this.spans.values());
    }
    /**
     * Clear old spans
     */
    clearOldSpans() {
        if (this.spans.size > 1000) {
            const sorted = Array.from(this.spans.entries()).sort((a, b) => (b[1].endTime || b[1].startTime) - (a[1].endTime || a[1].startTime));
            const toKeep = sorted.slice(0, 1000);
            this.spans.clear();
            for (const [spanId, span] of toKeep) {
                this.spans.set(spanId, span);
            }
        }
    }
    getContextKey() {
        // In production, use AsyncLocalStorage or request context
        return "default";
    }
}
exports.tracer = new Tracer();
/**
 * Extract trace context from headers
 */
function extractTraceContext(headers) {
    const traceId = headers.get("x-trace-id") || headers.get("traceparent")?.split("-")[1];
    const spanId = headers.get("x-span-id") || headers.get("traceparent")?.split("-")[2];
    const parentSpanId = headers.get("x-parent-span-id");
    if (traceId && spanId) {
        return {
            trace_id: traceId,
            span_id: spanId,
            parent_span_id: parentSpanId || undefined,
        };
    }
    return null;
}
/**
 * Inject trace context into headers
 */
function injectTraceContext(context, headers) {
    headers.set("x-trace-id", context.trace_id);
    headers.set("x-span-id", context.span_id);
    if (context.parent_span_id) {
        headers.set("x-parent-span-id", context.parent_span_id);
    }
    // W3C Trace Context format
    headers.set("traceparent", `00-${context.trace_id}-${context.span_id}-01`);
}
function trace(fnOrName, operationNameOrFn) {
    const fn = typeof fnOrName === "function" ? fnOrName : operationNameOrFn;
    const operationName = typeof fnOrName === "string" ? fnOrName : operationNameOrFn;
    return (async (...args) => {
        const context = exports.tracer.startSpan(operationName);
        try {
            const result = await fn(...args);
            exports.tracer.finishSpan(context.span_id, "ok");
            return result;
        }
        catch (error) {
            exports.tracer.finishSpan(context.span_id, "error", error);
            throw error;
        }
    });
}
