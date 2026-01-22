# How to Verify Everything Works - Quick Guide

This is a quick reference guide for verifying that the Holdwall POS platform is working correctly.

## 🚀 Quick Verification (5 minutes)

### Method 1: Using npm Scripts (Easiest)

```bash
# Run complete verification (all checks)
npm run verify

# Or verify individual components:
npm run verify:health    # Health check only
npm run verify:flows     # End-to-end flows only (requires auth)
npm run test             # Test suite only
```

### Method 2: Using curl Commands

**1. Health Check:**
```bash
curl http://localhost:3000/api/health | jq
```

**Expected**: Status should be `"healthy"`

**2. End-to-End Verification:**
```bash
curl -X POST http://localhost:3000/api/verification/run \
  -H "Content-Type: application/json" \
  -d '{"flow": "all"}' | jq
```

**Expected**: `"overallStatus": "pass"`

**Note**: This requires authentication. Log in first, or use browser console with session.

**3. Run Tests:**
```bash
npm run test
```

**Expected**: All tests pass

### Method 3: Using Verification Scripts

**Node.js Script:**
```bash
node scripts/verify-everything.js
```

**Bash Script:**
```bash
./scripts/verify-everything.sh
```

## 📋 What Each Verification Checks

### Health Check (`/api/health`)
- ✅ Database connection
- ✅ Cache connection (Redis or fallback)
- ✅ Memory usage
- ✅ Protocol health (A2A, ANP, AP2, AG-UI, Security)

### End-to-End Verification (`/api/verification/run`)
- ✅ Signal Ingestion Flow
  - Business rules validation
  - Idempotency
  - Error recovery
- ✅ Claim Extraction Flow
  - Evidence validation
  - Claim extraction
- ✅ Artifact Creation Flow
  - Transaction management
  - Evidence references

### Test Suite (`npm run test`)
- ✅ Unit tests
- ✅ Integration tests
- ✅ Component tests

## 🔍 Expected Results

### Health Check Response
```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "cache": "ok",
    "memory": { "status": "ok" }
  }
}
```

### Verification Response
```json
{
  "success": true,
  "report": {
    "overallStatus": "pass",
    "totalFlows": 3,
    "passedFlows": 3,
    "failedFlows": 0
  }
}
```

### Test Results
```
PASS  __tests__/...
  ✓ All tests passing

Test Suites: 5 passed, 5 total
Tests:       50 passed, 50 total
```

## ⚠️ Troubleshooting

### Server Not Running
```bash
# Start the server
npm run dev
```

### Authentication Required
The `/api/verification/run` endpoint requires authentication. Options:
1. Log in via browser first
2. Use browser console with session cookie
3. Or use the health check which doesn't require auth

### Database Not Connected
```bash
# Start PostgreSQL
docker-compose up -d postgres
```

### Redis Not Available
Redis is optional - the system will use in-memory fallback automatically.

## 📚 More Information

For complete verification including all 52 demo steps, see:
- `QUICK_VERIFICATION_GUIDE.md` - Detailed verification guide
- `HOW_TO_BE_100_PERCENT_SURE.md` - Complete verification checklist

## ✅ Quick Checklist

- [ ] Server running (`npm run dev`)
- [ ] Health check passes (`npm run verify:health`)
- [ ] End-to-end verification passes (`npm run verify:flows`)
- [ ] All tests pass (`npm run test`)

If all checks pass, your system is **100% verified and ready**! 🎉
