# Real-World Testing Guide for Holdwall POS

This guide provides **realistic, scenario-based testing approaches** for each major section of Holdwall POS, based on actual customer use cases and production scenarios.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Authentication & Authorization](#authentication--authorization)
3. [Signal Ingestion & Processing](#signal-ingestion--processing)
4. [Evidence Vault & Provenance](#evidence-vault--provenance)
5. [Claim Extraction & Clustering](#claim-extraction--clustering)
6. [Belief Graph Engineering (BGE)](#belief-graph-engineering-bge)
7. [Narrative Outbreak Forecasting](#narrative-outbreak-forecasting)
8. [AI Answer Authority Layer (AAAL)](#ai-answer-authority-layer-aaal)
9. [POS Components (BGE, CH, AAAL, NPE, TSM, DFD)](#pos-components)
10. [Governance & Approvals](#governance--approvals)
11. [Publishing & Distribution (PADL)](#publishing--distribution-padl)
12. [SKU-Specific Testing](#sku-specific-testing)
13. [AI Systems (CRAG, Routing, Retrieval)](#ai-systems)
14. [Performance & Scalability](#performance--scalability)
15. [Security & Compliance](#security--compliance)

---

## Testing Philosophy

### Real-World Testing Principles

1. **Scenario-Based**: Test complete workflows, not isolated functions
2. **Data-Driven**: Use realistic data that mirrors production patterns
3. **Failure Cases**: Test edge cases, errors, and adversarial scenarios
4. **Time-Based**: Test with realistic time delays, rate limits, and async operations
5. **Multi-Tenant**: Test isolation, data segregation, and tenant-specific behavior
6. **Observability**: Verify metrics, logs, and traces are captured correctly

### Test Data Strategy

- **Golden Sets**: Maintain curated test datasets for regression testing
- **Synthetic Data**: Generate realistic but anonymized data for load testing
- **Production Snapshots**: Use anonymized production data for integration tests
- **Adversarial Examples**: Include malicious inputs, edge cases, and attack patterns

---

## Authentication & Authorization

### Real-World Scenarios

#### Scenario 1: New User Onboarding Flow
**Test**: Complete signup → email verification → first login → onboarding

```typescript
// E2E Test Flow
1. User visits /auth/signup
2. Fills form with valid email/password
3. Receives verification email (mock or test email service)
4. Clicks verification link
5. Redirected to onboarding
6. Completes SKU selection (A/B/C)
7. Connects first 3-5 data sources
8. Defines risk policy
9. Runs first Perception Brief
10. Verifies session persists across page reloads
```

**What to Verify**:
- ✅ User created in database with correct tenant_id
- ✅ Email verification token generated and validated
- ✅ Session cookie set correctly
- ✅ Onboarding state tracked
- ✅ RBAC permissions assigned based on role

#### Scenario 2: Multi-User Collaboration
**Test**: Multiple users in same tenant with different roles

```typescript
// Test Setup
- Tenant: "acme-corp"
- Users:
  - admin@acme.com (Admin role)
  - comms@acme.com (Comms role, can draft artifacts)
  - legal@acme.com (Legal role, can approve)
  - analyst@acme.com (Viewer role, read-only)

// Test Flow
1. Analyst creates draft artifact → should fail (no permission)
2. Comms creates draft artifact → should succeed
3. Legal approves artifact → should succeed
4. Admin publishes artifact → should succeed
5. Analyst views published artifact → should succeed
```

**What to Verify**:
- ✅ RBAC enforced at API level
- ✅ UI shows/hides actions based on permissions
- ✅ Audit trail captures who did what
- ✅ Cross-tenant data isolation (user from tenant-2 can't see tenant-1 data)

#### Scenario 3: Session Expiration & Refresh
**Test**: Long-running sessions, token refresh, concurrent logins

```typescript
// Test Flow
1. User signs in
2. Session expires after configured timeout
3. User makes API request → should get 401
4. Frontend detects 401 → refreshes token automatically
5. Request retried → should succeed
6. User opens app in second browser tab
7. User signs out in tab 1
8. Tab 2 should detect logout → redirect to signin
```

**What to Verify**:
- ✅ Token refresh works seamlessly
- ✅ Concurrent sessions handled correctly
- ✅ Logout invalidates all sessions
- ✅ Security: expired tokens rejected

---

## Signal Ingestion & Processing

### Real-World Scenarios

#### Scenario 1: Reddit Post About "Hidden Fees"
**Test**: Real complaint from social media → evidence → claim extraction

```typescript
// Test Data
const redditSignal = {
  source: {
    type: "reddit",
    id: "r/complaints/abc123",
    url: "https://reddit.com/r/complaints/comments/abc123",
    author: "user123",
    subreddit: "complaints",
    timestamp: "2026-01-21T10:00:00Z"
  },
  content: {
    raw: "I've been using AcmeBank for 6 months and just discovered they've been charging me $5/month 'account maintenance fee' that was never mentioned when I signed up. This is a scam!",
    normalized: "I've been using AcmeBank for 6 months and just discovered they've been charging me $5/month 'account maintenance fee' that was never mentioned when I signed up. This is a scam!",
    language: "en",
    sentiment: -0.8
  },
  metadata: {
    upvotes: 45,
    comments: 12,
    engagement_score: 0.6
  }
};

// Test Flow
1. POST /api/signals with redditSignal
2. Verify evidence created with correct provenance
3. Verify PII redaction (if applicable)
4. Verify claim extraction identifies:
   - Primary claim: "hidden fees"
   - Sub-claims: "not disclosed", "scam"
   - Entities: "AcmeBank", "$5/month"
5. Verify signal appears in /signals page
6. Verify signal can be linked to existing cluster
```

**What to Verify**:
- ✅ Evidence stored with immutable hash
- ✅ Source metadata preserved
- ✅ Claim extraction accuracy (use golden set)
- ✅ Language detection correct
- ✅ Sentiment scoring reasonable
- ✅ PII redaction works (if enabled)

#### Scenario 2: Support Ticket Import (Zendesk)
**Test**: Bulk import from support system → clustering → triage

```typescript
// Test Data: 50 support tickets about "refund issues"
const tickets = Array.from({ length: 50 }, (_, i) => ({
  source: {
    type: "zendesk",
    id: `ticket-${i}`,
    url: `https://acme.zendesk.com/tickets/${i}`,
    created_at: new Date(Date.now() - i * 3600000).toISOString()
  },
  content: {
    raw: `Customer ${i} requesting refund for order #${1000 + i}. Says they never received product.`,
    normalized: `Customer requesting refund for order. Says they never received product.`,
    language: "en"
  },
  metadata: {
    priority: i % 3 === 0 ? "high" : "normal",
    status: "open",
    assignee: "support-team"
  }
}));

// Test Flow
1. POST /api/integrations/connectors (create Zendesk connector)
2. POST /api/integrations/{id}/sync (trigger sync)
3. Wait for async processing
4. GET /api/signals?source=zendesk → verify 50 signals
5. GET /api/claims/clusters?claim_text=refund → verify clustering
6. Verify cluster shows:
   - 50 related signals
   - Primary claim: "refund request"
   - Common sub-claims: "never received", "missing product"
7. Verify triage recommendations generated
```

**What to Verify**:
- ✅ Bulk ingestion handles rate limits
- ✅ Clustering groups related tickets correctly
- ✅ Deduplication works (same ticket synced twice)
- ✅ Async processing completes successfully
- ✅ Error handling for failed tickets

#### Scenario 3: Real-Time Signal Stream
**Test**: WebSocket/SSE stream of incoming signals

```typescript
// Test Flow
1. Connect to /api/signals/stream (SSE or WebSocket)
2. In another process, POST 10 signals rapidly
3. Verify stream receives all 10 signals in order
4. Verify stream includes:
   - signal_id
   - evidence_id
   - extracted_claims
   - cluster_suggestions
5. Verify stream handles reconnection (disconnect → reconnect)
6. Verify stream respects tenant isolation
```

**What to Verify**:
- ✅ Real-time delivery (< 1 second latency)
- ✅ Ordering preserved
- ✅ Reconnection works
- ✅ Tenant isolation enforced
- ✅ Backpressure handled (slow consumer)

---

## Evidence Vault & Provenance

### Real-World Scenarios

#### Scenario 1: Evidence Bundle Creation for Legal Case
**Test**: Collect evidence → create Merkle bundle → export for legal

```typescript
// Test Flow
1. Create 20 evidence items (signals, documents, screenshots)
2. POST /api/evidence/merkle with evidence_ids
3. Verify Merkle tree created correctly
4. Verify root hash is deterministic
5. GET /api/governance/audit-bundle?incident_id=xyz
6. Verify bundle includes:
   - All evidence items
   - Provenance chain (who created, when, from what source)
   - Merkle proof for each item
   - Policy compliance checks
7. Export bundle as JSON + C2PA manifest
8. Verify third-party can validate bundle integrity
```

**What to Verify**:
- ✅ Merkle tree construction correct
- ✅ Root hash changes if any evidence modified
- ✅ Provenance chain complete and verifiable
- ✅ C2PA manifest valid (if enabled)
- ✅ Export format matches legal requirements

#### Scenario 2: Evidence Linking & Verification
**Test**: Link evidence to claims → verify relationships

```typescript
// Test Flow
1. Create evidence: "Screenshot of email from customer@example.com"
2. Create claim: "Customer reported billing error"
3. POST /api/evidence/{id}/link with claim_id
4. Verify link created in database
5. GET /api/claims/{id}/evidence → verify evidence appears
6. Create conflicting evidence: "Bank statement shows correct charge"
7. Link to same claim
8. Verify system detects conflict
9. Verify verification score calculated (supporting vs conflicting)
```

**What to Verify**:
- ✅ Evidence-claim links bidirectional
- ✅ Conflict detection works
- ✅ Verification scores accurate
- ✅ Graph updates reflect new links

---

## Claim Extraction & Clustering

### Real-World Scenarios

#### Scenario 1: "Scam" Narrative Cluster
**Test**: Multiple signals about "scam" → cluster → analyze decisiveness

```typescript
// Test Data: 100 signals with variations of "scam" claim
const scamSignals = [
  "This company is a scam, they stole my money",
  "Scam alert: don't use this service",
  "I got scammed by hidden fees",
  "Total scam, avoid at all costs",
  // ... 96 more variations
];

// Test Flow
1. Ingest all 100 signals
2. Wait for claim extraction pipeline
3. GET /api/claims/clusters?claim_text=scam
4. Verify cluster created with:
   - Primary claim: "scam"
   - Sub-claims: ["stole money", "hidden fees", "avoid"]
   - Decisiveness score > 0.7 (high decisiveness)
   - Velocity: rising (many signals in short time)
5. GET /api/claim-clusters/top?sort=decisiveness
6. Verify "scam" cluster appears in top 5
7. GET /api/graph/snapshot?cluster_id={id}
8. Verify belief graph shows cluster as high-importance node
```

**What to Verify**:
- ✅ Clustering groups semantically similar claims
- ✅ Decisiveness scoring accurate
- ✅ Velocity calculation correct
- ✅ Graph integration works

#### Scenario 2: Claim Verification Against Evidence
**Test**: Verify claim "data breach" against evidence vault

```typescript
// Test Flow
1. Create claim: "Company had a data breach in December 2025"
2. Search evidence vault for:
   - Security incident reports
   - Public disclosures
   - News articles
   - Internal logs
3. POST /api/claims/{id}/verify
4. Verify system:
   - Finds supporting evidence (if exists)
   - Finds conflicting evidence (if exists)
   - Calculates verification score
   - Flags if unverified
5. If unverified, verify recommendation: "Gather more evidence"
```

**What to Verify**:
- ✅ Evidence search finds relevant items
- ✅ Verification logic correct
- ✅ Recommendations actionable
- ✅ Audit trail captures verification attempt

---

## Belief Graph Engineering (BGE)

### Real-World Scenarios

#### Scenario 1: Weak Node Detection & Neutralization
**Test**: Negative review becomes weak node → structural irrelevance

```typescript
// Test Flow
1. Create 1000 positive signals (trust score > 0.7)
2. Create 10 negative signals (trust score < 0.3)
3. Execute BGE cycle: POST /api/pos/belief-graph?action=detect-weak-nodes
4. Verify:
   - 10 negative signals identified as weak nodes
   - Structural irrelevance score calculated (should be high for isolated negatives)
   - Decay edges created automatically
   - Graph shows negatives as peripheral nodes
5. GET /api/pos/belief-graph?action=metrics
6. Verify BGE score improved (negatives neutralized)
```

**What to Verify**:
- ✅ Weak node detection algorithm correct
- ✅ Structural irrelevance scoring accurate
- ✅ Graph structure reflects neutralization
- ✅ Metrics show improvement

#### Scenario 2: Narrative Activation Tracking
**Test**: Track how narrative spreads through graph

```typescript
// Test Flow
1. Create initial claim: "Product has bug X"
2. Create 50 signals reinforcing claim
3. Execute graph update
4. GET /api/graph/paths?from_node={initial_claim}&depth=3
5. Verify paths show:
   - How claim connected to other nodes
   - Reinforcement edges (supporting evidence)
   - Contradiction edges (refuting evidence)
   - Activation score (how "alive" the narrative is)
6. Add 100 more supporting signals
7. Re-run graph analysis
8. Verify activation score increased
```

**What to Verify**:
- ✅ Path finding algorithm correct
- ✅ Activation scoring reflects reality
- ✅ Graph updates in real-time
- ✅ Performance acceptable (< 2s for 10k nodes)

---

## Narrative Outbreak Forecasting

### Real-World Scenarios

#### Scenario 1: Hawkes Process Outbreak Prediction
**Test**: Predict "hidden fees" narrative outbreak

```typescript
// Test Data: Historical signal timeline
const historicalSignals = [
  { timestamp: "2026-01-01T00:00:00Z", claim: "hidden fees", amplification: 0.1 },
  { timestamp: "2026-01-02T12:00:00Z", claim: "hidden fees", amplification: 0.2 },
  { timestamp: "2026-01-03T18:00:00Z", claim: "hidden fees", amplification: 0.5 },
  // ... more signals with increasing amplification
];

// Test Flow
1. POST /api/forecasts/run with:
   - type: "OUTBREAK"
   - horizon_days: 7
   - cluster_id: "hidden-fees-cluster"
2. Verify forecast includes:
   - Baseline intensity (μ)
   - Excitation parameters (αᵢ)
   - Decay parameter (β)
   - Outbreak probability for next 7 days
3. Verify forecast confidence interval
4. Simulate intervention: POST /api/forecasts/intervention
   - action: "publish_rebuttal"
   - artifact_id: "rebuttal-123"
5. Verify forecast updates (outbreak probability should decrease)
```

**What to Verify**:
- ✅ Hawkes model parameters estimated correctly
- ✅ Outbreak probability calibrated (use historical validation)
- ✅ Intervention simulation accurate
- ✅ Forecast updates in real-time

#### Scenario 2: Forecast Accuracy Validation
**Test**: Compare forecast vs actual outcomes

```typescript
// Test Flow
1. Create forecast on day 0: "Outbreak probability 0.7 in next 7 days"
2. Wait 7 days (or simulate with test data)
3. GET /api/forecasts/accuracy?forecast_id={id}
4. Verify accuracy metrics:
   - Did outbreak actually occur? (binary)
   - Actual vs predicted intensity
   - Calibration score (Brier score)
5. Verify system learns from errors (if ML model)
```

**What to Verify**:
- ✅ Accuracy tracking works
- ✅ Calibration improves over time
- ✅ Forecasts are actionable (not just accurate)

---

## AI Answer Authority Layer (AAAL)

### Real-World Scenarios

#### Scenario 1: Create Rebuttal Artifact for "Scam" Claim
**Test**: Generate AI-citable artifact → publish → measure citation

```typescript
// Test Flow
1. Identify cluster: "scam" narrative (50 signals)
2. POST /api/pos/aaal with:
   - cluster_id: "scam-cluster"
   - type: "REBUTTAL"
   - evidence_ids: [evidence-1, evidence-2, ...]
3. Verify artifact generated includes:
   - Structured JSON-LD markup
   - Clear claim statement
   - Evidence citations
   - Transparent metrics (refund rate, customer satisfaction)
4. POST /api/aaal/check-policies → verify passes policy checks
5. POST /api/approvals (legal approves)
6. POST /api/aaal/publish
7. Verify artifact published to:
   - Public trust center
   - Knowledge base
   - Structured data (for AI indexing)
8. Wait 24 hours
9. GET /api/ai-answer-monitor?query=is+acme+bank+a+scam
10. Verify AI answers cite the artifact (if monitoring enabled)
```

**What to Verify**:
- ✅ Artifact structure correct (JSON-LD valid)
- ✅ Evidence citations accurate
- ✅ Policy checks enforced
- ✅ Publishing works
- ✅ Citation tracking (if monitoring enabled)

#### Scenario 2: AI Citation Score Improvement
**Test**: Measure before/after citation rates

```typescript
// Test Flow
1. Baseline: GET /api/pos/aaal?action=metrics
   - Record current AI citation score (e.g., 0.3)
2. Create and publish 10 high-quality artifacts
3. Wait 7 days (or simulate)
4. Re-measure: GET /api/pos/aaal?action=metrics
5. Verify citation score improved (e.g., 0.6)
6. Verify metrics show:
   - Number of queries where artifact cited
   - Sentiment shift in AI answers
   - Coverage (percentage of claims with artifacts)
```

**What to Verify**:
- ✅ Citation tracking accurate
- ✅ Score calculation correct
- ✅ Improvement measurable
- ✅ Metrics actionable

---

## POS Components

### Real-World Scenarios

#### Scenario 1: Complete POS Cycle Execution
**Test**: Run full POS cycle → verify all components execute

```typescript
// Test Flow
1. Setup: Create test data (signals, claims, evidence)
2. POST /api/pos/orchestrator with action: "execute-cycle"
3. Verify cycle executes:
   - BGE: Weak nodes detected and neutralized
   - CH: Consensus signals created
   - AAAL: Artifacts generated for high-priority claims
   - NPE: Preemptive actions identified
   - TSM: Trust assets mapped to gaps
   - DFD: Decision funnel checkpoints updated
4. GET /api/pos/orchestrator?action=metrics
5. Verify overall POS score improved
6. GET /api/pos/orchestrator?action=recommendations
7. Verify recommendations are actionable
```

**What to Verify**:
- ✅ All components execute in correct order
- ✅ Metrics updated correctly
- ✅ Recommendations relevant
- ✅ Performance acceptable (< 30s for full cycle)
- ✅ Error handling (if one component fails)

#### Scenario 2: Consensus Hijacking (CH)
**Test**: Create third-party consensus signals

```typescript
// Test Flow
1. Create claim cluster: "Product is unreliable"
2. POST /api/pos/consensus with:
   - cluster_id: "unreliable-cluster"
   - third_party_sources: [
       { type: "expert_review", content: "Industry analysis shows 99% uptime" },
       { type: "comparative_research", content: "Better than competitors" },
       { type: "audit_report", content: "SOC 2 certified" }
     ]
3. Verify consensus summary generated:
   - "Some complaints exist, but overall consensus indicates high reliability"
4. Verify consensus signals linked to cluster
5. GET /api/graph/snapshot?cluster_id={id}
6. Verify graph shows consensus nodes connected
```

**What to Verify**:
- ✅ Consensus signals created correctly
- ✅ Summary generation accurate
- ✅ Graph integration works
- ✅ Trust substitution score improves

---

## Governance & Approvals

### Real-World Scenarios

#### Scenario 1: Multi-Stage Approval Workflow
**Test**: Draft → Legal Review → Exec Approval → Publish

```typescript
// Test Flow
1. Comms user creates artifact draft
2. POST /api/approvals with:
   - artifact_id: "draft-123"
   - requested_by: "comms@acme.com"
   - approval_type: "PUBLISH"
3. Verify artifact status: "PENDING_LEGAL"
4. Legal user reviews: GET /api/approvals?status=pending
5. Legal approves: POST /api/approvals/{id}/approve
6. Verify artifact status: "PENDING_EXEC"
7. Exec approves: POST /api/approvals/{id}/approve
8. Verify artifact status: "APPROVED"
9. Verify artifact can now be published
10. GET /api/governance/audit-bundle?artifact_id=draft-123
11. Verify audit trail includes all approvals
```

**What to Verify**:
- ✅ Approval workflow enforced
- ✅ RBAC permissions checked
- ✅ Status transitions correct
- ✅ Audit trail complete
- ✅ Notifications sent (if enabled)

#### Scenario 2: Policy Violation Detection
**Test**: Attempt to publish artifact that violates policy

```typescript
// Test Flow
1. Create artifact with:
   - Unverified claims
   - Missing evidence citations
   - Prohibited language (if policy defined)
2. POST /api/aaal/check-policies with artifact_id
3. Verify policy check fails with:
   - List of violations
   - Required fixes
4. Fix violations (add evidence, verify claims)
5. Re-run policy check
6. Verify passes
```

**What to Verify**:
- ✅ Policy engine works correctly
- ✅ Violations detected accurately
- ✅ Error messages actionable
- ✅ Fixes can be applied

---

## Publishing & Distribution (PADL)

### Real-World Scenarios

#### Scenario 1: Publish Artifact to Multiple Channels
**Test**: Single artifact → multiple destinations

```typescript
// Test Flow
1. Create approved artifact
2. POST /api/aaal/publish with:
   - artifact_id: "artifact-123"
   - channels: ["trust_center", "knowledge_base", "press_release", "structured_data"]
3. Verify artifact published to:
   - Public trust center (HTML page)
   - Knowledge base (searchable)
   - Press release (formatted)
   - Structured data (JSON-LD for AI)
4. Verify C2PA manifest attached (if enabled)
5. Verify URLs generated correctly
6. GET /api/padl/artifact-123 → verify accessible
```

**What to Verify**:
- ✅ All channels receive artifact
- ✅ Formatting correct per channel
- ✅ URLs work
- ✅ C2PA manifest valid (if enabled)
- ✅ Performance acceptable

#### Scenario 2: Version Control & Rollback
**Test**: Publish v1 → update to v2 → rollback to v1

```typescript
// Test Flow
1. Publish artifact v1
2. Update artifact content
3. Publish artifact v2
4. Verify v2 is live
5. GET /api/aaal/{id}/versions → verify both versions stored
6. Rollback: POST /api/aaal/{id}/rollback?version=1
7. Verify v1 is live again
8. Verify audit trail shows rollback
```

**What to Verify**:
- ✅ Versioning works
- ✅ Rollback successful
- ✅ Audit trail complete
- ✅ No data loss

---

## SKU-Specific Testing

### SKU A: AI Answer Monitoring & Authority

#### Scenario: Monitor AI Answers for "Is Acme Bank a Scam?"
```typescript
// Test Flow
1. Setup: Enable AI answer monitoring
2. Create claim cluster: "scam" (100 signals)
3. Create authoritative artifact with rebuttal
4. Publish artifact
5. POST /api/ai-answer-monitor/query with:
   - query: "is acme bank a scam"
   - providers: ["openai", "anthropic", "google"]
6. Wait for monitoring cycle (or trigger manually)
7. GET /api/ai-answer-monitor/results?query_id={id}
8. Verify results show:
   - Which AI providers cited the artifact
   - Answer sentiment (before/after)
   - Citation rate improvement
9. Verify dashboard shows metrics
```

**What to Verify**:
- ✅ Monitoring captures AI answers
- ✅ Citation detection works
- ✅ Metrics accurate
- ✅ Dashboard updates

### SKU B: Narrative Risk Early Warning

#### Scenario: Detect and Preempt "Data Breach" Narrative
```typescript
// Test Flow
1. Setup: Configure outbreak thresholds
2. Ingest 20 signals about "data breach" in 2 hours
3. Verify system detects:
   - Rising velocity
   - High amplification
   - Outbreak probability > 0.7
4. Verify preemption playbook triggered:
   - Artifact draft generated
   - Legal notified
   - Exec brief created
5. Execute playbook: POST /api/financial-services/preemption/execute
6. Verify artifact published within SLA (e.g., 4 hours)
7. Verify outbreak probability decreases
```

**What to Verify**:
- ✅ Detection works (false positives/negatives)
- ✅ Playbook execution correct
- ✅ SLA met
- ✅ Outbreak prevented (or mitigated)

### SKU C: Evidence-Backed Intake & Case Triage

#### Scenario: Legal Case Intake Workflow
```typescript
// Test Flow
1. Receive allegation: "Customer claims unauthorized charge"
2. POST /api/evidence with allegation details
3. Verify evidence bundle created
4. POST /api/claims/cluster with evidence_ids
5. Verify claim extracted: "unauthorized charge"
6. System searches evidence vault for:
   - Transaction logs
   - Customer communication
   - Policy documents
7. Verify verification score calculated
8. POST /api/financial-services/audit-export with case_id
9. Verify export includes:
   - Complete evidence bundle
   - Merkle proof
   - Provenance chain
   - Verification report
10. Export to downstream system (Litify/Clio) → verify format
```

**What to Verify**:
- ✅ Intake workflow complete
- ✅ Evidence linking accurate
- ✅ Verification scores correct
- ✅ Export format compatible
- ✅ Cycle time reduced (measure before/after)

---

## AI Systems

### Real-World Scenarios

#### Scenario 1: CRAG (Corrective RAG) Retrieval
**Test**: Low-quality retrieval → critique → re-retrieve

```typescript
// Test Flow
1. Setup: Evidence vault with 1000 items
2. Query: "What do customers say about hidden fees?"
3. POST /api/ai/crag with query
4. Verify CRAG process:
   - Initial retrieval (BM25 + embeddings)
   - Rerank (cross-encoder)
   - Critique: "Are retrieved items relevant?"
   - If low confidence → query rewrite
   - Re-retrieve with improved query
5. Verify final answer:
   - Citations accurate
   - Grounded in evidence
   - No hallucinations
6. Compare vs standard RAG (should be better)
```

**What to Verify**:
- ✅ Critique step works
- ✅ Query rewrite improves results
- ✅ Final answer quality better than standard RAG
- ✅ Performance acceptable (latency)

#### Scenario 2: Learned Routing (RouteLLM)
**Test**: Router chooses cheap vs expensive model

```typescript
// Test Flow
1. Setup: Train router on preference data (or use pre-trained)
2. Send 100 queries of varying complexity:
   - Simple: "What is the refund policy?"
   - Complex: "Analyze sentiment trends for Q4 2025"
3. POST /api/ai/orchestrate with queries
4. Verify router decisions:
   - Simple queries → fast/cheap model (e.g., GPT-3.5)
   - Complex queries → strong model (e.g., GPT-4)
5. Verify quality maintained (use golden set)
6. Verify cost reduced vs always using GPT-4
7. GET /api/traces?task=orchestrate → verify routing logged
```

**What to Verify**:
- ✅ Router makes correct decisions
- ✅ Quality maintained
- ✅ Cost reduced
- ✅ Observability works (routing logged)

---

## Performance & Scalability

### Real-World Scenarios

#### Scenario 1: High-Volume Signal Ingestion
**Test**: 10,000 signals in 1 hour

```typescript
// Test Flow
1. Generate 10,000 test signals
2. POST /api/signals (bulk endpoint) or use connector sync
3. Monitor:
   - Ingestion rate (signals/second)
   - Processing latency (time to evidence creation)
   - Queue depth
   - Error rate
4. Verify:
   - All signals processed (no drops)
   - Latency < 5 seconds per signal
   - System remains responsive
   - No memory leaks
5. Verify database performance:
   - Query time for /api/signals < 1 second
   - Index usage optimal
```

**What to Verify**:
- ✅ Throughput meets requirements
- ✅ Latency acceptable
- ✅ No data loss
- ✅ System stable under load

#### Scenario 2: Concurrent User Load
**Test**: 100 users using dashboard simultaneously

```typescript
// Test Flow
1. Setup: 100 authenticated sessions
2. Simulate user actions:
   - 50 users viewing /overview
   - 30 users viewing /signals
   - 20 users creating artifacts
3. Monitor:
   - API response times (should stay < 2s)
   - Database connection pool
   - Cache hit rates
   - Error rates
4. Verify:
   - No timeouts
   - No race conditions
   - Data consistency maintained
   - Tenant isolation preserved
```

**What to Verify**:
- ✅ System handles concurrent load
- ✅ Response times acceptable
- ✅ No race conditions
- ✅ Tenant isolation works

---

## Security & Compliance

### Real-World Scenarios

#### Scenario 1: Adversarial Narrative Attack
**Test**: Malicious actor floods system with fake signals

```typescript
// Test Flow
1. Attacker creates 1000 fake signals:
   - Same content (coordinate posting)
   - Synthetic accounts
   - Rapid posting (bot-like)
2. System should detect:
   - Coordinated posting patterns
   - Synthetic account signals
   - Rate limiting violations
3. Verify system:
   - Flags suspicious signals
   - Does not cluster fake signals with real ones
   - Alerts security team
   - Maintains data quality
```

**What to Verify**:
- ✅ Attack detection works
- ✅ Fake signals don't pollute clusters
- ✅ Alerts triggered
- ✅ System remains functional

#### Scenario 2: GDPR Data Export & Deletion
**Test**: User requests data export → deletion

```typescript
// Test Flow
1. User requests GDPR export: POST /api/compliance/gdpr/export
2. Verify export includes:
   - All user's personal data
   - Evidence items they created
   - Audit logs
   - Complete and accurate
3. User requests deletion: POST /api/compliance/gdpr/delete
4. Verify:
   - Personal data deleted
   - Anonymization applied (if data must be retained)
   - Audit trail preserved (anonymized)
   - System continues to function
```

**What to Verify**:
- ✅ Export complete and accurate
- ✅ Deletion works correctly
- ✅ Anonymization applied where needed
- ✅ System remains functional

---

## Test Execution Strategy

### Recommended Test Execution Order

1. **Unit Tests** (fast, isolated)
   - Run on every commit
   - Target: < 5 minutes
   - Coverage: > 80%

2. **Integration Tests** (API + database)
   - Run on PR
   - Target: < 15 minutes
   - Test critical paths

3. **E2E Tests** (full user journeys)
   - Run on PR and main branch
   - Target: < 30 minutes
   - Test happy paths + critical failures

4. **Load Tests** (performance)
   - Run nightly or on demand
   - Target: < 1 hour
   - Test scalability limits

5. **Security Tests** (vulnerabilities)
   - Run weekly or on demand
   - Test attack scenarios

6. **Evaluation Tests** (AI quality)
   - Run on PR (AI changes) or weekly
   - Test against golden sets
   - Check for regressions

### Test Data Management

- **Golden Sets**: Curated test data for regression testing
- **Synthetic Data**: Generated realistic data for load testing
- **Production Snapshots**: Anonymized production data for integration tests
- **Adversarial Examples**: Attack patterns and edge cases

### Continuous Improvement

- **Monitor Test Flakiness**: Track and fix flaky tests
- **Update Golden Sets**: Add new scenarios as they occur in production
- **Performance Baselines**: Track and alert on performance regressions
- **Coverage Gaps**: Identify and fill coverage gaps

---

## Quick Reference: Test Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test __tests__/e2e/critical-journeys.test.ts

# Run with UI (debugging)
npm run test:e2e:ui

# Run load tests
npm run test:load

# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run evaluation tests
npm run test:eval
```

---

## Conclusion

This guide provides **realistic, scenario-based testing approaches** for each section of Holdwall POS. Use these scenarios as:

1. **Test Templates**: Adapt to your specific use cases
2. **Coverage Checklist**: Ensure all sections are tested
3. **Regression Prevention**: Add to CI/CD pipeline
4. **Documentation**: Share with team for understanding

Remember: **Real-world testing is about simulating actual customer workflows, not just checking API responses**. Focus on end-to-end scenarios that mirror how customers actually use the system.
