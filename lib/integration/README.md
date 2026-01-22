# Integration Guide

## Quick Start

All production features are integrated and ready to use. Here's how to leverage them:

### 1. Caching

```typescript
import { cacheManager } from "@/lib/cache/strategy";

// Set with tags
await cacheManager.set("key", data, {
  ttl: 3600,
  tags: [{ type: "claim", id: "123" }],
});

// Get
const data = await cacheManager.get("key");

// Invalidate by tag
await cacheManager.invalidateTag({ type: "claim", id: "123" });
```

### 2. Metrics

```typescript
import { metrics } from "@/lib/observability/metrics";

// Increment counter
metrics.increment("api_requests", { endpoint: "/api/claims" });

// Set gauge
metrics.setGauge("active_users", 42);

// Observe histogram
metrics.observe("request_duration_ms", 150);
```

### 3. Tracing

```typescript
import { tracer } from "@/lib/observability/tracing-enhanced";

const context = tracer.startSpan("operation-name");
try {
  // Your code
  tracer.finishSpan(context.spanId, "ok");
} catch (error) {
  tracer.finishSpan(context.spanId, "error", error);
}
```

### 4. Rate Limiting

```typescript
import { withRateLimit } from "@/lib/rate-limit/enhanced";

export const GET = withRateLimit(
  {
    windowMs: 60000,
    maxRequests: 100,
    strategy: "sliding",
  },
  async (request) => {
    // Your handler
  }
);
```

### 5. i18n

```typescript
import { t, detectLocale } from "@/lib/i18n/config";

const locale = detectLocale(request);
const text = t("common.save", locale);
```

### 6. Accessibility

```typescript
import { useFocusTrap, useFocusRestore } from "@/lib/accessibility/focus-manager";

// In component
const containerRef = useFocusTrap(isOpen);
```

## Environment Variables

Add these to your `.env.local`:

```bash
# Redis (optional)
REDIS_URL=redis://localhost:6379

# CSRF
CSRF_SECRET=your-secret-key

# Base URL
NEXT_PUBLIC_BASE_URL=https://holdwall.com

# Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info
```

## Testing

Run the test suite:

```bash
npm test
npm run test:coverage
```

## Deployment

The CI/CD pipeline handles:
- Linting
- Testing
- Building
- Security scanning
- Deployment to staging/production

## Monitoring

- **Metrics**: `/api/metrics` (Prometheus format)
- **Traces**: `/api/traces`
- **Health**: `/api/health`
- **API Docs**: `/api/docs`
