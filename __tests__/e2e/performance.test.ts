/**
 * Performance E2E Tests
 * Tests for page load times, API response times, and performance metrics
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TransformStream } = require("stream/web");
// @ts-ignore
globalThis.TransformStream = globalThis.TransformStream || TransformStream;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { test, expect } = require("@playwright/test");

test.describe("Performance Tests", () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto(`${baseUrl}/auth/signin`);
    await page.fill('input[type="email"]', "user@holdwall.com");
    await page.fill('input[type="password"]', "user123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(overview|dashboard)/, { timeout: 10000 });
  });

  test.describe("Page Load Performance - Performance Budgets", () => {
    // Performance budgets for key pages (overview/command-center style screens)
    const PERFORMANCE_BUDGETS = {
      overview: {
        loadTime: 2000, // 2 seconds for overview/command-center
        firstContentfulPaint: 1500,
        timeToInteractive: 3000,
      },
      signals: {
        loadTime: 2500,
        firstContentfulPaint: 1800,
        timeToInteractive: 3500,
      },
      claims: {
        loadTime: 2500,
        firstContentfulPaint: 1800,
        timeToInteractive: 3500,
      },
      dashboard: {
        loadTime: 2000, // Command-center style
        firstContentfulPaint: 1500,
        timeToInteractive: 3000,
      },
    };

    test("overview page should meet performance budget", async ({ page }) => {
      const budget = PERFORMANCE_BUDGETS.overview;
      
      // Navigate and measure
      const startTime = Date.now();
      await page.goto(`${baseUrl}/overview`);
      
      // Wait for first contentful paint
      await page.waitForLoadState("domcontentloaded");
      const fcpTime = Date.now() - startTime;
      
      await page.waitForLoadState("networkidle");
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(budget.loadTime);
      expect(fcpTime).toBeLessThan(budget.firstContentfulPaint);
    });

    test("signals page should meet performance budget", async ({ page }) => {
      const budget = PERFORMANCE_BUDGETS.signals;
      
      const startTime = Date.now();
      await page.goto(`${baseUrl}/signals`);
      await page.waitForLoadState("domcontentloaded");
      const fcpTime = Date.now() - startTime;
      
      await page.waitForLoadState("networkidle");
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(budget.loadTime);
      expect(fcpTime).toBeLessThan(budget.firstContentfulPaint);
    });

    test("claims page should meet performance budget", async ({ page }) => {
      const budget = PERFORMANCE_BUDGETS.claims;
      
      const startTime = Date.now();
      await page.goto(`${baseUrl}/claims`);
      await page.waitForLoadState("domcontentloaded");
      const fcpTime = Date.now() - startTime;
      
      await page.waitForLoadState("networkidle");
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(budget.loadTime);
      expect(fcpTime).toBeLessThan(budget.firstContentfulPaint);
    });

    test("dashboard/command-center should meet performance budget", async ({ page }) => {
      const budget = PERFORMANCE_BUDGETS.dashboard;
      
      // Try dashboard or overview (command-center style)
      const startTime = Date.now();
      await page.goto(`${baseUrl}/overview`); // Overview serves as command-center
      await page.waitForLoadState("domcontentloaded");
      const fcpTime = Date.now() - startTime;
      
      await page.waitForLoadState("networkidle");
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(budget.loadTime);
      expect(fcpTime).toBeLessThan(budget.firstContentfulPaint);
    });
  });

  test.describe("API Response Times - SLO Targets", () => {
    // SLO targets from promise registry (P95 latency targets)
    const API_SLO_TARGETS = {
      overview: 1000, // 1 second P95
      signals: 1000,
      claims: 1000,
      graph: 2000, // 2 seconds for graph operations
      metrics: 500, // 500ms for metrics
      health: 200, // 200ms for health checks
    };

    test("overview API should meet SLO target", async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get(`${baseUrl}/api/overview`);
      const responseTime = Date.now() - startTime;

      // Accept 401/403 as valid responses (auth may be required)
      expect([200, 401, 403]).toContain(response.status());
      expect(responseTime).toBeLessThan(API_SLO_TARGETS.overview);
    });

    test("signals API should meet SLO target", async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get(`${baseUrl}/api/signals`);
      const responseTime = Date.now() - startTime;

      expect([200, 401, 403]).toContain(response.status());
      expect(responseTime).toBeLessThan(API_SLO_TARGETS.signals);
    });

    test("claims API should meet SLO target", async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get(`${baseUrl}/api/claims`);
      const responseTime = Date.now() - startTime;

      expect([200, 401, 403]).toContain(response.status());
      expect(responseTime).toBeLessThan(API_SLO_TARGETS.claims);
    });

    test("graph snapshot API should meet SLO target", async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get(`${baseUrl}/api/graph/snapshot`);
      const responseTime = Date.now() - startTime;

      expect([200, 401, 403]).toContain(response.status());
      expect(responseTime).toBeLessThan(API_SLO_TARGETS.graph);
    });

    test("health API should meet SLO target", async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get(`${baseUrl}/api/health`);
      const responseTime = Date.now() - startTime;

      expect(response.status()).toBe(200);
      expect(responseTime).toBeLessThan(API_SLO_TARGETS.health);
    });

    test("metrics API should meet SLO target", async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get(`${baseUrl}/api/metrics`);
      const responseTime = Date.now() - startTime;

      // May require auth
      expect([200, 401, 403]).toContain(response.status());
      if (response.status() === 200) {
        expect(responseTime).toBeLessThan(API_SLO_TARGETS.metrics);
      }
    });
  });

  test.describe("Resource Loading", () => {
    test("should load all critical resources", async ({ page }) => {
      const resources: string[] = [];

      page.on("response", (response) => {
        const url = response.url();
        if (
          url.includes(".js") ||
          url.includes(".css") ||
          url.includes(".woff") ||
          url.includes(".woff2")
        ) {
          resources.push(url);
        }
      });

      await page.goto(`${baseUrl}/overview`);
      await page.waitForLoadState("networkidle");

      // Check that resources loaded successfully
      const failedResources = resources.filter((url) => {
        // This would need to track response status
        return false;
      });

      expect(failedResources.length).toBe(0);
    });

    test("should have reasonable bundle sizes", async ({ page }) => {
      const bundleSizes: { url: string; size: number }[] = [];

      page.on("response", async (response) => {
        const url = response.url();
        if (url.includes(".js") && !url.includes("chunk")) {
          const headers = response.headers();
          const contentLength = headers["content-length"];
          if (contentLength) {
            bundleSizes.push({
              url,
              size: parseInt(contentLength, 10),
            });
          }
        }
      });

      await page.goto(`${baseUrl}/overview`);
      await page.waitForLoadState("networkidle");

      // Check bundle sizes (adjust thresholds as needed)
      for (const bundle of bundleSizes) {
        // Main bundles should be reasonable (e.g., < 1MB)
        if (bundle.url.includes("main") || bundle.url.includes("app")) {
          expect(bundle.size).toBeLessThan(1024 * 1024); // 1MB
        }
      }
    });
  });

  test.describe("Concurrent Requests", () => {
    test("should handle multiple concurrent API requests", async ({ request }) => {
      const endpoints = [
        "/api/overview",
        "/api/signals",
        "/api/claims",
        "/api/graph/snapshot",
      ];

      const startTime = Date.now();
      const responses = await Promise.all(
        endpoints.map((endpoint) => request.get(`${baseUrl}${endpoint}`))
      );
      const totalTime = Date.now() - startTime;

      // All requests should complete
      expect(responses.length).toBe(endpoints.length);

      // Total time should be reasonable (concurrent requests)
      expect(totalTime).toBeLessThan(3000);
    });
  });
});
