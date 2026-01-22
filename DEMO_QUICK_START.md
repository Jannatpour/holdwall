# Demo Quick Start Guide

Quick reference for running real-world demonstrations of Holdwall POS.

## Quick Commands

```bash
# Generate demo data
npm run demo:data -- --scenario=scam-cluster
npm run demo:data -- --scenario=outage-response
npm run demo:data -- --scenario=hidden-fees
npm run demo:data -- --scenario=data-breach
npm run demo:data -- --scenario=all

# Start the application
npm run dev

# Seed test users
npm run scripts/seed-test-users.ts
```

## Demo Scenarios

### 1. Scam Cluster
**Command:** `npm run demo:data -- --scenario=scam-cluster`

**What it creates:**
- 20 Reddit/Twitter signals about "scam" allegations
- Spread over 20 hours
- High engagement scores
- Very negative sentiment

**Demo flow:**
1. Navigate to `/claims` - see "scam" cluster
2. Navigate to `/graph` - see cluster in graph
3. Navigate to `/forecasts` - generate outbreak forecast
4. Navigate to `/studio` - create rebuttal artifact

---

### 2. Outage Response
**Command:** `npm run demo:data -- --scenario=outage-response`

**What it creates:**
- 10 support tickets and social media posts
- About service outage
- Spread over 5 hours
- High priority signals

**Demo flow:**
1. Navigate to `/signals` - see outage signals
2. Navigate to `/claims` - see outage cluster
3. Navigate to `/studio` - create incident response
4. Navigate to `/governance` - show approval workflow

---

### 3. Hidden Fees
**Command:** `npm run demo:data -- --scenario=hidden-fees`

**What it creates:**
- 10 Reddit posts about hidden fees
- Spread over 10 days
- Escalating negativity
- Rising engagement

**Demo flow:**
1. Navigate to `/claims` - see "hidden fees" cluster
2. Navigate to `/forecasts` - see outbreak probability
3. Navigate to `/studio` - create rebuttal
4. Navigate to `/pos` - execute POS cycle

---

### 4. Data Breach
**Command:** `npm run demo:data -- --scenario=data-breach`

**What it creates:**
- 10 high-severity signals about data breach
- Spread over 10 hours
- Very negative sentiment
- High amplification

**Demo flow:**
1. Navigate to `/signals` - see high-severity signals
2. Navigate to `/forecasts` - see outbreak probability
3. Navigate to `/governance` - see escalation alerts
4. Navigate to `/evidence` - create evidence bundle

---

## Quick Demo Scripts

### 15-Minute Sales Demo

1. **Setup (2 min):**
   ```bash
   npm run demo:data -- --scenario=scam-cluster
   npm run dev
   ```

2. **Onboarding (3 min):**
   - Show signup
   - Show SKU selection
   - Show first brief

3. **Signal Processing (2 min):**
   - Navigate to `/signals`
   - Show automatic processing
   - Show claim extraction

4. **POS Cycle (3 min):**
   - Navigate to `/pos`
   - Execute cycle
   - Show metrics improvement

5. **Artifact Creation (4 min):**
   - Navigate to `/studio`
   - Create artifact
   - Show approval workflow
   - Publish

6. **Results (1 min):**
   - Show metrics
   - Show ROI

---

### 45-Minute Technical Deep-Dive

1. **Setup & Onboarding (10 min)**
2. **Signal Ingestion (5 min)**
3. **Evidence & Claims (5 min)**
4. **Belief Graph (5 min)**
5. **Forecasting (5 min)**
6. **AAAL & Publishing (5 min)**
7. **POS Components (5 min)**
8. **Q&A (5 min)**

---

## Demo Users

### Test Users (after running seed script):

- **Admin:** `admin@holdwall.com` / `admin123`
- **User:** `user@holdwall.com` / `user123`
- **Test:** `test-login@example.com` / `test12345`

### Create Demo Users for Specific Scenarios:

```typescript
// Comms user
email: "comms@acmebank.com"
role: "COMMS"

// Legal user
email: "legal@acmebank.com"
role: "LEGAL"

// Exec user
email: "exec@acmebank.com"
role: "ADMIN"
```

---

## Key Demo Pages

| Page | URL | What to Show |
|------|-----|--------------|
| Overview | `/overview` | Metrics, recommendations |
| Signals | `/signals` | Signal ingestion, processing |
| Claims | `/claims` | Claim clusters, decisiveness |
| Graph | `/graph` | Belief graph visualization |
| Forecasts | `/forecasts` | Outbreak predictions |
| Studio | `/studio` | Artifact creation |
| Governance | `/governance` | Approvals, audit trails |
| POS | `/pos` | POS components, cycle execution |
| Integrations | `/integrations` | Connectors, data sources |

---

## Demo Tips

1. **Tell a story:** Connect features to real problems
2. **Use realistic data:** Generated demo data feels real
3. **Show, don't tell:** Use actual UI
4. **Highlight value:** Show ROI, not just features
5. **Be interactive:** Answer questions
6. **Show failures:** Demonstrate error handling
7. **Measure everything:** Show metrics and impact

---

## Troubleshooting

### Demo data not appearing?

1. **Check database connection:**
   ```bash
   npm run db:studio
   ```

2. **Verify tenant exists:**
   - Check `Tenant` table
   - Should have "AcmeBank", "TechCorp", "HealthCare Inc"

3. **Check evidence created:**
   - Check `Evidence` table
   - Should have signals with correct tenantId

### Signals not clustering?

1. **Wait for processing:**
   - Clustering is async
   - Wait 30-60 seconds after creating signals

2. **Check claim extraction:**
   - Navigate to `/claims`
   - Should see clusters automatically

### Forecasts not generating?

1. **Need historical data:**
   - Create signals with timestamps spread over time
   - At least 5-10 signals for meaningful forecast

---

## Next Steps

1. **Read full guide:** [REAL_WORLD_DEMONSTRATION_GUIDE.md](./REAL_WORLD_DEMONSTRATION_GUIDE.md)
2. **Generate demo data:** `npm run demo:data -- --scenario=all`
3. **Start application:** `npm run dev`
4. **Run demo:** Follow quick demo script above

---

## Resources

- [Real-World Demonstration Guide](./REAL_WORLD_DEMONSTRATION_GUIDE.md) - Complete walkthroughs
- [Real-World Testing Guide](./REAL_WORLD_TESTING_GUIDE.md) - Testing scenarios
- [Testing Quick Start](./TESTING_QUICK_START.md) - Test execution
- [Project Documentation](./COMPREHENSIVE_PROJECT_DOCUMENTATION.md) - Full documentation
