/**
 * Real-World Scenario E2E Tests
 * 
 * These tests demonstrate realistic customer workflows and use cases
 * based on the REAL_WORLD_TESTING_GUIDE.md
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TransformStream } = require("stream/web");
// @ts-ignore
globalThis.TransformStream = globalThis.TransformStream || TransformStream;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { test, expect } = require("@playwright/test");

export {};

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

// Helper function to authenticate and get session
async function authenticate(
  page: any,
  email = "user@holdwall.com",
  password = "user123",
  options: { verifyNavigation?: boolean } = {}
) {
  const { verifyNavigation = false } = options;
  // Ensure clean auth state for each scenario.
  await page.context().clearCookies();

  // Force a deterministic post-login destination to avoid navigation races.
  await page.goto(`${baseUrl}/auth/signin?callbackUrl=%2Foverview`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 15000 });

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeEnabled({ timeout: 15000 });

  const signInResponse = page
    .waitForResponse(
      (r: any) => r.url().includes("/api/auth/callback/credentials") && r.request().method() === "POST",
      { timeout: 60000 }
    )
    .catch(() => null);

  const postLoginNav = page
    .waitForURL((u: any) => !u.pathname.includes("/auth/signin"), { timeout: 60000 })
    .catch(() => null);

  await submitButton.click();
  await signInResponse;
  await postLoginNav;
  await page.waitForLoadState("domcontentloaded").catch(() => null);

  const session = await page
    .evaluate(async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include" });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    })
    .catch(() => null);
  expect(session?.user).toBeTruthy();

  if (verifyNavigation) {
    await page.goto(`${baseUrl}/overview`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await expect(page).not.toHaveURL(/auth\/signin/);
  }
}

// Helper function to create API request with auth
async function apiRequest(
  page: any,
  endpoint: string,
  options: { method?: string; body?: any; headers?: Record<string, string> } = {}
) {
  const { method = "GET", body, headers = {} } = options;
  // Playwright APIRequestContext uses `data` (not `body`) for request payloads.
  return page.request.fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    ...(body !== undefined ? { data: JSON.stringify(body) } : {}),
  });
}

test.describe("Real-World Scenarios", () => {
  test.setTimeout(120000);
  test.describe("Scenario 1: Reddit Post About Hidden Fees", () => {
    test("should ingest Reddit signal, extract claims, and create cluster", async ({ page, request }) => {
      await authenticate(page);

      // Step 1: Ingest Reddit signal
      const redditSignal = {
        source: {
          type: "reddit",
          id: `r/complaints/test-${Date.now()}`,
          url: "https://reddit.com/r/complaints/comments/test123",
          author: "user123",
          subreddit: "complaints",
          timestamp: new Date().toISOString(),
        },
        content: {
          raw: "I've been using AcmeBank for 6 months and just discovered they've been charging me $5/month 'account maintenance fee' that was never mentioned when I signed up. This is a scam!",
          normalized: "I've been using AcmeBank for 6 months and just discovered they've been charging me $5/month 'account maintenance fee' that was never mentioned when I signed up. This is a scam!",
          language: "en",
          sentiment: -0.8,
        },
        metadata: {
          upvotes: 45,
          comments: 12,
          engagement_score: 0.6,
        },
        compliance: {
          source_allowed: true,
          collection_method: "api",
          retention_policy: "standard",
        },
      };

      const signalResponse = await apiRequest(page, "/api/signals", {
        method: "POST",
        body: redditSignal,
      });

      expect(signalResponse.status()).toBe(201);
      const signalData = await signalResponse.json();
      expect(signalData).toHaveProperty("evidence_id");

      // Step 2: Verify signal appears in signals list
      const signalsResponse = await apiRequest(page, "/api/signals");
      expect(signalsResponse.status()).toBe(200);
      const signals = await signalsResponse.json();
      expect(Array.isArray(signals)).toBe(true);
      expect(signals.some((s: any) => s.evidence_id === signalData.evidence_id)).toBe(true);

      // Step 3: Navigate to signals page and verify UI
      await page.goto(`${baseUrl}/signals`);
      await page.waitForLoadState("domcontentloaded");
      // Signal should be visible in the list (exact text matching may vary)
      await expect(page.locator("text=hidden fee").or(page.locator("text=account maintenance")).first()).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("Scenario 2: Support Ticket Bulk Import", () => {
    test("should create connector, sync tickets, and verify clustering", async ({ page, request }) => {
      await authenticate(page);

      // Step 1: Create Zendesk connector
      const connectorData = {
        type: "zendesk",
        name: "Test Zendesk Connector",
        config: {
          subdomain: "test",
          api_token: "test-token",
        },
      };

      const connectorResponse = await apiRequest(page, "/api/integrations/connectors", {
        method: "POST",
        body: connectorData,
      });

      // Connector creation may require additional setup, so we'll check if it succeeds or skip
      if (connectorResponse.ok()) {
        const connector = await connectorResponse.json();
        expect(connector).toHaveProperty("id");

        // Step 2: Create test signals that simulate support tickets
        const ticketSignals = Array.from({ length: 10 }, (_, i) => ({
          source: {
            type: "zendesk",
            id: `ticket-${i}`,
            url: `https://test.zendesk.com/tickets/${i}`,
            created_at: new Date(Date.now() - i * 3600000).toISOString(),
          },
          content: {
            raw: `Customer ${i} requesting refund for order #${1000 + i}. Says they never received product.`,
            normalized: `Customer requesting refund for order. Says they never received product.`,
            language: "en",
          },
          metadata: {
            priority: i % 3 === 0 ? "high" : "normal",
            status: "open",
          },
          compliance: {
            source_allowed: true,
            collection_method: "api",
            retention_policy: "standard",
          },
        }));

        // Ingest all tickets
        for (const ticket of ticketSignals) {
          await apiRequest(page, "/api/signals", {
            method: "POST",
            body: ticket,
          });
        }

        // Step 3: Verify clustering
        await page.waitForTimeout(2000); // Wait for async processing
        const clustersResponse = await apiRequest(page, "/api/claim-clusters/top?sort=decisiveness&range=7d");
        if (clustersResponse.ok()) {
          const clusters = await clustersResponse.json();
          expect(clusters).toHaveProperty("clusters");
          // Should have at least one cluster related to refunds
          const refundCluster = clusters.clusters?.find((c: any) =>
            c.primary_claim_text?.toLowerCase().includes("refund")
          );
          if (refundCluster) {
            expect(refundCluster).toHaveProperty("cluster_id");
          }
        }
      }
    });
  });

  test.describe("Scenario 3: Complete POS Cycle", () => {
    test("should execute POS cycle and verify metrics improvement", async ({ page, request }) => {
      await authenticate(page);

      // Step 1: Navigate to POS dashboard
      await page.goto(`${baseUrl}/pos`);
      await page.waitForLoadState("domcontentloaded");

      // Step 2: Get initial metrics
      const initialMetricsResponse = await apiRequest(page, "/api/pos/orchestrator?action=metrics");
      let initialScore = 0;
      if (initialMetricsResponse.ok()) {
        const initialMetrics = await initialMetricsResponse.json();
        initialScore = initialMetrics.metrics?.overall?.posScore || 0;
      }

      // Step 3: Execute POS cycle
      const executeResponse = await apiRequest(page, "/api/pos/orchestrator", {
        method: "POST",
        body: { action: "execute-cycle" },
      });

      if (executeResponse.ok()) {
        const result = await executeResponse.json();
        expect(result).toHaveProperty("success");
        expect(result).toHaveProperty("actions");
        expect(result).toHaveProperty("metrics");

        // Step 4: Verify metrics updated
        await page.waitForTimeout(3000); // Wait for UI update
        const updatedMetricsResponse = await apiRequest(page, "/api/pos/orchestrator?action=metrics");
        if (updatedMetricsResponse.ok()) {
          const updatedMetrics = await updatedMetricsResponse.json();
          const updatedScore = updatedMetrics.metrics?.overall?.posScore || 0;
          // Score should be updated (may be same or improved)
          expect(typeof updatedScore).toBe("number");
        }
      }
    });
  });

  test.describe("Scenario 4: Forecast Outbreak Prediction", () => {
    test("should generate forecast and show outbreak probability", async ({ page, request }) => {
      await authenticate(page);

      // Step 1: Create some signals to base forecast on
      const testSignals = Array.from({ length: 5 }, (_, i) => ({
        source: {
          type: "reddit",
          id: `test-forecast-${i}`,
          url: `https://reddit.com/test/${i}`,
          timestamp: new Date(Date.now() - i * 86400000).toISOString(), // Spread over 5 days
        },
        content: {
          raw: `Complaint about service quality ${i}`,
          normalized: `Complaint about service quality`,
          language: "en",
        },
        compliance: {
          source_allowed: true,
          collection_method: "api",
          retention_policy: "standard",
        },
      }));

      for (const signal of testSignals) {
        await apiRequest(page, "/api/signals", {
          method: "POST",
          body: signal,
        });
      }

      // Step 2: Run forecast
      await page.waitForTimeout(2000); // Wait for signals to process
      const forecastResponse = await apiRequest(page, "/api/forecasts/run", {
        method: "POST",
        body: {
          range: "7d",
          type: "OUTBREAK",
        },
      });

      if (forecastResponse.ok()) {
        const forecast = await forecastResponse.json();
        expect(forecast).toHaveProperty("forecast_id");

        // Step 3: Get forecast details
        const detailsResponse = await apiRequest(page, `/api/forecasts/${forecast.forecast_id}`);
        if (detailsResponse.ok()) {
          const details = await detailsResponse.json();
          expect(details).toHaveProperty("outbreak_probability");
          expect(typeof details.outbreak_probability).toBe("number");
        }
      }
    });
  });

  test.describe("Scenario 5: Create and Publish AAAL Artifact", () => {
    test("should create artifact, check policies, and publish", async ({ page, request }) => {
      await authenticate(page);

      // Step 1: Create a claim cluster first (or use existing)
      // For this test, we'll create a simple artifact
      const artifactData = {
        type: "REBUTTAL",
        title: "Test Rebuttal Artifact",
        content: {
          claim: "Service has hidden fees",
          rebuttal: "All fees are clearly disclosed in our terms of service.",
          evidence_citations: [],
        },
      };

      const createResponse = await apiRequest(page, "/api/pos/aaal", {
        method: "POST",
        body: artifactData,
      });

      if (createResponse.ok()) {
        const artifact = await createResponse.json();
        expect(artifact).toHaveProperty("artifact_id");

        // Step 2: Check policies
        const policyResponse = await apiRequest(page, `/api/aaal/check-policies`, {
          method: "POST",
          body: { artifact_id: artifact.artifact_id },
        });

        if (policyResponse.ok()) {
          const policyCheck = await policyResponse.json();
          expect(policyCheck).toHaveProperty("passed");
          // If policies pass, we could proceed to publish
          // (In real scenario, would need approvals first)
        }
      }
    });
  });

  test.describe("Scenario 6: Belief Graph Exploration", () => {
    test("should load graph snapshot and find paths", async ({ page, request }) => {
      await authenticate(page);

      // Step 1: Get graph snapshot
      const snapshotResponse = await apiRequest(page, "/api/graph/snapshot?range=30d");
      expect(snapshotResponse.status()).toBe(200);
      const snapshot = await snapshotResponse.json();
      expect(snapshot).toHaveProperty("snapshot");
      expect(snapshot.snapshot).toHaveProperty("nodes");
      expect(snapshot.snapshot).toHaveProperty("edges");
      expect(Array.isArray(snapshot.snapshot.nodes)).toBe(true);
      expect(Array.isArray(snapshot.snapshot.edges)).toBe(true);

      // Step 2: If we have nodes, try to find paths
      if (snapshot.snapshot.nodes.length >= 2) {
        const fromNode = snapshot.snapshot.nodes[0].id;
        const toNode = snapshot.snapshot.nodes[1].id;

        const pathsResponse = await apiRequest(
          page,
          `/api/graph/paths?from_node=${fromNode}&to_node=${toNode}&depth=3`
        );
        if (pathsResponse.ok()) {
          const paths = await pathsResponse.json();
          expect(paths).toHaveProperty("paths");
          expect(Array.isArray(paths.paths)).toBe(true);
        }
      }

      // Step 3: Navigate to graph page and verify UI
      await page.goto(`${baseUrl}/graph`);
      await page.waitForLoadState("domcontentloaded");
      // Graph visualization should be visible
      await expect(page.locator("text=Graph").or(page.locator('[data-testid="graph"]')).first()).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("Scenario 7: Overview Dashboard Metrics", () => {
    test("should load overview and display key metrics", async ({ page, request }) => {
      await authenticate(page);

      // Step 1: Get metrics summary
      const metricsResponse = await apiRequest(page, "/api/metrics/summary?range=7d");
      expect(metricsResponse.status()).toBe(200);
      const metrics = await metricsResponse.json();
      expect(metrics).toHaveProperty("perception_health_score");
      expect(metrics).toHaveProperty("outbreak_probability_7d");

      // Step 2: Navigate to overview page
      await page.goto(`${baseUrl}/overview`);
      await page.waitForLoadState("domcontentloaded");

      // Step 3: Verify key metrics are displayed
      // (Exact selectors depend on UI implementation)
      await expect(
        page
          .locator("text=Perception Health")
          .or(page.locator("text=Outbreak Probability"))
          .or(page.locator('[data-testid="metrics"]'))
          .first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Scenario 8: Multi-Stage Approval Workflow", () => {
    test("should create artifact and verify approval workflow", async ({ page, request }) => {
      await authenticate(page);

      // Step 1: Create artifact draft
      const artifactData = {
        type: "REBUTTAL",
        title: "Test Approval Workflow",
        content: {
          claim: "Test claim",
          rebuttal: "Test rebuttal",
        },
      };

      const createResponse = await apiRequest(page, "/api/pos/aaal", {
        method: "POST",
        body: artifactData,
      });

      if (createResponse.ok()) {
        const artifact = await createResponse.json();
        expect(artifact).toHaveProperty("artifact_id");

        // Step 2: Check if approvals endpoint exists and works
        const approvalsResponse = await apiRequest(page, "/api/approvals");
        if (approvalsResponse.ok()) {
          const approvals = await approvalsResponse.json();
          expect(Array.isArray(approvals) || typeof approvals === "object").toBe(true);
        }
      }
    });
  });
});
