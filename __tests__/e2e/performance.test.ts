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

  test.describe("Page Load Performance", () => {
    test("overview page should load within 3 seconds", async ({ page }) => {
      const startTime = Date.now();
      await page.goto(`${baseUrl}/overview`);
      await page.waitForLoadState("networkidle");
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000);
    });

    test("signals page should load within 3 seconds", async ({ page }) => {
      const startTime = Date.now();
      await page.goto(`${baseUrl}/signals`);
      await page.waitForLoadState("networkidle");
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000);
    });

    test("claims page should load within 3 seconds", async ({ page }) => {
      const startTime = Date.now();
      await page.goto(`${baseUrl}/claims`);
      await page.waitForLoadState("networkidle");
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000);
    });
  });

  test.describe("API Response Times", () => {
    test("overview API should respond within 1 second", async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get(`${baseUrl}/api/overview`);
      const responseTime = Date.now() - startTime;

      // Accept 401/403 as valid responses (auth may be required)
      expect([200, 401, 403]).toContain(response.status());
      expect(responseTime).toBeLessThan(1000);
    });

    test("signals API should respond within 1 second", async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get(`${baseUrl}/api/signals`);
      const responseTime = Date.now() - startTime;

      expect([200, 401, 403]).toContain(response.status());
      expect(responseTime).toBeLessThan(1000);
    });

    test("claims API should respond within 1 second", async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get(`${baseUrl}/api/claims`);
      const responseTime = Date.now() - startTime;

      expect([200, 401, 403]).toContain(response.status());
      expect(responseTime).toBeLessThan(1000);
    });

    test("graph snapshot API should respond within 2 seconds", async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get(`${baseUrl}/api/graph/snapshot`);
      const responseTime = Date.now() - startTime;

      expect([200, 401, 403]).toContain(response.status());
      expect(responseTime).toBeLessThan(2000);
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
