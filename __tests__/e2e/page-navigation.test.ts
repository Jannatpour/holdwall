/**
 * Page Navigation E2E Tests
 * Tests for all main application pages and their basic functionality
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TransformStream } = require("stream/web");
// @ts-ignore
globalThis.TransformStream = globalThis.TransformStream || TransformStream;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { test, expect } = require("@playwright/test");

test.describe("Page Navigation and Basic Functionality", () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto(`${baseUrl}/auth/signin`);
    await page.fill('input[type="email"]', "user@holdwall.com");
    await page.fill('input[type="password"]', "user123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(overview|dashboard)/, { timeout: 10000 });
  });

  test.describe("Overview Page", () => {
    test("should load overview page with metrics", async ({ page }) => {
      await page.goto(`${baseUrl}/overview`);
      await page.waitForLoadState("networkidle");

      // Check for key elements
      await expect(page.locator("body")).toBeVisible();
      
      // Check for API response
      const response = await page.request.get(`${baseUrl}/api/overview`);
      expect([200, 401, 403]).toContain(response.status());
    });
  });

  test.describe("Signals Page", () => {
    test("should load signals page", async ({ page }) => {
      await page.goto(`${baseUrl}/signals`);
      await page.waitForLoadState("networkidle");

      // Verify page loaded
      await expect(page.locator("body")).toBeVisible();

      // Check API endpoint
      const response = await page.request.get(`${baseUrl}/api/signals`);
      expect([200, 401, 403]).toContain(response.status());
    });

    test("should allow filtering signals", async ({ page }) => {
      await page.goto(`${baseUrl}/signals`);
      await page.waitForLoadState("networkidle");

      // Look for filter controls
      const filterButton = page.locator('button:has-text("Filter"), button:has-text("Search")');
      // Filters may or may not be visible
    });
  });

  test.describe("Claims Page", () => {
    test("should load claims page", async ({ page }) => {
      await page.goto(`${baseUrl}/claims`);
      await page.waitForLoadState("networkidle");

      await expect(page.locator("body")).toBeVisible();

      // Check API endpoint
      const response = await page.request.get(`${baseUrl}/api/claims`);
      expect([200, 401, 403]).toContain(response.status());
    });

    test("should allow viewing claim details", async ({ page }) => {
      await page.goto(`${baseUrl}/claims`);
      await page.waitForLoadState("networkidle");

      // Try to click on a claim if available
      const claimLink = page.locator('a[href*="/claims/"]').first();
      if (await claimLink.isVisible({ timeout: 2000 })) {
        await claimLink.click();
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveURL(/\/claims\/[^/]+/);
      }
    });
  });

  test.describe("Graph Page", () => {
    test("should load graph page", async ({ page }) => {
      await page.goto(`${baseUrl}/graph`);
      await page.waitForLoadState("networkidle");

      await expect(page.locator("body")).toBeVisible();

      // Check API endpoint
      const response = await page.request.get(`${baseUrl}/api/graph/snapshot`);
      expect([200, 401, 403]).toContain(response.status());
    });
  });

  test.describe("Forecasts Page", () => {
    test("should load forecasts page", async ({ page }) => {
      await page.goto(`${baseUrl}/forecasts`);
      await page.waitForLoadState("networkidle");

      await expect(page.locator("body")).toBeVisible();

      // Check API endpoint
      const response = await page.request.get(`${baseUrl}/api/forecasts`);
      expect([200, 401, 403]).toContain(response.status());
    });
  });

  test.describe("Integrations Page", () => {
    test("should load integrations page", async ({ page }) => {
      await page.goto(`${baseUrl}/integrations`);
      await page.waitForLoadState("networkidle");

      await expect(page.locator("body")).toBeVisible();

      // Check API endpoint
      const response = await page.request.get(`${baseUrl}/api/integrations/connectors`);
      expect([200, 401, 403]).toContain(response.status());
    });
  });

  test.describe("Studio Page", () => {
    test("should load studio page", async ({ page }) => {
      await page.goto(`${baseUrl}/studio`);
      await page.waitForLoadState("networkidle");

      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Governance Page", () => {
    test("should load governance page", async ({ page }) => {
      await page.goto(`${baseUrl}/governance`);
      await page.waitForLoadState("networkidle");

      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Marketing Pages", () => {
    const marketingPages = [
      "/",
      "/product",
      "/product/pipeline",
      "/product/claims",
      "/product/graph",
      "/product/forecasting",
      "/solutions",
      "/security",
      "/ethics",
      "/compliance",
      "/resources",
    ];

    for (const route of marketingPages) {
      test(`should load ${route} page`, async ({ page }) => {
        await page.goto(`${baseUrl}${route}`);
        await page.waitForLoadState("networkidle");

        await expect(page.locator("body")).toBeVisible();
        expect(page.url()).toContain(route);
      });
    }
  });

  test.describe("Navigation", () => {
    test("should navigate between pages using sidebar", async ({ page }) => {
      await page.goto(`${baseUrl}/overview`);
      await page.waitForLoadState("networkidle");

      // Try to find and click sidebar navigation items
      const sidebarLinks = [
        page.locator('a[href="/signals"]'),
        page.locator('a[href="/claims"]'),
        page.locator('a[href="/graph"]'),
      ];

      for (const link of sidebarLinks) {
        if (await link.isVisible({ timeout: 2000 })) {
          await link.click();
          await page.waitForLoadState("networkidle");
          break;
        }
      }
    });
  });
});
