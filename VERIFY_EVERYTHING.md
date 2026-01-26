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
npm run verify:canary    # Production canary checks (Auth + SKU flows; token-gated)
npm run verify:kafka     # Kafka runtime verification (brokers/topics/lag/DLQ; requires broker)
```

### Method 2: Using curl Commands

**1. Health Check:**
```bash
curl "${BASE_URL:-http://localhost:3000}/api/health" | jq
```

**Expected**: Status should be `"healthy"`

**2. End-to-End Verification:**
```bash
curl -X POST "${BASE_URL:-http://localhost:3000}/api/verification/run" \
  -H "Content-Type: application/json" \
  ${VERIFY_TOKEN:+-H "x-verify-token: ${VERIFY_TOKEN}"} \
  -d '{"flow": "all", "tenantId": "'"${VERIFY_TENANT_ID:-}"'"}' | jq
```

**Expected**: `"summary": { "failed": 0 }`

**Note**:
- By default this requires authentication (session cookie).
- In development, you can run it unattended by setting `VERIFY_TOKEN` and `VERIFY_TENANT_ID` and sending `x-verify-token`.
- In production, SKU canaries can run unattended using `CANARY_TOKEN` + `x-canary-token` (see below).

### Production Canary (recommended)

Run the production canary checks against production:

```bash
BASE_URL=https://www.holdwall.com CANARY_TOKEN='<from Vercel env>' npm run verify:canary
```

**Notes**:
- `CANARY_TOKEN` is **production-only** and is used to authenticate SKU verification runs safely.
- The canary path is restricted to `flow` in `sku-a|sku-b|sku-c|sku-d`, with tenant scoping and optional IP allowlisting (`CANARY_IP_ALLOWLIST`).
- `VERIFY_TOKEN` is **development-only** (unattended local runs).

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

### Kafka Runtime Verification (`npm run verify:kafka`)
- ✅ Broker connectivity + topic metadata
- ✅ Consumer group offsets and approximate lag (best-effort)
- ✅ DLQ topic backlog check (optional)

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
  "summary": {
    "total": 3,
    "passed": 3,
    "failed": 0,
    "warnings": 0
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
3. In development, set `VERIFY_TOKEN` and pass `x-verify-token`
4. Or use the health check which doesn't require auth

### Database Not Connected
```bash
# Start PostgreSQL
docker-compose up -d postgres
```

### Redis Not Available
Redis is optional - the system will use in-memory fallback automatically.

## 📚 More Information

For operational and deployment context, start at `docs/README.md`.

## ✅ Quick Checklist

- [ ] Server running (`npm run dev`)
- [ ] Health check passes (`npm run verify:health`)
- [ ] End-to-end verification passes (`npm run verify:flows`)
- [ ] All tests pass (`npm run test`)

If all checks pass, your system is **100% verified and ready**! 🎉
