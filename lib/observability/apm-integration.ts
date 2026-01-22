/**
 * APM Integration
 * 
 * Integration with Application Performance Monitoring tools
 * Supports Datadog, New Relic, and OpenTelemetry
 */

import { metrics } from "./metrics";
import { getCurrentTrace, createChildSpan } from "./tracing";
import { logger } from "@/lib/logging/logger";

export interface APMConfig {
  provider: "datadog" | "newrelic" | "opentelemetry" | "none";
  apiKey?: string;
  serviceName?: string;
  environment?: string;
}

let apmConfig: APMConfig = {
  provider: process.env.APM_PROVIDER as any || "none",
  apiKey: process.env.APM_API_KEY,
  serviceName: process.env.APM_SERVICE_NAME || "holdwall",
  environment: process.env.NODE_ENV || "development",
};

/**
 * Initialize APM integration
 */
export function initializeAPM(config?: Partial<APMConfig>): void {
  if (config) {
    apmConfig = { ...apmConfig, ...config };
  }

  switch (apmConfig.provider) {
    case "datadog":
      initializeDatadog();
      break;
    case "newrelic":
      initializeNewRelic();
      break;
    case "opentelemetry":
      initializeOpenTelemetry();
      break;
    default:
      console.log("APM disabled or not configured");
  }
}

/**
 * Send trace to APM
 */
export async function sendTrace(
  operationName: string,
  duration: number,
  status: "success" | "error",
  metadata?: Record<string, unknown>
): Promise<void> {
  const trace = getCurrentTrace();
  if (!trace) {
    return;
  }

  switch (apmConfig.provider) {
    case "datadog":
      await sendDatadogTrace(operationName, duration, status, trace, metadata);
      break;
    case "newrelic":
      await sendNewRelicTrace(operationName, duration, status, trace, metadata);
      break;
    case "opentelemetry":
      await sendOpenTelemetryTrace(operationName, duration, status, trace, metadata);
      break;
  }
}

/**
 * Send metric to APM
 */
export async function sendMetric(
  name: string,
  value: number,
  tags?: Record<string, string>
): Promise<void> {
  switch (apmConfig.provider) {
    case "datadog":
      await sendDatadogMetric(name, value, tags);
      break;
    case "newrelic":
      await sendNewRelicMetric(name, value, tags);
      break;
    case "opentelemetry":
      await sendOpenTelemetryMetric(name, value, tags);
      break;
  }
}

/**
 * Datadog integration
 */
function initializeDatadog(): void {
  try {
    // Try to initialize dd-trace for Node.js
    if (typeof window === "undefined") {
      // Server-side: use dd-trace
      Promise.resolve()
        .then(() => {
          // Avoid hard dependency at build-time.
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const ddTrace = require("dd-trace");
          ddTrace.init({
            service: apmConfig.serviceName,
            env: apmConfig.environment,
            version: process.env.APP_VERSION,
            logInjection: true,
            runtimeMetrics: true,
            profiling: true,
          });
          logger.info("Datadog APM initialized (dd-trace)");
        })
        .catch((error: any) => {
          logger.warn("dd-trace not installed, Datadog APM will use logging fallback", {
            note: "Install with: npm install dd-trace",
            error: error?.message,
          });
        });
    } else {
      // Client-side: use @datadog/browser-rum
      Promise.resolve()
        .then(() => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const datadogRum = require("@datadog/browser-rum");
          (datadogRum.default || datadogRum).init({
            applicationId: apmConfig.apiKey || "",
            clientToken: process.env.DATADOG_CLIENT_TOKEN || "",
            site: process.env.DATADOG_SITE || "datadoghq.com",
            service: apmConfig.serviceName,
            env: apmConfig.environment,
            version: process.env.APP_VERSION,
            sessionSampleRate: 100,
            premiumSampleRate: 100,
            trackUserInteractions: true,
            trackResources: true,
            trackLongTasks: true,
          });
          logger.info("Datadog RUM initialized");
        })
        .catch((error: any) => {
          logger.warn("@datadog/browser-rum not installed, Datadog RUM will use logging fallback", {
            note: "Install with: npm install @datadog/browser-rum",
            error: error?.message,
          });
        });
    }
  } catch (error) {
    logger.warn("Datadog APM initialization failed, using logging fallback", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function sendDatadogTrace(
  operationName: string,
  duration: number,
  status: "success" | "error",
  trace: { trace_id: string; span_id: string },
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    if (typeof window === "undefined") {
      // Server-side: use dd-trace
      let ddTrace: any = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        ddTrace = require("dd-trace");
      } catch {
        ddTrace = null;
      }
      if (ddTrace) {
        const span = ddTrace.scope?.().active?.() || ddTrace.tracer?.().scope?.().active?.();
        if (span) {
          span.setTag("operation.name", operationName);
          span.setTag("status", status);
          if (metadata) {
            for (const [key, value] of Object.entries(metadata)) {
              span.setTag(key, String(value));
            }
          }
        }
        return;
      }
    } else {
      // Client-side: use @datadog/browser-rum
      let datadogRum: any = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        datadogRum = require("@datadog/browser-rum");
      } catch {
        datadogRum = null;
      }
      const rum = datadogRum?.default || datadogRum;
      if (rum?.addAction) {
        rum.addAction(operationName, {
          status,
          duration,
          ...metadata,
        });
        return;
      }
    }
  } catch (error) {
    // Fall through to logging
  }

  // Fallback: log structured data
  logger.debug("[Datadog Trace]", {
    operation: operationName,
    duration_ms: duration,
    status,
    trace_id: trace.trace_id,
    span_id: trace.span_id,
    ...metadata,
  });
}

