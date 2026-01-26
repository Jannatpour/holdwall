# Compliance Acceptance Criteria

This document defines explicit acceptance criteria for all compliance controls, including inputs, expected outputs, audit artifacts, and immutable identifiers.

## GDPR Compliance (Articles 15, 20, 17)

### GDPR Data Access (Article 15 - Right of Access)

**Endpoint**: `GET /api/compliance/gdpr/access`

**Inputs**:
- Authenticated user session (userId from session)
- Tenant ID (from user's tenant)

**Expected Outputs**:
- `requestId`: Unique identifier for the access request
- `data.user`: User's personal data including:
  - `id`: User ID
  - `email`: User email address
  - `name`: User name
  - `role`: User role
  - `tenantId`: Tenant ID
- `data.tenantId`: Tenant identifier

**Audit Artifacts**:
- Event logged: `gdpr.access_requested` with:
  - `actor_id`: User ID
  - `tenant_id`: Tenant ID
  - `timestamp`: Request timestamp
  - `correlation_id`: Request ID

**Immutable Identifiers**:
- `requestId`: UUID v4, stored in audit log
- Event ID: UUID v4 for audit trail

**Acceptance Criteria**:
1. ✅ Request returns 200 status code
2. ✅ Response includes `requestId` and `data` fields
3. ✅ User data includes all required fields (id, email, name, role, tenantId)
4. ✅ Audit event is created with type `gdpr.access_requested`
5. ✅ Request completes within 2 seconds (SLO)

---

### GDPR Data Export (Article 20 - Right to Data Portability)

**Endpoint**: `GET /api/compliance/gdpr/export`

**Inputs**:
- Authenticated user session
- Tenant ID

**Expected Outputs**:
- `requestId`: Unique identifier for the export request
- `exportUrl`: URL where the export package can be downloaded
- `message`: Human-readable message about the export

**Audit Artifacts**:
- Event logged: `gdpr.export_requested` with:
  - `actor_id`: User ID
  - `tenant_id`: Tenant ID
  - `timestamp`: Request timestamp
  - `export_url`: Export package URL
- Export package includes:
  - User data (JSON)
  - Evidence references
  - Case data (if applicable)
  - Audit trail entries

**Immutable Identifiers**:
- `requestId`: UUID v4
- Export package ID: UUID v4
- Event ID: UUID v4 for audit trail

**Acceptance Criteria**:
1. ✅ Request returns 200 status code
2. ✅ Response includes `requestId` and `exportUrl`
3. ✅ Export URL is accessible and returns valid data package
4. ✅ Export package includes all user data in machine-readable format (JSON)
5. ✅ Audit event is created with type `gdpr.export_requested`
6. ✅ Export package generation completes within 30 seconds (SLO)

---

### GDPR Data Deletion (Article 17 - Right to Erasure)

**Endpoint**: `POST /api/compliance/gdpr/delete`

**Inputs**:
- Authenticated user session
- Tenant ID
- `anonymize`: Boolean (default: true) - whether to anonymize or delete

**Expected Outputs**:
- `success`: Boolean indicating operation success
- `requestId`: Unique identifier for the deletion request
- `status`: Status of the deletion ("anonymized" or "deleted")

**Audit Artifacts**:
- Event logged: `gdpr.deletion_requested` with:
  - `actor_id`: User ID
  - `tenant_id`: Tenant ID
  - `timestamp`: Request timestamp
  - `anonymize`: Whether data was anonymized or deleted
- If anonymized:
  - User email → `[anonymized-{hash}]@deleted.local`
  - User name → `[Anonymized User]`
  - Personal identifiers removed
- If deleted:
  - User record soft-deleted (marked as deleted, not physically removed)
  - Associated data marked for deletion

**Immutable Identifiers**:
- `requestId`: UUID v4
- Event ID: UUID v4 for audit trail
- Deletion record ID: UUID v4

**Acceptance Criteria**:
1. ✅ Request returns 200 status code
2. ✅ Response includes `success: true`, `requestId`, and `status`
3. ✅ If `anonymize: true`, user data is anonymized (email, name replaced)
4. ✅ If `anonymize: false`, user data is marked for deletion
5. ✅ Audit event is created with type `gdpr.deletion_requested`
6. ✅ Deletion/anonymization completes within 10 seconds (SLO)
7. ✅ User can no longer authenticate after deletion (if not anonymized)

---

## Audit Bundle Integrity

**Endpoint**: `GET /api/governance/audit-bundle`

**Inputs**:
- Authenticated user session
- Tenant ID
- Optional: `dateRange`, `evidenceIds`, `caseIds`

**Expected Outputs**:
- `bundleId`: Unique identifier for the audit bundle
- `timestamp`: Bundle generation timestamp
- `tenantId`: Tenant identifier
- `integrity`: Integrity metadata:
  - `algorithm`: Hash algorithm (e.g., "sha256")
  - `hash`: Bundle hash for integrity verification
- `evidence`: Evidence references included in bundle
- `events`: Audit events included in bundle
- `cases`: Case data included in bundle (if applicable)

**Audit Artifacts**:
- Bundle itself is an audit artifact
- Bundle includes:
  - Immutable evidence references
  - Event trail with timestamps
  - Case data with approval history
  - Integrity hash for verification

**Immutable Identifiers**:
- `bundleId`: UUID v4
- Evidence IDs: UUID v4 (immutable)
- Event IDs: UUID v4 (immutable)
- Case IDs: UUID v4 (immutable)

**Acceptance Criteria**:
1. ✅ Request returns 200 status code
2. ✅ Response includes `bundleId`, `timestamp`, `tenantId`, and `integrity`
3. ✅ Bundle includes all requested evidence, events, and cases
4. ✅ Integrity hash can be verified (re-compute hash matches stored hash)
5. ✅ Bundle generation completes within 60 seconds (SLO)
6. ✅ Bundle is downloadable in standard format (JSON or ZIP)
7. ✅ Bundle includes metadata about what was included and why

---

## Evidence Access Logging

**Endpoint**: `GET /api/evidence/access-log`

**Inputs**:
- Authenticated user session
- Tenant ID
- Optional: `evidenceId`, `userId`, `dateRange`

**Expected Outputs**:
- Array of access log entries, each containing:
  - `timestamp`: When access occurred
  - `evidenceId`: Evidence that was accessed
  - `userId`: User who accessed the evidence
  - `action`: Action type (e.g., "view", "download", "export")
  - `ipAddress`: IP address of requester (if available)
  - `userAgent`: User agent string (if available)

**Audit Artifacts**:
- Access log entries are immutable audit records
- Each entry includes:
  - Immutable timestamp
  - Evidence ID reference
  - User ID reference
  - Action type
  - Request metadata

**Immutable Identifiers**:
- Access log entry ID: UUID v4
- Evidence ID: UUID v4 (immutable)
- User ID: UUID v4 (immutable)

**Acceptance Criteria**:
1. ✅ Request returns 200 status code
2. ✅ Response is an array of access log entries
3. ✅ Each entry includes `timestamp`, `evidenceId`, `userId`, and `action`
4. ✅ Access log entries are immutable (cannot be modified or deleted)
5. ✅ Access log includes all evidence accesses for the tenant
6. ✅ Access log can be filtered by `evidenceId`, `userId`, or `dateRange`
7. ✅ Access log query completes within 2 seconds (SLO)
8. ✅ Access log entries are created automatically when evidence is accessed

---

## Verification

All compliance controls can be verified via the verification API:

```bash
# Verify all compliance promises
curl -X POST "${BASE_URL}/api/verification/run" \
  -H "Content-Type: application/json" \
  -H "x-verify-token: ${VERIFY_TOKEN}" \
  -d '{"flow": "compliance", "tenantId": "${TENANT_ID}"}'
```

**Expected Verification Results**:
- ✅ GDPR access: PASS
- ✅ GDPR export: PASS
- ✅ GDPR deletion: PASS
- ✅ Audit bundle integrity: PASS
- ✅ Access logging: PASS

All verification results include:
- Step-by-step verification details
- Pass/fail status for each control
- Duration metrics
- Any warnings or issues

---

## E2E Test Coverage

Compliance controls are verified via E2E tests in:
- `__tests__/e2e/compliance-journeys.test.ts`

These tests verify:
1. GDPR data access journey
2. GDPR data export journey
3. GDPR data deletion journey
4. Audit bundle generation and integrity
5. Evidence access logging

All tests use real API endpoints and verify actual behavior, not just structure.
