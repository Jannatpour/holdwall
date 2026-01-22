# Quick Start Verification - Step by Step

Follow these steps to verify everything works correctly.

## Prerequisites

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Start database services** (if using Docker):
   ```bash
   docker-compose up -d postgres redis
   ```

## Step 1: Start the Server

Open a terminal and run:

```bash
npm run dev
```

**Expected output:**
```
▲ Next.js 16.1.4
- Local:        http://localhost:3000
- Ready in X.XXs
```

**Wait for**: The server to show "Ready" message

## Step 2: Run Verification

Open a **new terminal** (keep the server running) and run:

```bash
npm run verify
```

**What this does:**
- ✅ Checks if server is running
- ✅ Runs health check (`/api/health`)
- ✅ Runs end-to-end flow verification (`/api/verification/run`)
- ✅ Runs test suite (`npm run test`)

**Expected output:**
```
==========================================
Holdwall POS - Complete Verification
==========================================

ℹ️  Base URL: http://localhost:3000

Step 1: Checking if server is running...
✅ Server is running at http://localhost:3000

Step 2: Running health check...
✅ Health check passed - System is healthy

Step 3: Running end-to-end flow verification...
✅ End-to-end verification passed

Step 4: Running test suite...
✅ All tests passed

==========================================
Verification Summary
==========================================
```

## Step 3: Check Results

### ✅ All Checks Pass

If you see all green checkmarks (✅), your system is **100% verified and ready**!

### ⚠️ Warnings

If you see warnings:
- **Redis not available**: This is OK - system uses in-memory fallback
- **Some tests skipped**: This is OK if tests require specific setup

### ❌ Errors

If you see errors:

**Server not running:**
```bash
# Make sure server is running in another terminal
npm run dev
```

**Database connection failed:**
```bash
# Start PostgreSQL
docker-compose up -d postgres

# Or check DATABASE_URL environment variable
echo $DATABASE_URL
```

**Authentication required:**
- The verification endpoint requires authentication
- Log in via browser first, or use browser console

## Alternative: Individual Verification Steps

If you prefer to run checks individually:

### 1. Health Check Only
```bash
npm run verify:health
```

**Expected:**
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

**Note**: Requires authentication. Log in first or use browser console.

### 3. Test Suite Only
```bash
npm run test
```

**Expected:**
```
PASS  __tests__/...
  ✓ All tests passing

Test Suites: 5 passed, 5 total
Tests:       50 passed, 50 total
```

## Using Browser Console (Alternative)

If you're logged in via browser, you can run verification in the console:

### Health Check
```javascript
fetch('/api/health')
  .then(r => r.json())
  .then(console.log);
```

### End-to-End Verification
```javascript
fetch('/api/verification/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ flow: 'all' })
})
  .then(r => r.json())
  .then(console.log);
```

## Quick Verification Checklist

After running `npm run verify`, verify:

- [ ] ✅ Server is running
- [ ] ✅ Health check passed
- [ ] ✅ End-to-end verification passed (or authentication required)
- [ ] ✅ All tests passed

## Troubleshooting

### "Server is not running"
**Solution**: Start the server in a separate terminal:
```bash
npm run dev
```

### "ECONNREFUSED" or connection timeout
**Solution**: 
1. Check if server is running on port 3000
2. Check if another process is using port 3000
3. Try a different port: `PORT=3001 npm run dev`

### "401 Unauthorized" for verification endpoint
**Solution**: 
1. Log in via browser first
2. Or use browser console with session
3. Or check health endpoint which doesn't require auth

### "Database connection failed"
**Solution**:
```bash
# Start PostgreSQL
docker-compose up -d postgres

# Check connection
psql $DATABASE_URL -c "SELECT 1;"
```

### "Redis connection failed"
**Solution**: 
- This is OK! System uses in-memory fallback automatically
- To use Redis: `docker-compose up -d redis`

## Next Steps

After verification passes:

1. ✅ Your system is production-ready
2. ✅ All features are verified
3. ✅ All flows are working
4. ✅ All tests are passing

**You're all set!** 🎉

For complete verification including all 52 demo steps, see:
- `HOW_TO_BE_100_PERCENT_SURE.md` - Complete verification guide
- `QUICK_VERIFICATION_GUIDE.md` - Detailed verification instructions
