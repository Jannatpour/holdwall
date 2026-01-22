# Quick Verification Guide - How to Verify Everything Works

This guide provides step-by-step instructions to verify that the Holdwall POS platform is working correctly.

## Prerequisites

1. **Server Running**: Make sure the development server is running
   ```bash
   npm run dev
   ```

2. **Database**: Ensure PostgreSQL and Redis are running (if using Docker)
   ```bash
   docker-compose up -d postgres redis
   ```

3. **Dependencies**: Install all dependencies
   ```bash
   npm install
   ```

## Method 1: Automated Script (Recommended)

### Using Node.js Script
```bash
# Make script executable
chmod +x scripts/verify-everything.js

# Run verification
node scripts/verify-everything.js

# Or with custom base URL
BASE_URL=http://localhost:3000 node scripts/verify-everything.js
```

### Using Bash Script
```bash
# Make script executable
chmod +x scripts/verify-everything.sh

# Run verification
./scripts/verify-everything.sh

# Or with custom base URL
BASE_URL=http://localhost:3000 ./scripts/verify-everything.sh
```

## Method 2: Manual Verification

### Step 1: Health Check

**Using curl:**
```bash
curl http://localhost:3000/api/health | jq
```

**Using browser:**
Navigate to: `http://localhost:3000/api/health`

**Expected Response:**
```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "cache": "ok",
    "memory": {
      "status": "ok",
      "used": 123456789,
      "total": 17179869184
    }
  },
  "timestamp": "2026-01-XX..."
}
```

**What to Check:**
- ✅ Status should be "healthy"
- ✅ Database check should be "ok"
- ✅ Cache check should be "ok" (or "fallback" if Redis not available)

### Step 2: End-to-End Flow Verification

**Using curl:**
```bash
curl -X POST http://localhost:3000/api/verification/run \
  -H "Content-Type: application/json" \
  -d '{"flow": "all"}' | jq
```

**Using browser (with authentication):**
1. Log in to the application
2. Open browser console
3. Run:
```javascript
fetch('/api/verification/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ flow: 'all' })
})
.then(r => r.json())
.then(console.log);
```

**Expected Response:**
```json
{
  "results": [
    {
      "flow": "signal",
      "status": "pass",
      "steps": [...],
      "duration": 1234
    },
    {
      "flow": "claim",
      "status": "pass",
      "steps": [...],
      "duration": 2345
    },
    {
      "flow": "artifact",
      "status": "pass",
      "steps": [...],
      "duration": 3456
    }
  ],
  "report": {
    "overallStatus": "pass",
    "totalFlows": 3,
    "passedFlows": 3,
    "failedFlows": 0,
    "totalDuration": 7035
  }
}
```

**What to Check:**
- ✅ Overall status should be "pass"
- ✅ All flows should have status "pass"
- ✅ No failed flows

**Note**: This endpoint requires authentication. If you get a 401 error, you need to:
1. Log in first
2. Include your session cookie in the request

### Step 3: Run Test Suite

**Run all tests:**
```bash
npm run test
```

**Run tests in watch mode:**
```bash
npm run test:watch
```

**Run tests with coverage:**
```bash
npm run test:coverage
```

**Expected Output:**
```
PASS  __tests__/...
  ✓ Test description
  ✓ Another test

Test Suites: 5 passed, 5 total
Tests:       50 passed, 50 total
```

**What to Check:**
- ✅ All test suites should pass
- ✅ All tests should pass
- ✅ No failing tests

## Method 3: Individual Flow Verification

You can verify specific flows individually:

### Verify Signal Ingestion Flow
```bash
curl -X POST http://localhost:3000/api/verification/run \
  -H "Content-Type: application/json" \
  -d '{"flow": "signal"}' | jq
```

### Verify Claim Extraction Flow
```bash
curl -X POST http://localhost:3000/api/verification/run \
  -H "Content-Type: application/json" \
  -d '{"flow": "claim"}' | jq
```

### Verify Artifact Creation Flow
```bash
curl -X POST http://localhost:3000/api/verification/run \
  -H "Content-Type: application/json" \
  -d '{"flow": "artifact"}' | jq
```

## Method 4: API Route Verification

Verify API route structure programmatically:

```bash
# This requires Node.js execution
node -e "
const { verifyAllAPIRoutes } = require('./lib/verification/api-route-verifier');
verifyAllAPIRoutes().then(results => {
  console.log(JSON.stringify(results, null, 2));
});
"
```

## Troubleshooting

### Server Not Running
**Error**: `ECONNREFUSED` or connection timeout

**Solution**:
```bash
npm run dev
```

### Authentication Required
**Error**: `401 Unauthorized` when calling `/api/verification/run`

**Solution**:
1. Log in to the application first
2. Include session cookie in requests:
```bash
curl -X POST http://localhost:3000/api/verification/run \
  -H "Content-Type: application/json" \
  -H "Cookie: $(cat .session-cookie)" \
  -d '{"flow": "all"}' | jq
```

### Database Connection Failed
**Error**: Health check shows database as "error"

**Solution**:
```bash
# Start PostgreSQL
docker-compose up -d postgres

# Or check DATABASE_URL environment variable
echo $DATABASE_URL
```

### Redis Connection Failed
**Error**: Health check shows cache as "error"

**Solution**:
```bash
# Start Redis
docker-compose up -d redis

# Or check REDIS_URL environment variable
echo $REDIS_URL
```

**Note**: Redis is optional - the system will use in-memory fallback if Redis is not available.

## Quick Verification Checklist

- [ ] Server is running (`npm run dev`)
- [ ] Health check passes (`GET /api/health`)
- [ ] End-to-end verification passes (`POST /api/verification/run`)
- [ ] All tests pass (`npm run test`)
- [ ] Database is connected
- [ ] Cache is working (or using fallback)

## Complete Verification

For comprehensive verification including:
- All 52 demo steps
- All API routes
- All business flows
- UI components
- Security measures
- Performance optimizations
- Observability

See: `HOW_TO_BE_100_PERCENT_SURE.md`

## Next Steps

After verification:
1. Review any warnings or errors
2. Check logs for detailed information
3. Run specific flow verifications if needed
4. Review test coverage report
5. Check health metrics

## Support

If verification fails:
1. Check server logs
2. Verify environment variables
3. Check database connectivity
4. Review error messages
5. See `HOW_TO_BE_100_PERCENT_SURE.md` for detailed troubleshooting
