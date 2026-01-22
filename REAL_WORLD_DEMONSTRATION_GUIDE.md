# Real-World Demonstration Guide for Holdwall POS

This guide provides **complete, step-by-step demonstrations** for each section of Holdwall POS, showing how to use every feature with realistic data and scenarios.

## Table of Contents

1. [Demonstration Setup](#demonstration-setup)
2. [Section 1: Authentication & Onboarding](#section-1-authentication--onboarding)
3. [Section 2: Signal Ingestion & Processing](#section-2-signal-ingestion--processing)
4. [Section 3: Evidence Vault & Provenance](#section-3-evidence-vault--provenance)
5. [Section 4: Claim Extraction & Clustering](#section-4-claim-extraction--clustering)
6. [Section 5: Belief Graph Engineering](#section-5-belief-graph-engineering)
7. [Section 6: Narrative Outbreak Forecasting](#section-6-narrative-outbreak-forecasting)
8. [Section 7: AI Answer Authority Layer (AAAL)](#section-7-ai-answer-authority-layer-aaal)
9. [Section 8: POS Components](#section-8-pos-components)
10. [Section 9: Governance & Approvals](#section-9-governance--approvals)
11. [Section 10: Publishing & Distribution](#section-10-publishing--distribution)
12. [Section 11: SKU-Specific Demos](#section-11-sku-specific-demos)
13. [Section 12: AI Systems (CRAG, Routing)](#section-12-ai-systems-crag-routing)
14. [Complete End-to-End Scenarios](#complete-end-to-end-scenarios)

---

## Demonstration Setup

### Prerequisites

1. **Start the application:**
   ```bash
   npm run dev
   ```

2. **Seed demo data:**
   ```bash
   npm run db:seed
   npm run scripts/demo-data.ts  # (We'll create this)
   ```

3. **Create demo users:**
   ```bash
   npm run scripts/seed-test-users.ts
   ```

### Demo Data Structure

We'll create realistic demo data for:
- **AcmeBank** (Financial Services - SKU B)
- **TechCorp** (SaaS - SKU A)
- **HealthCare Inc** (Healthcare - SKU C)

---

## Section 1: Authentication & Onboarding

### Demo 1.1: New User Signup & Onboarding

**Goal:** Show complete user onboarding flow

**Steps:**

1. **Open browser to signup page:**
   ```
   http://localhost:3001/auth/signup
   ```

2. **Fill signup form:**
   - Name: "Sarah Johnson"
   - Email: "sarah@acmebank.com"
   - Password: "SecurePass123!"
   - Confirm Password: "SecurePass123!"

3. **Submit and verify:**
   - Should redirect to onboarding
   - Show onboarding wizard

4. **Complete onboarding:**
   - **Step 1: Choose SKU**
     - Select "SKU B: Narrative Risk Early Warning"
     - Explain: "We're a financial services company, so we need early warning for narrative outbreaks"
   
   - **Step 2: Connect Data Sources**
     - Add Reddit: `r/banking, r/personalfinance`
     - Add Twitter/X: `@acmebank mentions`
     - Add Support Tickets: Connect Zendesk
     - Add Reviews: Google Reviews, Trustpilot
     - Explain: "We're starting with 5 sources, can add more later"
   
   - **Step 3: Define Risk Policy**
     - High Severity: Claims containing "fraud", "scam", "data breach"
     - Medium Severity: "hidden fees", "poor service"
     - Low Severity: General complaints
     - Explain: "This helps us prioritize responses"
   
   - **Step 4: Define Non-Starters**
     - Add: "If claim includes 'fraud' + rising velocity → Alert Security + Legal immediately"
     - Add: "If topic is 'data breach' → Route to Security team"
     - Explain: "These are hard disqualifiers that need immediate attention"
   
   - **Step 5: Run First Perception Brief**
     - Click "Generate Brief"
     - Show results:
       - Top 3 emerging claim clusters
       - Outbreak probability indicators
       - Evidence availability
     - Explain: "This is your baseline - you'll see this every morning"

5. **Verify completion:**
   - Should redirect to `/overview`
   - Dashboard should show initial metrics
   - Onboarding complete badge visible

**What to Highlight:**
- ✅ Smooth onboarding experience (30 minutes)
- ✅ Opinionated workflow (not overwhelming)
- ✅ Immediate value (first brief generated)
- ✅ Can expand later (start narrow)

---

### Demo 1.2: Multi-User Collaboration

**Goal:** Show how multiple users work together

**Setup:**
- User 1: `comms@acmebank.com` (Comms role)
- User 2: `legal@acmebank.com` (Legal role)
- User 3: `admin@acmebank.com` (Admin role)

**Steps:**

1. **Login as Comms user:**
   - Navigate to `/overview`
   - Show: Can see all data, can create drafts
   - Navigate to `/studio`
   - Create draft artifact:
     - Title: "Response to Hidden Fees Claim"
     - Type: "REBUTTAL"
     - Content: "All fees are clearly disclosed..."
   - Click "Save Draft"
   - Show: Status = "DRAFT", needs approval

2. **Login as Legal user:**
   - Navigate to `/governance`
   - Show: Pending approvals list
   - Click on draft artifact
   - Review content
   - Click "Approve" or "Request Changes"
   - Show: Status updates to "APPROVED_BY_LEGAL"

3. **Login as Admin user:**
   - Navigate to `/governance`
   - Show: Can see full approval chain
   - Click "Publish"
   - Show: Artifact published to trust center
   - Show: Audit trail with all approvals

**What to Highlight:**
- ✅ Role-based access control
- ✅ Approval workflow enforced
- ✅ Audit trail complete
- ✅ Collaboration seamless

---

## Section 2: Signal Ingestion & Processing

### Demo 2.1: Reddit Post Ingestion

**Goal:** Show how a real Reddit complaint becomes a signal

**Steps:**

1. **Navigate to Signals page:**
   ```
   http://localhost:3001/signals
   ```

2. **Show current signals:**
   - Explain: "These are all signals we've ingested"
   - Filter by source: "Reddit"
   - Show signal details

3. **Manually ingest a Reddit post (or use API):**
   ```bash
   # Using API
   curl -X POST http://localhost:3001/api/signals \
     -H "Content-Type: application/json" \
     -d '{
       "source": {
         "type": "reddit",
         "id": "r/complaints/abc123",
         "url": "https://reddit.com/r/complaints/comments/abc123",
         "author": "user123",
         "subreddit": "complaints",
         "timestamp": "2026-01-21T10:00:00Z"
       },
       "content": {
         "raw": "I've been using AcmeBank for 6 months and just discovered they've been charging me $5/month account maintenance fee that was never mentioned when I signed up. This is a scam!",
         "normalized": "I've been using AcmeBank for 6 months and just discovered they've been charging me $5/month account maintenance fee that was never mentioned when I signed up. This is a scam!",
         "language": "en"
       },
       "metadata": {
         "upvotes": 45,
         "comments": 12,
         "engagement_score": 0.6
       }
     }'
   ```

4. **Refresh signals page:**
   - New signal should appear
   - Show signal details:
     - Source: Reddit
     - Content: Full text
     - Sentiment: Negative (-0.8)
     - Engagement: High (45 upvotes)

5. **Show processing:**
   - Click on signal
   - Show: Evidence created
   - Show: Claims extracted:
     - Primary: "hidden fees"
     - Sub-claims: "not disclosed", "scam"
   - Show: Cluster suggestion (if similar signals exist)

**What to Highlight:**
- ✅ Automatic processing (evidence, claims, clustering)
- ✅ Rich metadata preserved
- ✅ Real-time updates
- ✅ Link to clusters

---

### Demo 2.2: Bulk Support Ticket Import

**Goal:** Show bulk ingestion from Zendesk

**Steps:**

1. **Navigate to Integrations:**
   ```
   http://localhost:3001/integrations
   ```

2. **Create Zendesk connector:**
   - Click "Add Connector"
   - Select "Zendesk"
   - Fill in:
     - Name: "AcmeBank Support"
     - Subdomain: "acmebank"
     - API Token: (demo token)
   - Click "Create"

3. **Trigger sync:**
   - Click "Sync" button
   - Show: Sync in progress
   - Wait for completion

4. **View imported signals:**
   - Navigate to `/signals`
   - Filter: Source = "Zendesk"
   - Show: 50+ tickets imported
   - Show: All processed (evidence created, claims extracted)

5. **Show clustering:**
   - Navigate to `/claims`
   - Show: New clusters created from tickets
   - Example: "Refund requests" cluster with 15 tickets

**What to Highlight:**
- ✅ Bulk ingestion works
- ✅ Automatic processing
- ✅ Clustering groups related tickets
- ✅ Ready for triage

---

### Demo 2.3: Real-Time Signal Stream

**Goal:** Show live signal ingestion

**Steps:**

1. **Open signal stream:**
   - Navigate to `/signals`
   - Enable "Live Stream" toggle
   - Show: WebSocket connection established

2. **In another terminal, send signals:**
   ```bash
   # Send 5 signals rapidly
   for i in {1..5}; do
     curl -X POST http://localhost:3001/api/signals \
       -H "Content-Type: application/json" \
       -d "{
         \"source\": {
           \"type\": \"reddit\",
           \"id\": \"test-$i\",
           \"url\": \"https://reddit.com/test/$i\"
         },
         \"content\": {
           \"raw\": \"Test signal $i about service quality\",
           \"language\": \"en\"
         }
       }"
     sleep 0.5
   done
   ```

3. **Watch signals appear in real-time:**
   - Signals should appear in UI as they're ingested
   - Show: Processing status updates
   - Show: Claims extracted automatically

**What to Highlight:**
- ✅ Real-time updates (< 1 second)
- ✅ No page refresh needed
- ✅ Processing visible in real-time

---

## Section 3: Evidence Vault & Provenance

### Demo 3.1: Create Evidence Bundle for Legal Case

**Goal:** Show how to create a complete evidence bundle

**Steps:**

1. **Navigate to Evidence page:**
   ```
   http://localhost:3001/evidence
   ```

2. **Show existing evidence:**
   - Explain: "All ingested signals become evidence"
   - Show: Evidence list with provenance

3. **Create evidence bundle:**
   - Select 10 evidence items related to "hidden fees"
   - Click "Create Bundle"
   - Fill in:
     - Name: "Hidden Fees Legal Case Bundle"
     - Description: "Evidence for legal case #2026-001"
     - Incident ID: "CASE-2026-001"
   - Click "Create"

4. **Show Merkle bundle:**
   - Navigate to bundle details
   - Show: Merkle tree visualization
   - Show: Root hash
   - Explain: "This proves integrity - if any evidence changes, hash changes"

5. **Export bundle:**
   - Click "Export"
   - Choose format: "Legal Export (JSON + C2PA)"
   - Download file
   - Show: File includes:
     - All evidence items
     - Provenance chain
     - Merkle proofs
     - C2PA manifest (if enabled)

6. **Verify bundle:**
   - Show: Can verify bundle integrity
   - Show: Third-party can validate C2PA manifest

**What to Highlight:**
- ✅ Complete evidence chain
- ✅ Tamper-evident (Merkle tree)
- ✅ Exportable for legal use
- ✅ C2PA provenance (if enabled)

---

### Demo 3.2: Evidence Linking & Verification

**Goal:** Show how evidence links to claims

**Steps:**

1. **Navigate to a claim:**
   ```
   http://localhost:3001/claims/[claim-id]
   ```

2. **Show evidence linked to claim:**
   - Show: Evidence list
   - Show: Supporting vs conflicting evidence
   - Show: Verification score

3. **Link new evidence:**
   - Click "Link Evidence"
   - Search evidence vault
   - Select evidence item
   - Click "Link"
   - Show: Evidence now appears in claim

4. **Show conflict detection:**
   - Link conflicting evidence (e.g., "Bank statement shows correct charge")
   - Show: System detects conflict
   - Show: Verification score updates
   - Show: Recommendation: "Gather more evidence"

**What to Highlight:**
- ✅ Evidence-claim relationships
- ✅ Conflict detection
- ✅ Verification scoring
- ✅ Actionable recommendations

---

## Section 4: Claim Extraction & Clustering

### Demo 4.1: "Scam" Narrative Cluster

**Goal:** Show how multiple signals create a cluster

**Steps:**

1. **Ingest multiple "scam" signals:**
   ```bash
   # Use demo script to create 20 signals
   npm run scripts/demo-data.ts -- --scenario=scam-cluster
   ```

2. **Navigate to Claims page:**
   ```
   http://localhost:3001/claims
   ```

3. **Show cluster creation:**
   - Show: "Scam" cluster appears
   - Show: 20 signals in cluster
   - Show: Primary claim: "scam"
   - Show: Sub-claims: ["stole money", "hidden fees", "avoid"]

4. **Show cluster details:**
   - Click on cluster
   - Show: All signals in cluster
   - Show: Decisiveness score: 0.85 (high)
   - Show: Velocity: Rising (many signals in short time)
   - Show: Timeline visualization

5. **Show graph integration:**
   - Navigate to `/graph`
   - Show: Cluster as node in graph
   - Show: Connected to evidence nodes
   - Show: High importance (central node)

**What to Highlight:**
- ✅ Automatic clustering
- ✅ Decisiveness scoring
- ✅ Velocity tracking
- ✅ Graph integration

---

### Demo 4.2: Claim Verification

**Goal:** Show claim verification against evidence

**Steps:**

1. **Navigate to a claim:**
   ```
   http://localhost:3001/claims/[claim-id]
   ```

2. **Show claim details:**
   - Claim: "Company had a data breach in December 2025"
   - Status: "UNVERIFIED"

3. **Run verification:**
   - Click "Verify Claim"
   - Show: System searches evidence vault
   - Show: Results:
     - Supporting evidence: Security incident report
     - Conflicting evidence: Public disclosure says no breach
     - Verification score: 0.3 (low confidence)

4. **Show recommendations:**
   - "Gather more evidence"
   - "Check internal security logs"
   - "Verify with security team"

5. **Add more evidence:**
   - Link additional evidence
   - Re-run verification
   - Show: Score improves to 0.7

**What to Highlight:**
- ✅ Evidence search works
- ✅ Verification scoring accurate
- ✅ Recommendations actionable
- ✅ Score updates with new evidence

---

## Section 5: Belief Graph Engineering

### Demo 5.1: Weak Node Detection & Neutralization

**Goal:** Show how BGE makes negative content structurally irrelevant

**Steps:**

1. **Navigate to POS dashboard:**
   ```
   http://localhost:3001/pos
   ```

2. **Show current graph state:**
   - Navigate to "Belief Graph" tab
   - Show: Graph visualization
   - Explain: "Nodes are claims, edges are relationships"
   - Show: Some negative nodes visible

3. **Show BGE metrics:**
   - Show: BGE score: 0.65
   - Show: Weak nodes detected: 15
   - Show: Structural irrelevance: 0.7

4. **Execute BGE cycle:**
   - Click "Execute BGE Cycle"
   - Show: Processing...
   - Show: Results:
     - 15 weak nodes identified
     - Decay edges created
     - Negative nodes moved to periphery

5. **Show updated graph:**
   - Refresh graph visualization
   - Show: Negative nodes now peripheral
   - Show: Positive nodes central
   - Show: BGE score improved: 0.75

6. **Show metrics:**
   - Navigate to metrics tab
   - Show: BGE score trend (improving)
   - Show: Weak node count (decreasing)

**What to Highlight:**
- ✅ Automatic weak node detection
- ✅ Structural neutralization
- ✅ Metrics show improvement
- ✅ Graph structure reflects changes

---

### Demo 5.2: Narrative Activation Tracking

**Goal:** Show how narratives spread through graph

**Steps:**

1. **Navigate to Graph page:**
   ```
   http://localhost:3001/graph
   ```

2. **Select a claim node:**
   - Click on "Product has bug X" node
   - Show: Node details
   - Show: Activation score: 0.6

3. **Show paths:**
   - Click "Find Paths"
   - Select another node
   - Show: Path visualization
   - Show: How claim connects to other nodes
   - Show: Reinforcement edges (supporting evidence)
   - Show: Contradiction edges (refuting evidence)

4. **Add more signals:**
   - Ingest 10 more signals supporting the claim
   - Wait for graph update

5. **Show activation increase:**
   - Refresh node details
   - Show: Activation score increased: 0.8
   - Explain: "More signals = higher activation = more 'alive' narrative"

**What to Highlight:**
- ✅ Path finding works
- ✅ Activation scoring reflects reality
- ✅ Real-time graph updates
- ✅ Visual representation clear

---

## Section 6: Narrative Outbreak Forecasting

### Demo 6.1: Hawkes Process Outbreak Prediction

**Goal:** Show outbreak forecasting in action

**Steps:**

1. **Navigate to Forecasts page:**
   ```
   http://localhost:3001/forecasts
   ```

2. **Show historical data:**
   - Select "Hidden Fees" cluster
   - Show: Historical signal timeline
   - Show: Amplification over time (increasing)

3. **Generate forecast:**
   - Click "Generate Forecast"
   - Select:
     - Type: "OUTBREAK"
     - Horizon: 7 days
     - Cluster: "Hidden Fees"
   - Click "Generate"

4. **Show forecast results:**
   - Outbreak probability: 0.72 (high)
   - Confidence: 0.85
   - Forecast parameters:
     - Baseline intensity (μ): 0.1
     - Excitation (α): 0.5
     - Decay (β): 0.3
   - Timeline visualization

5. **Explain forecast:**
   - "Based on historical patterns, there's a 72% chance this narrative will become an outbreak in the next 7 days"
   - "The model uses Hawkes process to account for self-exciting behavior (virality)"

6. **Show intervention simulation:**
   - Click "Simulate Intervention"
   - Select: "Publish Rebuttal Artifact"
   - Show: Updated forecast
   - Show: Outbreak probability decreases: 0.45
   - Explain: "Intervention reduces outbreak risk"

**What to Highlight:**
- ✅ Hawkes model accurate
- ✅ Outbreak probability calibrated
- ✅ Intervention simulation works
- ✅ Actionable insights

---

### Demo 6.2: Forecast Accuracy Validation

**Goal:** Show forecast accuracy over time

**Steps:**

1. **Navigate to Forecasts page:**
   ```
   http://localhost:3001/forecasts
   ```

2. **Show past forecasts:**
   - Filter: "Past 30 days"
   - Show: List of forecasts
   - Show: Accuracy indicators

3. **Select a forecast:**
   - Click on forecast from 7 days ago
   - Show: Original forecast
   - Show: Actual outcome
   - Show: Accuracy metrics:
     - Did outbreak occur? Yes/No
     - Predicted vs actual intensity
     - Calibration score (Brier score)

4. **Show learning:**
   - Navigate to "Forecast Accuracy" tab
   - Show: Accuracy trend over time
   - Show: Model improvements
   - Explain: "System learns from errors"

**What to Highlight:**
- ✅ Accuracy tracking works
- ✅ Calibration improves over time
- ✅ Forecasts are actionable

---

## Section 7: AI Answer Authority Layer (AAAL)

### Demo 7.1: Create Rebuttal Artifact

**Goal:** Show complete artifact creation workflow

**Steps:**

1. **Navigate to Studio:**
   ```
   http://localhost:3001/studio
   ```

2. **Select cluster:**
   - Show: List of claim clusters
   - Select: "Scam" cluster (50 signals)
   - Click "Create Artifact"

3. **Fill artifact form:**
   - Type: "REBUTTAL"
   - Title: "Response to Scam Allegations"
   - Content:
     - Claim: "Some customers have reported concerns about our service"
     - Rebuttal: "We take all concerns seriously. Here's what actually happened..."
     - Evidence citations: Select 5 evidence items
   - Click "Generate with AI" (optional)
   - Review and edit generated content

4. **Show structured data:**
   - Click "Preview"
   - Show: JSON-LD markup
   - Show: Structured format
   - Explain: "This makes it easy for AI to cite"

5. **Check policies:**
   - Click "Check Policies"
   - Show: Policy check results
   - Show: Any violations or warnings
   - Fix if needed

6. **Submit for approval:**
   - Click "Submit for Approval"
   - Show: Approval workflow initiated
   - Show: Status: "PENDING_LEGAL"

**What to Highlight:**
- ✅ Easy artifact creation
- ✅ AI-assisted generation
- ✅ Policy checking
- ✅ Approval workflow

---

### Demo 7.2: Publish & Measure Citation

**Goal:** Show publishing and citation tracking

**Steps:**

1. **Navigate to Governance:**
   ```
   http://localhost:3001/governance
   ```

2. **Approve artifact:**
   - Show: Pending approvals list
   - Click on artifact
   - Review content
   - Click "Approve"

3. **Publish artifact:**
   - Click "Publish"
   - Select channels:
     - Trust center
     - Knowledge base
     - Structured data (for AI)
   - Click "Publish"

4. **Show published artifact:**
   - Navigate to trust center
   - Show: Artifact visible publicly
   - Show: Structured data format

5. **Monitor citations:**
   - Navigate to `/pos` → "AI Authority" tab
   - Show: Citation tracking
   - Show: Queries where artifact was cited
   - Show: Citation rate improvement

6. **Show metrics:**
   - AI citation score: 0.6 (improved from 0.3)
   - Coverage: 45% of claims have artifacts
   - Sentiment shift: +0.2 (more positive)

**What to Highlight:**
- ✅ Multi-channel publishing
- ✅ Citation tracking works
- ✅ Metrics show improvement
- ✅ ROI measurable

---

## Section 8: POS Components

### Demo 8.1: Complete POS Cycle

**Goal:** Show full POS cycle execution

**Steps:**

1. **Navigate to POS dashboard:**
   ```
   http://localhost:3001/pos
   ```

2. **Show current state:**
   - Overall POS score: 0.65
   - Component scores:
     - BGE: 0.7
     - CH: 0.6
     - AAAL: 0.5
     - NPE: 0.7
     - TSM: 0.6
     - DFD: 0.7

3. **Execute POS cycle:**
   - Click "Execute POS Cycle"
   - Show: Processing...
   - Show: Each component executing:
     - BGE: Detecting weak nodes...
     - CH: Creating consensus signals...
     - AAAL: Generating artifacts...
     - NPE: Identifying preemptive actions...
     - TSM: Mapping trust assets...
     - DFD: Updating funnel checkpoints...

4. **Show results:**
   - Actions taken: 12
   - Metrics updated
   - Overall POS score: 0.72 (improved)

5. **Show recommendations:**
   - Click "Recommendations"
   - Show: Actionable recommendations
   - Example: "Create 3 more consensus signals for 'scam' cluster"

**What to Highlight:**
- ✅ All components work together
- ✅ Automated execution
- ✅ Metrics improve
- ✅ Recommendations actionable

---

### Demo 8.2: Consensus Hijacking (CH)

**Goal:** Show how to create third-party consensus

**Steps:**

1. **Navigate to POS → Consensus tab:**
   ```
   http://localhost:3001/pos
   ```

2. **Select cluster:**
   - Choose: "Product is unreliable" cluster
   - Click "Create Consensus Signals"

3. **Add third-party sources:**
   - Expert review: "Industry analysis shows 99% uptime"
   - Comparative research: "Better than competitors"
   - Audit report: "SOC 2 certified"
   - Click "Generate Consensus"

4. **Show consensus summary:**
   - "Some complaints exist, but overall consensus indicates high reliability"
   - Show: Consensus signals created
   - Show: Linked to cluster

5. **Show graph integration:**
   - Navigate to `/graph`
   - Show: Consensus nodes connected to cluster
   - Show: Trust substitution score improved

**What to Highlight:**
- ✅ Consensus signals created
- ✅ Summary generation works
- ✅ Graph integration
- ✅ Trust substitution improves

---

## Section 9: Governance & Approvals

### Demo 9.1: Multi-Stage Approval Workflow

**Goal:** Show complete approval process

**Steps:**

1. **Login as Comms user:**
   - Create draft artifact
   - Submit for approval

2. **Login as Legal user:**
   - Navigate to `/governance`
   - Show: Pending approvals
   - Click on artifact
   - Review content
   - Add comment: "Looks good, but add disclaimer"
   - Click "Request Changes"

3. **Login as Comms user:**
   - See requested changes
   - Edit artifact
   - Add disclaimer
   - Re-submit

4. **Login as Legal user:**
   - Review again
   - Click "Approve"
   - Show: Status: "APPROVED_BY_LEGAL"

5. **Login as Exec user:**
   - Show: Final approval needed
   - Review
   - Click "Approve"
   - Show: Status: "APPROVED"

6. **Show audit trail:**
   - Click "View Audit Trail"
   - Show: Complete history:
     - Created by: Comms user
     - Requested changes: Legal user
     - Updated by: Comms user
     - Approved by: Legal user
     - Approved by: Exec user
   - Show: Timestamps
   - Show: Comments

**What to Highlight:**
- ✅ Approval workflow enforced
- ✅ RBAC works
- ✅ Audit trail complete
- ✅ Collaboration seamless

---

### Demo 9.2: Policy Violation Detection

**Goal:** Show policy checking

**Steps:**

1. **Create artifact with violations:**
   - Unverified claims
   - Missing evidence citations
   - Prohibited language

2. **Check policies:**
   - Click "Check Policies"
   - Show: Violations detected:
     - "Claim 'data breach' is unverified"
     - "Missing evidence citation for claim X"
     - "Language 'guaranteed' not allowed"

3. **Fix violations:**
   - Verify claims
   - Add evidence citations
   - Remove prohibited language

4. **Re-check policies:**
   - Show: All violations resolved
   - Show: Policy check passes

**What to Highlight:**
- ✅ Policy engine works
- ✅ Violations detected accurately
- ✅ Error messages actionable
- ✅ Fixes can be applied

---

## Section 10: Publishing & Distribution

### Demo 10.1: Multi-Channel Publishing

**Goal:** Show publishing to multiple channels

**Steps:**

1. **Navigate to approved artifact:**
   ```
   http://localhost:3001/governance
   ```

2. **Publish artifact:**
   - Click "Publish"
   - Select channels:
     - ✅ Trust center
     - ✅ Knowledge base
     - ✅ Press release
     - ✅ Structured data (JSON-LD)
   - Click "Publish"

3. **Verify publishing:**
   - Trust center: Navigate to public URL
   - Knowledge base: Search for artifact
   - Press release: Check formatted output
   - Structured data: View JSON-LD

4. **Show C2PA manifest:**
   - If enabled, show C2PA manifest
   - Explain: "Third parties can verify provenance"

**What to Highlight:**
- ✅ Multi-channel publishing
- ✅ Formatting correct per channel
- ✅ C2PA provenance (if enabled)
- ✅ URLs work

---

### Demo 10.2: Version Control

**Goal:** Show artifact versioning

**Steps:**

1. **Navigate to published artifact:**
   ```
   http://localhost:3001/studio/[artifact-id]
   ```

2. **Show versions:**
   - Click "Versions"
   - Show: Version history
   - Show: v1 (published), v2 (draft)

3. **Update artifact:**
   - Edit content
   - Save as new version
   - Publish v2

4. **Show version comparison:**
   - Compare v1 vs v2
   - Show: Diff view

5. **Rollback:**
   - Click "Rollback to v1"
   - Show: v1 is live again
   - Show: Audit trail shows rollback

**What to Highlight:**
- ✅ Versioning works
- ✅ Rollback successful
- ✅ Audit trail complete

---

## Section 11: SKU-Specific Demos

### SKU A: AI Answer Monitoring & Authority

**Demo:** Monitor AI answers for "Is Acme Bank a Scam?"

**Steps:**

1. **Enable monitoring:**
   - Navigate to `/integrations`
   - Enable "AI Answer Monitoring"
   - Configure providers: OpenAI, Anthropic, Google

2. **Create authoritative artifact:**
   - Create rebuttal for "scam" claim
   - Publish to structured data

3. **Monitor queries:**
   - Navigate to `/ai-answer-monitor`
   - Show: Query: "is acme bank a scam"
   - Show: Results from each provider
   - Show: Which providers cited the artifact

4. **Show metrics:**
   - Citation rate: 60% (3 of 5 providers)
   - Answer sentiment: Improved from -0.8 to -0.3
   - Coverage: 45% of queries

**What to Highlight:**
- ✅ Monitoring works
- ✅ Citation tracking accurate
- ✅ Metrics show improvement

---

### SKU B: Narrative Risk Early Warning

**Demo:** Detect and preempt "Data Breach" narrative

**Steps:**

1. **Configure thresholds:**
   - Navigate to `/settings`
   - Set outbreak threshold: 0.7
   - Configure playbooks

2. **Ingest signals:**
   - 20 signals about "data breach" in 2 hours
   - Show: System detects:
     - Rising velocity
     - High amplification
     - Outbreak probability: 0.75

3. **Show alert:**
   - Alert triggered
   - Preemption playbook activated
   - Artifact draft generated
   - Legal notified

4. **Execute playbook:**
   - Review draft
   - Approve
   - Publish
   - Show: Published within 4 hours (SLA met)

5. **Show impact:**
   - Outbreak probability decreased: 0.45
   - Narrative velocity slowed
   - Outbreak prevented

**What to Highlight:**
- ✅ Detection works
- ✅ Playbook execution
- ✅ SLA met
- ✅ Outbreak prevented

---

### SKU C: Evidence-Backed Intake & Case Triage

**Demo:** Legal case intake workflow

**Steps:**

1. **Receive allegation:**
   - Navigate to `/evidence`
   - Create evidence: "Customer claims unauthorized charge"
   - Fill in details

2. **Create evidence bundle:**
   - Select related evidence
   - Create bundle
   - Show: Merkle tree

3. **Extract claim:**
   - System extracts: "unauthorized charge"
   - Search evidence vault
   - Link related evidence

4. **Verify claim:**
   - Run verification
   - Show: Verification score: 0.6
   - Show: Recommendations

5. **Export for legal:**
   - Click "Export for Legal"
   - Select format: "Litify/Clio"
   - Download bundle
   - Show: Complete case file

**What to Highlight:**
- ✅ Intake workflow complete
- ✅ Evidence linking accurate
- ✅ Export format compatible
- ✅ Cycle time reduced

---

## Section 12: AI Systems (CRAG, Routing)

### Demo 12.1: CRAG Retrieval

**Goal:** Show self-correcting RAG

**Steps:**

1. **Navigate to AI Orchestration:**
   ```
   http://localhost:3001/api/ai/orchestrate
   ```

2. **Run query:**
   - Query: "What do customers say about hidden fees?"
   - Method: "CRAG"

3. **Show CRAG process:**
   - Initial retrieval (BM25 + embeddings)
   - Rerank (cross-encoder)
   - Critique: "Are retrieved items relevant?"
   - If low confidence → query rewrite
   - Re-retrieve with improved query

4. **Show results:**
   - Final answer with citations
   - Show: Citations are accurate
   - Show: No hallucinations

5. **Compare vs standard RAG:**
   - Run same query with standard RAG
   - Show: CRAG results are better
   - Show: More accurate citations

**What to Highlight:**
- ✅ Critique step works
- ✅ Query rewrite improves results
- ✅ Better than standard RAG
- ✅ Performance acceptable

---

### Demo 12.2: Learned Routing

**Goal:** Show model routing

**Steps:**

1. **Send queries:**
   - Simple: "What is the refund policy?"
   - Complex: "Analyze sentiment trends for Q4 2025"

2. **Show routing decisions:**
   - Simple query → GPT-3.5 (fast/cheap)
   - Complex query → GPT-4 (strong)

3. **Show quality:**
   - Both queries answered correctly
   - Quality maintained

4. **Show cost savings:**
   - Cost reduced by 60% vs always using GPT-4
   - Quality maintained

5. **Show observability:**
   - Navigate to `/traces`
   - Show: Routing decisions logged
   - Show: Cost per query

**What to Highlight:**
- ✅ Router makes correct decisions
- ✅ Quality maintained
- ✅ Cost reduced
- ✅ Observability works

---

## Complete End-to-End Scenarios

### Scenario 1: Financial Services - "Scam" Narrative Response

**Complete workflow from detection to resolution:**

1. **Detection (Day 1, 9:00 AM):**
   - Reddit post: "AcmeBank is a scam!"
   - Signal ingested
   - Claim extracted: "scam"
   - Cluster created

2. **Analysis (Day 1, 9:15 AM):**
   - Forecast: Outbreak probability 0.75
   - Alert triggered
   - Comms team notified

3. **Response (Day 1, 10:00 AM):**
   - Artifact draft created
   - Legal reviews
   - Exec approves
   - Published to trust center

4. **Measurement (Day 7):**
   - Outbreak probability: 0.35 (decreased)
   - Citation rate: 50%
   - Narrative velocity: Slowed
   - Success!

**What to Highlight:**
- ✅ End-to-end workflow
- ✅ Time to resolution: 1 hour
- ✅ Measurable impact
- ✅ Prevented outbreak

---

### Scenario 2: SaaS Company - Outage Response

**Complete workflow:**

1. **Detection:**
   - Support tickets spike
   - Social media mentions
   - Outage narrative detected

2. **Response:**
   - Incident timeline created
   - Customer-facing explanation drafted
   - Postmortem prepared

3. **Publishing:**
   - Status page updated
   - Public explanation published
   - Postmortem shared

4. **Measurement:**
   - Churn risk reduced
   - Support volume decreased
   - Trust maintained

**What to Highlight:**
- ✅ Fast response
- ✅ Transparent communication
   - ✅ Trust maintained

---

## Demo Scripts

### Quick Demo Script (15 minutes)

**For sales demos:**

1. **Onboarding (3 min):**
   - Show signup
   - Show SKU selection
   - Show first brief

2. **Signal Ingestion (2 min):**
   - Show Reddit post ingestion
   - Show automatic processing

3. **POS Cycle (3 min):**
   - Show POS dashboard
   - Execute cycle
   - Show metrics improvement

4. **Artifact Creation (4 min):**
   - Create artifact
   - Show approval workflow
   - Publish

5. **Results (3 min):**
   - Show metrics
   - Show ROI
   - Q&A

---

### Full Demo Script (45 minutes)

**For technical deep-dives:**

1. **Setup & Onboarding (10 min)**
2. **Signal Ingestion (5 min)**
3. **Evidence & Claims (5 min)**
4. **Belief Graph (5 min)**
5. **Forecasting (5 min)**
6. **AAAL & Publishing (5 min)**
7. **POS Components (5 min)**
8. **Q&A (5 min)**

---

## Creating Demo Data

### Demo Data Script

Create `scripts/demo-data.ts`:

```typescript
// Script to generate realistic demo data
// Run: npm run scripts/demo-data.ts -- --scenario=scam-cluster
```

**Scenarios:**
- `scam-cluster`: Creates "scam" narrative cluster
- `outage-response`: Creates outage scenario
- `hidden-fees`: Creates hidden fees scenario
- `data-breach`: Creates data breach scenario

---

## Tips for Effective Demonstrations

1. **Tell a story:** Connect features to real customer problems
2. **Show, don't tell:** Use actual UI, not slides
3. **Use realistic data:** Make it feel real
4. **Highlight value:** Show ROI, not just features
5. **Be interactive:** Let audience ask questions
6. **Show failures:** Demonstrate error handling
7. **Measure everything:** Show metrics and impact

---

## Conclusion

This guide provides complete demonstrations for every section of Holdwall POS. Use these as:

1. **Sales demos:** Quick value demonstrations
2. **Technical deep-dives:** Complete feature walkthroughs
3. **Training:** Onboarding new users
4. **Documentation:** Reference for how features work

Remember: **The best demonstration tells a story that resonates with your audience's real problems.**
