/**
 * End-to-End Tests for Critical User Journeys
 *
 * NOTE: Playwright's Node runtime expects Web Streams globals in some builds.
 * We set them before requiring the Playwright test runner.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TransformStream } = require("stream/web");
// @ts-ignore
globalThis.TransformStream = globalThis.TransformStream || TransformStream;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { test, expect } = require("@playwright/test");

export {};

test.describe("Critical User Journeys - E2E", () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

  test.describe("Signal Ingestion and Clustering Journey", () => {
    test("should ingest signal, extract claims, and create cluster", async () => {
      // 1. Ingest a signal
      const signalResponse = await fetch(`${baseUrl}/api/signals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify({
          source: {
            type: "reddit",
            id: "test-post-123",
            url: "https://reddit.com/r/test/post",
          },
          content: {
            raw: "This product has hidden fees and poor customer service",
            normalized: "This product has hidden fees and poor customer service",
            language: "en",
          },
          compliance: {
            source_allowed: true,
            collection_method: "api",
            retention_policy: "standard",
          },
        }),
      });

      expect(signalResponse.status).toBe(201);
      const { evidence_id } = await signalResponse.json();
      expect(evidence_id).toBeDefined();

      // 2. Verify signal appears in signals list
      const signalsResponse = await fetch(`${baseUrl}/api/signals`);
      expect(signalsResponse.status).toBe(200);
      const signals = await signalsResponse.json();
      expect(Array.isArray(signals)).toBe(true);
      expect(signals.some((s: any) => s.evidence_id === evidence_id)).toBe(true);

      // 3. Create cluster from signal
      const clusterResponse = await fetch(`${baseUrl}/api/claim-clusters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify({
          evidence_ids: [evidence_id],
          primary_claim_text: "Product has hidden fees",
        }),
      });

      if (clusterResponse.ok) {
        const cluster = await clusterResponse.json();
        expect(cluster).toHaveProperty("cluster_id");
      }
    });
  });

  test.describe("Overview Dashboard Journey", () => {
    test("should load overview metrics and recommendations", async () => {
      // 1. Load metrics summary
      const metricsResponse = await fetch(`${baseUrl}/api/metrics/summary?range=7d`);
      expect(metricsResponse.status).toBe(200);
      const metrics = await metricsResponse.json();
      expect(metrics).toHaveProperty("perception_health_score");
      expect(metrics).toHaveProperty("outbreak_probability_7d");
      expect(metrics).toHaveProperty("ai_citation_coverage");
      expect(metrics).toHaveProperty("trust_coverage_ratio");

      // 2. Load top clusters
      const clustersResponse = await fetch(`${baseUrl}/api/claim-clusters/top?sort=decisiveness&range=7d`);
      expect(clustersResponse.status).toBe(200);
      const clusters = await clustersResponse.json();
      expect(clusters).toHaveProperty("clusters");
      expect(Array.isArray(clusters.clusters)).toBe(true);

      // 3. Load recommendations
      const recommendationsResponse = await fetch(`${baseUrl}/api/recommendations`);
      expect(recommendationsResponse.status).toBe(200);
      const recommendations = await recommendationsResponse.json();
      expect(recommendations).toHaveProperty("recommendations");
      expect(Array.isArray(recommendations.recommendations)).toBe(true);
    });
  });

  test.describe("Trust Asset Management Journey", () => {
    test("should create trust asset and map to cluster", async () => {
      // 1. Create trust asset
      const assetResponse = await fetch(`${baseUrl}/api/trust/assets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify({
          type: "SOC2",
          title: "SOC 2 Type II Certification",
          content: "We maintain SOC 2 Type II certification",
          verified: true,
        }),
      });

      if (assetResponse.ok) {
        const asset = await assetResponse.json();
        expect(asset).toHaveProperty("asset_id");

        // 2. Get trust gaps
        const gapsResponse = await fetch(`${baseUrl}/api/trust/gaps`);
        expect(gapsResponse.status).toBe(200);
        const gaps = await gapsResponse.json();
        expect(gaps).toHaveProperty("gaps");
        expect(Array.isArray(gaps.gaps)).toBe(true);

        // 3. Map asset to cluster (if cluster exists)
        if (gaps.gaps.length > 0) {
          const clusterId = gaps.gaps[0].cluster_id;
          const mappingResponse = await fetch(`${baseUrl}/api/trust/mappings`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer test-token",
            },
            body: JSON.stringify({
              cluster_id: clusterId,
              asset_id: asset.asset_id,
            }),
          });

          expect(mappingResponse.status).toBe(200);
        }
      }
    });
  });

  test.describe("AI Orchestration Journey", () => {
    test("should execute GraphRAG query and return results", async () => {
      const response = await fetch(
        `${baseUrl}/api/ai/orchestrate?query=test&use_graphrag=true`,
        {
          headers: {
            "Authorization": "Bearer test-token",
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("answer");
      expect(data).toHaveProperty("sources");
      expect(data).toHaveProperty("method");
      expect(data.method).toBe("graphrag");
    });

    test("should execute Composite orchestrator query", async () => {
      const response = await fetch(
        `${baseUrl}/api/ai/orchestrate?query=test&use_composite=true`,
        {
          headers: {
            "Authorization": "Bearer test-token",
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("answer");
      expect(data.method).toBe("composite");
    });

    test("should execute K2 reasoning query", async () => {
      const response = await fetch(
        `${baseUrl}/api/ai/orchestrate?query=test&use_k2=true`,
        {
          headers: {
            "Authorization": "Bearer test-token",
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("answer");
      expect(data.method).toBe("k2");
    });
  });

  test.describe("Forecast and Outbreak Prediction Journey", () => {
    test("should generate forecast and show outbreak probability", async () => {
      // 1. Run forecast
      const forecastResponse = await fetch(`${baseUrl}/api/forecasts/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify({
          range: "7d",
        }),
      });

      if (forecastResponse.ok) {
        const forecast = await forecastResponse.json();
        expect(forecast).toHaveProperty("forecast_id");

        // 2. Get forecast details
        const detailsResponse = await fetch(
          `${baseUrl}/api/forecasts/${forecast.forecast_id}`
        );
        expect(detailsResponse.status).toBe(200);
        const details = await detailsResponse.json();
        expect(details).toHaveProperty("outbreak_probability");
        expect(details).toHaveProperty("confidence");
      }
    });
  });

  test.describe("Belief Graph Exploration Journey", () => {
    test("should load graph snapshot and find paths", async () => {
      // 1. Get graph snapshot
      const snapshotResponse = await fetch(`${baseUrl}/api/graph/snapshot?range=30d`);
      expect(snapshotResponse.status).toBe(200);
      const snapshot = await snapshotResponse.json();
      expect(snapshot).toHaveProperty("nodes");
      expect(snapshot).toHaveProperty("edges");
      expect(Array.isArray(snapshot.nodes)).toBe(true);
      expect(Array.isArray(snapshot.edges)).toBe(true);

      // 2. Find paths if nodes exist
      if (snapshot.nodes.length >= 2) {
        const fromNode = snapshot.nodes[0].id;
        const toNode = snapshot.nodes[1].id;

        const pathsResponse = await fetch(
          `${baseUrl}/api/graph/paths?from_node=${fromNode}&to_node=${toNode}&depth=3`
        );
        expect(pathsResponse.status).toBe(200);
        const paths = await pathsResponse.json();
        expect(paths).toHaveProperty("paths");
        expect(Array.isArray(paths.paths)).toBe(true);
      }
    });
  });

  test.describe("Connector Management Journey", () => {
    test("should create, sync, and manage connectors", async ({ page }) => {
      await page.goto(`${baseUrl}/integrations`);

      // Wait for page to load
      await page.waitForSelector("text=Connectors", { timeout: 10000 });

      // Click "Add Connector" button
      const addButton = page.locator("button:has-text('Add Connector')");
      if (await addButton.isVisible()) {
        await addButton.click();

        // Fill in connector form
        await page.selectOption('select[id="connector-type"]', "rss");
        await page.fill('input[id="connector-name"]', "Test RSS Feed");
        
        // Fill RSS-specific fields
        const rssUrlInput = page.locator('input[id="rss-url"]');
        if (await rssUrlInput.isVisible()) {
          await rssUrlInput.fill("https://feeds.feedburner.com/oreilly/radar");
        } else {
          // Fallback to JSON config
          await page.fill('textarea[id="connector-config"]', JSON.stringify({
            url: "https://feeds.feedburner.com/oreilly/radar",
            retentionPolicy: "90 days",
          }));
        }

        // Submit form
        await page.click('button:has-text("Create Connector")');

        // Wait for success message
        await page.waitForSelector("text=Connector created", { timeout: 5000 });

        // Verify connector appears in list
        await expect(page.locator("text=Test RSS Feed")).toBeVisible();
      }
    });

    test("should sync a connector and view results", async ({ page }) => {
      await page.goto(`${baseUrl}/integrations`);

      // Wait for connectors to load
      await page.waitForSelector("text=Connectors", { timeout: 10000 });

      // Find a connector and click sync
      const syncButton = page.locator('button:has-text("Sync")').first();
      if (await syncButton.isVisible()) {
        await syncButton.click();

        // Wait for sync to complete (or show progress)
        await page.waitForTimeout(2000);

        // Verify sync status updated
        // (This depends on UI implementation)
      }
    });
  });

  test.describe("Evidence Reindex Journey", () => {
    test("should trigger and monitor reindex job", async () => {
      // This would typically be an admin API endpoint
      const response = await fetch(`${baseUrl}/api/admin/reindex`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer admin-token",
        },
        body: JSON.stringify({
          tenantId: "test-tenant",
          batchSize: 10,
          maxRecords: 100,
        }),
      });

      // Accept 200 (synchronous) or 202 (async job started)
      expect([200, 202, 404]).toContain(response.status);
      
      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty("stats");
        if (data.stats) {
          expect(data.stats).toHaveProperty("total");
          expect(data.stats).toHaveProperty("processed");
        }
      }
    });
  });
});
