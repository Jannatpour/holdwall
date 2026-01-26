# Real-World Enhancements Integration Guide

## Quick Start

### 1. Run Database Migration

```bash
npx prisma migrate dev --name add_idempotency_key
```

### 2. Update Signal Ingestion API

**File**: `app/api/signals/route.ts`

```typescript
import { SignalIngestionService } from "@/lib/signals/ingestion";
import { IdempotencyService } from "@/lib/operations/idempotency";
import { ErrorRecoveryService } from "@/lib/operations/error-recovery";

// Initialize services
const idempotencyService = new IdempotencyService();
const errorRecovery = new ErrorRecoveryService();
const ingestionService = new SignalIngestionService(
  evidenceVault,
  eventStore,
  idempotencyService,
  errorRecovery
);

// Use production service in POST handler
const evidenceId = await ingestionService.ingestSignal(signal, connector);
```

### 3. Update Claim Creation API

**File**: `app/api/claims/route.ts`

```typescript
import { validateBusinessRules } from "@/lib/validation/business-rules";
import { withIdempotency } from "@/lib/operations/idempotency";
import { TransactionManager } from "@/lib/operations/transaction-manager";

const idempotencyService = new IdempotencyService();
const transactionManager = new TransactionManager();

// In POST handler:
// 1. Validate
const validation = await validateBusinessRules("claim", {
  text: claimText,
  evidenceIds,
}, tenantId);

if (!validation.valid) {
  return NextResponse.json(
    { error: "Validation failed", details: validation.errors },
    { status: 400 }
  );
}

// 2. Execute with idempotency
const claim = await withIdempotency(
  idempotencyService,
  tenantId,
  "create_claim",
  { text: claimText, evidenceIds },
  async () => {
    return await transactionManager.executeSimple(async (tx) => {
      // Create claim in transaction
      return await tx.claim.create({ data: claimData });
    });
  }
);
```

### 4. Update Artifact Creation API

**File**: `app/api/aaal/route.ts`

```typescript
import { validateBusinessRules } from "@/lib/validation/business-rules";
import { withIdempotency } from "@/lib/operations/idempotency";

// In POST handler:
const validation = await validateBusinessRules("artifact", {
  content: artifactContent,
  type: artifactType,
  citations: citations,
}, tenantId);

if (!validation.valid) {
  return NextResponse.json(
    { error: "Validation failed", details: validation.errors },
    { status: 400 }
  );
}

const artifact = await withIdempotency(
  idempotencyService,
  tenantId,
  "create_artifact",
  { content: artifactContent, type: artifactType },
  async () => {
    return await createArtifact(artifactData);
  }
);
```

## Benefits

### Before Enhancements
- ❌ Duplicate processing on retries
- ❌ Invalid data can enter system
- ❌ Partial failures leave inconsistent state
- ❌ No recovery from transient failures
- ❌ No protection against concurrent requests

### After Enhancements
- ✅ Idempotency prevents duplicates
- ✅ Validation ensures data quality
- ✅ Transactions ensure consistency
- ✅ Error recovery handles failures
- ✅ Circuit breakers prevent overload

## Monitoring

Add metrics for:
- Idempotency hit rate
- Validation failure rate
- Transaction rollback rate
- Error recovery attempts
- Circuit breaker state changes

## Testing

Test scenarios:
1. Duplicate request handling (idempotency)
2. Invalid data rejection (validation)
3. Partial failure recovery (transactions)
4. Network failure handling (error recovery)
5. Concurrent request handling (idempotency + transactions)
