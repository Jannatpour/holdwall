# Kafka Connection Error Handling - Improvements Summary

## Overview

Comprehensive improvements to Kafka connection error handling, diagnostics, and resilience have been implemented to address DNS resolution errors and other connection issues.

## Changes Made

### 1. Enhanced Error Handling

**Files Updated:**
- `lib/events/outbox-publisher.ts`
- `lib/events/kafka-consumer.ts`
- `lib/events/store-kafka.ts`
- `lib/events/store-db.ts`
- `lib/events/kafka-dlq.ts`

**Improvements:**
- ✅ DNS/connection error detection and classification
- ✅ Detailed error messages with diagnostic hints
- ✅ Connection timeout configuration via environment variables
- ✅ Request timeout configuration
- ✅ Graceful error handling that doesn't crash the application

### 2. Health Check Enhancements

**File:** `lib/monitoring/health.ts`

**Improvements:**
- ✅ TLS/SSL configuration support in health checks
- ✅ SASL authentication support
- ✅ Connection timeout configuration
- ✅ Detailed error logging for DNS/network issues
- ✅ Proper error classification

### 3. Startup Validation

**File:** `lib/integration/startup.ts`

**Improvements:**
- ✅ Optional connection testing at startup (`KAFKA_VALIDATE_ON_STARTUP`)
- ✅ TLS/SSL and SASL configuration support
- ✅ Detailed error messages with hints
- ✅ Non-blocking validation (doesn't fail startup)
- ✅ Connection timeout configuration

### 4. New Utility Functions

**File:** `lib/events/kafka-utils.ts` (NEW)

**Features:**
- ✅ `validateBrokerConfig()` - Validates broker hostname:port format
- ✅ `isConnectionError()` - Detects DNS/network connection errors
- ✅ `getConnectionErrorDetails()` - Provides detailed error classification
- ✅ `logConnectionError()` - Standardized error logging with context
- ✅ `createKafkaConfig()` - Unified Kafka client configuration
- ✅ `connectWithRetry()` - Retry logic with exponential backoff

### 5. Connection Manager

**File:** `lib/events/kafka-connection-manager.ts` (NEW)

**Features:**
- ✅ Circuit breaker pattern integration
- ✅ Connection state tracking
- ✅ Automatic retry with exponential backoff
- ✅ Producer and consumer connection management
- ✅ Graceful disconnection
- ✅ Connection state monitoring

### 6. Documentation

**File:** `docs/KAFKA_TROUBLESHOOTING.md` (NEW)

**Contents:**
- ✅ Common error types and solutions
- ✅ DNS resolution troubleshooting
- ✅ AWS MSK specific guidance
- ✅ Environment variable reference
- ✅ Diagnostic tools and commands
- ✅ Testing connectivity
- ✅ Circuit breaker behavior
- ✅ Prevention strategies

## Environment Variables

### New/Enhanced Variables

```bash
# Connection timeouts (NEW)
KAFKA_CONNECTION_TIMEOUT=10000      # Default: 10000ms
KAFKA_REQUEST_TIMEOUT=30000         # Default: 30000ms

# Startup validation (NEW)
KAFKA_VALIDATE_ON_STARTUP=false    # Default: false
```

### Existing Variables (Enhanced Support)

All existing Kafka environment variables now have better error handling:
- `KAFKA_ENABLED`
- `KAFKA_BROKERS`
- `KAFKA_SSL` / `KAFKA_TLS`
- `KAFKA_SASL_MECHANISM`
- `KAFKA_SASL_USERNAME`
- `KAFKA_SASL_PASSWORD`
- `HEALTH_INCLUDE_KAFKA`

## Error Classification

Errors are now classified into types:

1. **DNS Errors** (`ENOTFOUND`, `getaddrinfo`)
   - Specific hints for DNS resolution issues
   - AWS MSK specific guidance

2. **Network Errors** (`ECONNREFUSED`)
   - Firewall and security group hints
   - Port configuration guidance

3. **Timeout Errors** (`ETIMEDOUT`)
   - Network latency suggestions
   - Timeout configuration guidance

4. **Authentication Errors** (SASL/SSL)
   - Credential verification steps
   - Certificate configuration help

## Metrics

New metrics added:
- `kafka_connection_errors` - Tracks connection failures by type
- `kafka_connections` - Tracks successful connections

## Circuit Breaker Integration

The connection manager integrates with the existing circuit breaker pattern:
- Prevents repeated connection attempts when Kafka is unavailable
- Automatic recovery when service becomes available
- Configurable failure thresholds and reset timeouts

## Graceful Degradation

When Kafka is unavailable:
- ✅ Events still stored in database (source of truth)
- ✅ Outbox pattern ensures eventual publishing
- ✅ Application continues to function
- ✅ Clear error messages guide troubleshooting

## Usage Examples

### Using Connection Manager

```typescript
import { KafkaConnectionManager } from "@/lib/events/kafka-connection-manager";
import { createKafkaConfig } from "@/lib/events/kafka-utils";

const manager = new KafkaConnectionManager({
  brokers: process.env.KAFKA_BROKERS.split(","),
  clientId: "my-client",
});

const kafkaConfig = createKafkaConfig({
  clientId: "my-client",
  brokers: process.env.KAFKA_BROKERS.split(","),
  ssl: true,
});

manager.initializeKafkaClient(kafkaConfig);
await manager.connectProducer();
```

### Using Utilities

```typescript
import { validateBrokerConfig, isConnectionError } from "@/lib/events/kafka-utils";

// Validate configuration
const validation = validateBrokerConfig(brokers);
if (!validation.valid) {
  console.error("Invalid brokers:", validation.errors);
}

// Check error type
try {
  await producer.connect();
} catch (error) {
  if (isConnectionError(error)) {
    // Handle DNS/network error
  }
}
```

## Testing

### Validate Configuration

```bash
# Enable startup validation
export KAFKA_VALIDATE_ON_STARTUP=true

# Run application - will test connection at startup
npm start
```

### Health Check

```bash
# Enable Kafka in health checks
export HEALTH_INCLUDE_KAFKA=true

# Check health
curl http://localhost:3000/api/health
```

### Manual Verification

```bash
# Use existing verification script
npm run verify:kafka
```

## Migration Guide

### For Existing Code

No breaking changes. All improvements are backward compatible.

### Recommended Updates

1. **Enable Startup Validation** (optional but recommended):
   ```bash
   export KAFKA_VALIDATE_ON_STARTUP=true
   ```

2. **Configure Timeouts** (if experiencing timeout issues):
   ```bash
   export KAFKA_CONNECTION_TIMEOUT=30000
   export KAFKA_REQUEST_TIMEOUT=60000
   ```

3. **Enable Health Checks** (for monitoring):
   ```bash
   export HEALTH_INCLUDE_KAFKA=true
   ```

## Benefits

1. **Better Diagnostics**: Clear error messages with actionable hints
2. **Resilience**: Circuit breaker prevents cascading failures
3. **Observability**: Metrics track connection health
4. **Documentation**: Comprehensive troubleshooting guide
5. **Flexibility**: Configurable timeouts and validation
6. **Graceful Degradation**: Application continues when Kafka is unavailable

## Next Steps

1. Monitor connection error metrics
2. Review logs for DNS/network issues
3. Update documentation with environment-specific notes
4. Consider using `KafkaConnectionManager` for new code
5. Enable startup validation in staging/production

## Support

For issues:
1. Check `docs/KAFKA_TROUBLESHOOTING.md`
2. Review application logs for detailed error messages
3. Verify environment variables
4. Test connectivity using provided tools
