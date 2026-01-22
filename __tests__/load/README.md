# Load Testing

This directory contains load testing scripts for the Holdwall POS application.

## Quick Start

### Basic Load Test

```bash
npm run test:load
```

### Custom Configuration

Set environment variables to customize the load test:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
LOAD_TEST_USERS=20 \
LOAD_TEST_REQUESTS=10 \
LOAD_TEST_RAMP_UP=10000 \
npm run test:load
```

## Environment Variables

- `NEXT_PUBLIC_APP_URL`: Base URL of the application (default: `http://localhost:3000`)
- `LOAD_TEST_USERS`: Number of concurrent users (default: `10`)
- `LOAD_TEST_REQUESTS`: Number of requests per user per endpoint (default: `5`)
- `LOAD_TEST_RAMP_UP`: Ramp-up time in milliseconds (default: `5000`)

## Advanced Load Testing

For more advanced load testing scenarios, consider using:

### k6

```bash
# Install k6
brew install k6  # macOS
# or download from https://k6.io/docs/getting-started/installation/

# Run k6 script
k6 run load-test-k6.js
```

### Artillery

```bash
# Install Artillery
npm install -g artillery

# Run Artillery config
artillery run artillery-config.yml
```

### Apache Bench (ab)

```bash
# Simple load test
ab -n 1000 -c 10 http://localhost:3000/api/health
```

## Test Results

The load test script outputs:
- Total requests
- Successful vs failed requests
- Average, min, max response times
- Percentiles (P50, P95, P99)
- Error breakdown by status code

## Best Practices

1. **Start Small**: Begin with low concurrency and gradually increase
2. **Monitor Resources**: Watch CPU, memory, and database connections
3. **Test Staging**: Always test in staging before production
4. **Set Baselines**: Establish performance baselines for comparison
5. **Test Realistic Scenarios**: Test actual user workflows, not just endpoints

## Example Output

```
=== Load Test Results ===

Endpoint: /api/health
  Total Requests: 50
  Successful: 50
  Failed: 0
  Average Response Time: 12.34ms
  Min: 8.12ms
  Max: 25.67ms
  P50: 11.23ms
  P95: 22.45ms
  P99: 24.56ms
```
