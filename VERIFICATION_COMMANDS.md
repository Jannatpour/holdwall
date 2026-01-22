# Verification Commands - Quick Reference

## Complete Verification

Run all checks at once:
```bash
npm run verify
```

This command:
- ✅ Checks if server is running
- ✅ Runs health check (`/api/health`)
- ✅ Runs end-to-end flow verification (`/api/verification/run`)
- ✅ Runs test suite (`npm run test`)

## Individual Verification Commands

### 1. Health Check Only
```bash
npm run verify:health
```

**What it does:**
- Checks database connection
- Checks cache connection (Redis or fallback)
- Checks memory usage
- Checks protocol health

**Expected output:**
```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "cache": "ok"
  }
}
```

### 2. End-to-End Flows Only
```bash
npm run verify:flows
```

**What it does:**
- Verifies signal ingestion flow
- Verifies claim extraction flow
- Verifies artifact creation flow

**Note:** Requires authentication. Log in via browser first, or use browser console.

**Expected output:**
```json
{
  "success": true,
  "report": {
    "overallStatus": "pass",
    "totalFlows": 3,
    "passedFlows": 3
  }
}
```

### 3. Test Suite Only
```bash
npm run test
```

**What it does:**
- Runs all unit tests
- Runs all integration tests
- Runs all component tests

**Expected output:**
```
PASS  __tests__/...
  ✓ All tests passing

Test Suites: 5 passed, 5 total
Tests:       50 passed, 50 total
```

## Alternative: Using curl Commands

### Health Check
```bash
curl http://localhost:3000/api/health | jq
```

### End-to-End Verification
```bash
curl -X POST http://localhost:3000/api/verification/run \
  -H "Content-Type: application/json" \
  -d '{"flow": "all"}' | jq
```

**Note:** Requires authentication. Include session cookie or log in first.

## Quick Start

1. **Start server:**
   ```bash
   npm run dev
   ```

2. **Run verification:**
   ```bash
   npm run verify
   ```

3. **Check results:**
   - All checks should show ✅ (green checkmarks)
   - If all pass → System is 100% ready!

## Troubleshooting

### "Server not running"
```bash
# Start the server first
npm run dev
```

### "Authentication required"
The `/api/verification/run` endpoint requires authentication:
- Log in via browser first, OR
- Use browser console with session, OR
- Use health check which doesn't require auth

### "Database connection failed"
```bash
# Start PostgreSQL
docker-compose up -d postgres
```

### "Redis connection failed"
This is OK! System uses in-memory fallback automatically.

## All Verification Commands Summary

| Command | What It Does | Requires Auth |
|---------|--------------|---------------|
| `npm run verify` | All checks | Partial |
| `npm run verify:health` | Health check only | No |
| `npm run verify:flows` | End-to-end flows | Yes |
| `npm run test` | Test suite | No |

## Expected Results

When all checks pass:
```
✅ Server is running
✅ Health check passed
✅ End-to-end verification passed
✅ All tests passed
```

**If all checks pass → System is 100% ready for business!** 🎉