async function sendDatadogMetric(
  name: string,
  value: number,
  tags?: Record<string, string>
): Promise<void> {
  try {
    // Try to use StatsD client if available
    let HotShots: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      HotShots = require("hot-shots");
    } catch {
      HotShots = null;
    }
    const StatsD = HotShots?.default || HotShots;
    if (StatsD) {
      const client = new StatsD({
        host: process.env.DATADOG_STATSD_HOST || "localhost",
        port: parseInt(process.env.DATADOG_STATSD_PORT || "8125"),
        prefix: `${apmConfig.serviceName}.`,
        tags: tags ? Object.entries(tags).map(([k, v]) => `${k}:${v}`) : [],
      });
      client.gauge(name, value);
      return;
    }

    // Fallback: use Datadog API if API key is available
    if (apmConfig.apiKey && process.env.DATADOG_API_KEY) {
      const response = await fetch("https://api.datadoghq.com/api/v1/series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "DD-API-KEY": process.env.DATADOG_API_KEY,
        },
        body: JSON.stringify({
          series: [
            {
              metric: name,
              points: [[Math.floor(Date.now() / 1000), value]],
              tags: tags ? Object.entries(tags).map(([k, v]) => `${k}:${v}`) : [],
            },
          ],
        }),
      });

      if (response.ok) {
        return;
      }
    }
  } catch (error) {
    // Fall through to logging
  }

  // Fallback: log structured data
  logger.debug("[Datadog Metric]", { name, value, tags });
}

/**
 * New Relic integration
 */
function initializeNewRelic(): void {
  try {
    if (typeof window === "undefined") {
      // Server-side: use newrelic agent
      Promise.resolve()
        .then(() => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require("newrelic");
          // New Relic agent auto-initializes from newrelic.js config file
          // or environment variables (NEW_RELIC_LICENSE_KEY, NEW_RELIC_APP_NAME, etc.)
          logger.info("New Relic APM initialized (agent)", {
            appName: process.env.NEW_RELIC_APP_NAME || apmConfig.serviceName,
          });
        })
        .catch((error: any) => {
          logger.warn("newrelic package not installed, New Relic APM will use logging fallback", {
            note: "Install with: npm install newrelic",
            error: error?.message,
          });
        });
    } else {
      // Client-side: use browser agent
      logger.info("New Relic browser agent should be loaded via script tag in HTML");
    }
  } catch (error) {
    logger.warn("New Relic APM initialization failed, using logging fallback", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function sendNewRelicTrace(
  operationName: string,
  duration: number,
  status: "success" | "error",
  trace: { trace_id: string; span_id: string },
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    if (typeof window === "undefined") {
      let newrelic: any = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        newrelic = require("newrelic");
      } catch {
        newrelic = null;
      }
      const nr = newrelic?.default || newrelic;
      if (nr?.recordCustomEvent) {
        nr.recordCustomEvent(operationName, {
          duration_ms: duration,
          status,
          trace_id: trace.trace_id,
          span_id: trace.span_id,
          ...metadata,
        });
        return;
      }
    }
  } catch (error) {
    // Fall through to logging
  }

  // Fallback: log structured data
  logger.debug("[New Relic Trace]", {
    operation: operationName,
    duration_ms: duration,
    status,
    trace_id: trace.trace_id,
    span_id: trace.span_id,
    ...metadata,
  });
}

