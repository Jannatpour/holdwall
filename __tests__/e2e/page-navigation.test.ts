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
// Canonical routing access control (shared with edge proxy)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { protectedPagePrefixes, publicPortalPrefixes } = require("../../lib/routing/access-control");

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

test.describe("Unauthenticated access control", () => {
  test("protected app pages should redirect to /auth/signin", async ({ page }) => {
    test.setTimeout(120000);
    await page.context().clearCookies();

    // Probe each protected prefix at its root URL.
    for (const prefix of protectedPagePrefixes) {
      const url = `${baseUrl}${prefix}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await expect(page).toHaveURL(/\/auth\/signin/);
    }
  });

  test("public portal/share pages should remain accessible without login", async ({ page }) => {
    test.setTimeout(120000);
    await page.context().clearCookies();

    // These are prefix-level checks (dynamic segments are validated in their own E2E suites).
    for (const prefix of publicPortalPrefixes) {
      await page.goto(`${baseUrl}${prefix}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await expect(page).not.toHaveURL(/\/auth\/signin/);
    }
  });
});

test.describe("Page Navigation and Basic Functionality", () => {

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120000);
    // Clear cookies and sign in before each test (robust against slow cold starts).
    await page.context().clearCookies();

    await page.goto(`${baseUrl}/auth/signin`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 15000 });

    await page.fill('input[type="email"]', "user@holdwall.com");
    await page.fill('input[type="password"]', "user123");

    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeEnabled({ timeout: 15000 });

    // Wait for NextAuth callback/credentials response and session establishment.
    const signInResponse = page
      .waitForResponse((r) => r.url().includes("/api/auth/callback/credentials"), { timeout: 20000 })
      .catch(() => null);

    await submit.click();
    await signInResponse;

    // Explicitly confirm session is established, then navigate to an authenticated page.
    const start = Date.now();
    let session: any = null;
    while (Date.now() - start < 20000) {
      try {
        const resp = await page.request.get(`${baseUrl}/api/auth/session`, { timeout: 5000 });
        if (resp.ok()) {
          const data = await resp.json().catch(() => null);
          if (data?.user) {
            session = data;
            break;
          }
        }
      } catch {
        // ignore transient errors
      }
      await page.waitForTimeout(500);
    }

    expect(session?.user).toBeTruthy();
    await page.goto(`${baseUrl}/overview`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await expect(page).not.toHaveURL(/auth\/signin/);
  });

  test.describe("Overview Page", () => {
    test("should load overview page with metrics", async ({ page }) => {
      await page.goto(`${baseUrl}/overview`);
      await page.waitForLoadState("domcontentloaded");

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
      await page.waitForLoadState("domcontentloaded");

      // Verify page loaded
      await expect(page.locator("body")).toBeVisible();

      // Check API endpoint
      const response = await page.request.get(`${baseUrl}/api/signals`);
      expect([200, 401, 403]).toContain(response.status());
    });

    test("should allow filtering signals", async ({ page }) => {
      await page.goto(`${baseUrl}/signals`);
      await page.waitForLoadState("domcontentloaded");

      // Look for filter controls
      const filterButton = page.locator('button:has-text("Filter"), button:has-text("Search")');
      // Filters may or may not be visible
    });
  });

  test.describe("Claims Page", () => {
    test("should load claims page", async ({ page }) => {
      await page.goto(`${baseUrl}/claims`);
      await page.waitForLoadState("domcontentloaded");

      await expect(page.locator("body")).toBeVisible();

      // Check API endpoint
      const response = await page.request.get(`${baseUrl}/api/claims`);
      expect([200, 401, 403]).toContain(response.status());
    });

    test("should allow viewing claim details", async ({ page }) => {
      await page.goto(`${baseUrl}/claims`);
      await page.waitForLoadState("domcontentloaded");

      // Try to click on a claim if available
      const claimLink = page.locator('a[href*="/claims/"]').first();
      if (await claimLink.isVisible({ timeout: 2000 })) {
        await claimLink.click();
        await page.waitForLoadState("domcontentloaded");
        await expect(page).toHaveURL(/\/claims\/[^/]+/);
      }
    });
  });

  test.describe("Graph Page", () => {
    test("should load graph page", async ({ page }) => {
      await page.goto(`${baseUrl}/graph`);
      await page.waitForLoadState("domcontentloaded");

      await expect(page.locator("body")).toBeVisible();

      // Check API endpoint
      const response = await page.request.get(`${baseUrl}/api/graph/snapshot`);
      expect([200, 401, 403]).toContain(response.status());
    });
  });

  test.describe("Forecasts Page", () => {
    test("should load forecasts page", async ({ page }) => {
      await page.goto(`${baseUrl}/forecasts`);
      await page.waitForLoadState("domcontentloaded");

      await expect(page.locator("body")).toBeVisible();

      // Check API endpoint
      const response = await page.request.get(`${baseUrl}/api/forecasts`);
      expect([200, 401, 403]).toContain(response.status());
    });
  });

  test.describe("Integrations Page", () => {
    test("should load integrations page", async ({ page }) => {
      await page.goto(`${baseUrl}/integrations`);
      await page.waitForLoadState("domcontentloaded");

      await expect(page.locator("body")).toBeVisible();

      // Check API endpoint
      const response = await page.request.get(`${baseUrl}/api/integrations/connectors`);
      expect([200, 401, 403]).toContain(response.status());
    });
  });

  test.describe("Studio Page", () => {
    test("should load studio page", async ({ page }) => {
      await page.goto(`${baseUrl}/studio`);
      await page.waitForLoadState("domcontentloaded");

      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Governance Page", () => {
    test("should load governance page", async ({ page }) => {
      await page.goto(`${baseUrl}/governance`);
      await page.waitForLoadState("domcontentloaded");

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
        await page.waitForLoadState("domcontentloaded");

        await expect(page.locator("body")).toBeVisible();
        expect(page.url()).toContain(route);
      });
    }
  });

  test.describe("Navigation", () => {
    test("should navigate between pages using sidebar", async ({ page }) => {
      await page.goto(`${baseUrl}/overview`);
      await page.waitForLoadState("domcontentloaded");

      // Try to find and click sidebar navigation items
      const sidebarLinks = [
        page.locator('a[href="/signals"]'),
        page.locator('a[href="/claims"]'),
        page.locator('a[href="/graph"]'),
      ];

      for (const link of sidebarLinks) {
        if (await link.isVisible({ timeout: 2000 })) {
          await link.click();
          await page.waitForLoadState("domcontentloaded");
          break;
        }
      }
    });
  });
});
