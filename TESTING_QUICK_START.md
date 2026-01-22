# Testing Quick Start Guide

## Overview

This guide provides a quick reference for testing Holdwall POS in real-world scenarios. For comprehensive details, see [REAL_WORLD_TESTING_GUIDE.md](./REAL_WORLD_TESTING_GUIDE.md).

## Quick Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run real-world scenario tests specifically
npm run test:e2e:real-world

# Run with UI (for debugging)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run load tests
npm run test:load

# Run unit tests
npm test

# Run with coverage
npm run test:coverage
```

## Test Structure

### E2E Tests (`__tests__/e2e/`)

- **`authentication.test.ts`** - Sign up, sign in, session management
- **`critical-journeys.test.ts`** - Core user workflows
- **`real-world-scenarios.test.ts`** - Realistic customer scenarios ⭐ NEW
- **`pos-journey.test.ts`** - POS dashboard and cycle execution
- **`page-navigation.test.ts`** - All page navigation
- **`performance.test.ts`** - Performance benchmarks
- **`security.test.ts`** - Security vulnerabilities

### Unit Tests (`__tests__/`)

- **`api/`** - API endpoint tests
- **`lib/`** - Library function tests
- **`components/`** - React component tests

## Real-World Test Scenarios

The `real-world-scenarios.test.ts` file includes:

1. **Reddit Post About Hidden Fees** - Signal ingestion → claim extraction → clustering
2. **Support Ticket Bulk Import** - Connector sync → bulk processing → clustering
3. **Complete POS Cycle** - Execute full POS cycle → verify metrics
4. **Forecast Outbreak Prediction** - Generate forecast → verify outbreak probability
5. **Create and Publish AAAL Artifact** - Create artifact → check policies → publish
6. **Belief Graph Exploration** - Load graph → find paths
7. **Overview Dashboard Metrics** - Load and verify key metrics
8. **Multi-Stage Approval Workflow** - Create artifact → verify approval process

## Testing Each Section

### 1. Authentication & Authorization
```bash
npm run test:e2e -- __tests__/e2e/authentication.test.ts
```
**What it tests:**
- Sign up flow
- Sign in flow
- Session management
- Protected routes
- Multi-user collaboration

### 2. Signal Ingestion
```bash
npm run test:e2e:real-world
# Look for "Scenario 1: Reddit Post About Hidden Fees"
```
**What it tests:**
- Signal ingestion from various sources
- Evidence creation
- Claim extraction
- Clustering

### 3. POS Components
```bash
npm run test:e2e:real-world
# Look for "Scenario 3: Complete POS Cycle"
```
**What it tests:**
- BGE (Belief Graph Engineering)
- CH (Consensus Hijacking)
- AAAL (AI Answer Authority Layer)
- NPE (Narrative Preemption Engine)
- TSM (Trust Substitution Mechanism)
- DFD (Decision Funnel Domination)

### 4. Forecasting
```bash
npm run test:e2e:real-world
# Look for "Scenario 4: Forecast Outbreak Prediction"
```
**What it tests:**
- Hawkes process modeling
- Outbreak probability calculation
- Intervention simulation

### 5. AAAL Artifacts
```bash
npm run test:e2e:real-world
# Look for "Scenario 5: Create and Publish AAAL Artifact"
```
**What it tests:**
- Artifact creation
- Policy checking
- Publishing workflow

### 6. Belief Graph
```bash
npm run test:e2e:real-world
# Look for "Scenario 6: Belief Graph Exploration"
```
**What it tests:**
- Graph snapshot loading
- Path finding
- Node/edge relationships

### 7. Governance & Approvals
```bash
npm run test:e2e:real-world
# Look for "Scenario 8: Multi-Stage Approval Workflow"
```
**What it tests:**
- Approval workflow
- RBAC enforcement
- Audit trails

## Test Data Setup

Before running tests, ensure:

1. **Database is migrated:**
   ```bash
   npm run db:migrate
   ```

2. **Test users exist:**
   - `user@holdwall.com` / `user123` (default test user)
   - Or create your own test users

3. **Environment variables set:**
   - `NEXT_PUBLIC_APP_URL` (default: `http://localhost:3001`)
   - Database connection strings
   - API keys (if testing external integrations)

## Running Tests in CI/CD

Tests are automatically run in CI/CD pipeline:

- **On every commit:** Unit tests
- **On PR:** E2E tests + integration tests
- **On main branch:** Full test suite + load tests
- **Weekly:** Security tests + evaluation tests

## Debugging Failed Tests

1. **Run with UI:**
   ```bash
   npm run test:e2e:ui
   ```

2. **Run in headed mode:**
   ```bash
   npm run test:e2e:headed
   ```

3. **Run specific test:**
   ```bash
   npx playwright test __tests__/e2e/real-world-scenarios.test.ts -g "Scenario 1"
   ```

4. **Check logs:**
   - Test output shows API responses
   - Browser console logs captured
   - Network requests logged

## Adding New Test Scenarios

1. **Add to `real-world-scenarios.test.ts`:**
   ```typescript
   test.describe("Scenario X: Your Scenario", () => {
     test("should do something", async ({ page, request }) => {
       // Your test code
     });
   });
   ```

2. **Follow the pattern:**
   - Use `authenticate()` helper for auth
   - Use `apiRequest()` helper for API calls
   - Verify both API responses and UI state
   - Include realistic test data

3. **Document in `REAL_WORLD_TESTING_GUIDE.md`:**
   - Add scenario description
   - Include test flow steps
   - List what to verify

## Best Practices

1. **Use realistic data:** Mirror production patterns
2. **Test end-to-end:** Don't just test APIs, test UI too
3. **Verify assertions:** Check both success and failure cases
4. **Clean up:** Don't leave test data in database
5. **Be resilient:** Tests should handle missing data gracefully

## Common Issues

### Tests fail with "timeout"
- Increase timeout in test: `{ timeout: 30000 }`
- Check if server is running
- Verify database connection

### Tests fail with "element not found"
- Wait for elements: `await page.waitForSelector(...)`
- Use more specific selectors
- Check if page loaded: `await page.waitForLoadState("networkidle")`

### API requests fail
- Check authentication: `await authenticate(page)`
- Verify endpoint exists
- Check request format matches API expectations

## Next Steps

1. **Read the full guide:** [REAL_WORLD_TESTING_GUIDE.md](./REAL_WORLD_TESTING_GUIDE.md)
2. **Run the tests:** `npm run test:e2e:real-world`
3. **Add your scenarios:** Follow the patterns in existing tests
4. **Contribute:** Share new test scenarios with the team

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Jest Documentation](https://jestjs.io/)
- [Testing Guide](./REAL_WORLD_TESTING_GUIDE.md)
- [Project Documentation](./COMPREHENSIVE_PROJECT_DOCUMENTATION.md)