async function sendNewRelicMetric(
  name: string,
  value: number,
  tags?: Record<string, string>
): Promise<void> {
  try {
    if (typeof window === "undefined") {
      let newrelic: any = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        newrelic = require("newrelic");
      } catch {
        newrelic = null;
      }
      const nr = newrelic?.default || newrelic;
      if (nr?.recordMetric) {
        nr.recordMetric(name, value);
        if (tags) {
          nr.recordCustomEvent?.(`metric.${name}`, {
            value,
            ...tags,
          });
        }
        return;
      }
    }

    // Fallback: use New Relic Insights API if license key is available
    if (process.env.NEW_RELIC_LICENSE_KEY && process.env.NEW_RELIC_ACCOUNT_ID) {
      const response = await fetch(
        `https://insights-collector.newrelic.com/v1/accounts/${process.env.NEW_RELIC_ACCOUNT_ID}/events`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Api-Key": process.env.NEW_RELIC_LICENSE_KEY,
          },
          body: JSON.stringify([
            {
              eventType: "CustomMetric",
              metricName: name,
              metricValue: value,
              ...tags,
            },
          ]),
        }
      );

      if (response.ok) {
        return;
      }
    }
  } catch (error) {
    // Fall through to logging
  }

  // Fallback: log structured data
  logger.debug("[New Relic Metric]", { name, value, tags });
}

/**
 * OpenTelemetry integration
 */
function initializeOpenTelemetry(): void {
  try {
    if (typeof window === "undefined") {
      // Server-side: initialize OpenTelemetry SDK
      Promise.resolve().then(() => {
        let api: any = null;
        let sdkNode: any = null;
        let otlpExporter: any = null;
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          api = require("@opentelemetry/api");
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          sdkNode = require("@opentelemetry/sdk-node");
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          otlpExporter = require("@opentelemetry/exporter-trace-otlp-http");
        } catch (e: any) {
          logger.warn("OpenTelemetry packages not installed, using logging fallback", {
            note: "Install with: npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http",
            error: e?.message,
          });
          return;
        }

        const { NodeSDK } = sdkNode || {};
        const { OTLPTraceExporter } = otlpExporter || {};
        if (!NodeSDK || !OTLPTraceExporter) {
          logger.warn("OpenTelemetry packages not fully installed", {
            note: "Install with: npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http",
          });
          return;
        }

        const sdk = new NodeSDK({
          serviceName: apmConfig.serviceName,
          traceExporter: new OTLPTraceExporter({
            url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1/traces",
          }),
        });

        sdk.start();
        logger.info("OpenTelemetry APM initialized (Node SDK)");
      });
    } else {
      // Client-side: initialize browser SDK
      logger.info("OpenTelemetry browser SDK should be initialized via @opentelemetry/sdk-web");
    }
  } catch (error) {
    logger.warn("OpenTelemetry APM initialization failed, using logging fallback", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function sendOpenTelemetryTrace(
  operationName: string,
  duration: number,
  status: "success" | "error",
  trace: { trace_id: string; span_id: string },
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    let api: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      api = require("@opentelemetry/api");
    } catch {
      api = null;
    }
    if (api?.trace) {
      const tracer = api.trace.getTracer(apmConfig.serviceName || "holdwall");
      const span = tracer.startSpan(operationName);
      
      span.setStatus({
        code: status === "success" ? api.SpanStatusCode.OK : api.SpanStatusCode.ERROR,
      });
      
      if (metadata) {
        for (const [key, value] of Object.entries(metadata)) {
          span.setAttribute(key, String(value));
        }
      }
      
      span.setAttribute("duration_ms", duration);
      span.setAttribute("trace_id", trace.trace_id);
      span.setAttribute("span_id", trace.span_id);
      
      span.end();
      return;
    }
  } catch (error) {
    // Fall through to logging
  }

  // Fallback: log structured data
  logger.debug("[OpenTelemetry Trace]", {
    operation: operationName,
    duration_ms: duration,
    status,
    trace_id: trace.trace_id,
    span_id: trace.span_id,
    ...metadata,
  });
}

async function sendOpenTelemetryMetric(
  name: string,
  value: number,
  tags?: Record<string, string>
): Promise<void> {
  try {
    let api: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      api = require("@opentelemetry/api");
    } catch {
      api = null;
    }
    if (api?.metrics) {
      const meter = api.metrics.getMeter(apmConfig.serviceName || "holdwall");
      const counter = meter.createCounter(name, {
        description: `Metric: ${name}`,
      });

      const attributes: Record<string, string> = tags || {};
      counter.add(value, attributes);
      return;
    }
  } catch (error) {
    // Fall through to logging
  }

  // Fallback: log structured data
  logger.debug("[OpenTelemetry Metric]", { name, value, tags });
}
