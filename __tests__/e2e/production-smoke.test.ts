/**
 * Production Smoke Tests (real deployed environment)
 * Covers: signup → signin → session → protected pages.
 *
 * NOTE: Playwright's Node runtime expects Web Streams globals in some builds.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TransformStream } = require("stream/web");
// @ts-ignore
globalThis.TransformStream = globalThis.TransformStream || TransformStream;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { test, expect } = require("@playwright/test");

test.describe("Production Smoke - Critical Auth Journeys", () => {
  const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.holdwall.com";

  test("signup → signin → session → overview", async ({ page }) => {
    test.setTimeout(180000);

    // Some signup UIs disallow "example.com" domains; use a neutral test domain.
    const email = `smoke-${Date.now()}@smokeqa.io`;
    const password = "SmokePassword123!";

    // Sign up page loads (UI)
    await page.goto(`${baseUrl}/auth/signup`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible({ timeout: 15000 });

    // Create account via API (more stable than UI submit, which may be bot/validation gated in prod).
    const apiSignup = await page.request.post(`${baseUrl}/api/auth/signup`, {
      data: { name: "Smoke Test User", email, password },
      timeout: 20000,
    });
    expect([200, 201, 409]).toContain(apiSignup.status());

    // Sign in (UI)
    await page.goto(`${baseUrl}/auth/signin`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    const signinSubmit = page.locator('button[type="submit"]');
    await expect(signinSubmit).toBeEnabled({ timeout: 15000 });
    await signinSubmit.click();

    // Ensure session exists (poll briefly)
    const start = Date.now();
    let session = null;
    while (Date.now() - start < 30000) {
      // Use `page.request` to share browser cookies (NextAuth session cookie).
      const resp = await page.request.get(`${baseUrl}/api/auth/session`, { timeout: 10000 }).catch(() => null);
      if (resp && resp.ok()) {
        session = await resp.json().catch(() => null);
        if (session?.user) break;
      }
      await page.waitForTimeout(500);
    }
    expect(session?.user).toBeTruthy();

    // AI runtime smoke (live provider call). Keep it small to control cost.
    // 1) Embeddings (public endpoint)
    const embedResp = await page.request.post(`${baseUrl}/api/ai/semantic-search`, {
      data: { action: "embed", text: "smoke test", model: "auto" },
      timeout: 20000,
    });
    if (embedResp.status() !== 200) {
      const body = await embedResp.text().catch(() => "");
      throw new Error(`AI embeddings failed: ${embedResp.status()} ${body.slice(0, 1000)}`);
    }
    const embedJson = await embedResp.json().catch(() => null);
    expect(embedJson).toBeTruthy();

    // 2) Orchestrator (auth required). Use the default orchestrator path so it can answer
    // even when the tenant has little/no evidence yet.
    const orchResp = await page.request.get(
      `${baseUrl}/api/ai/orchestrate?query=${encodeURIComponent("Return exactly: OK")}&max_tokens=16&temperature=0`,
      { timeout: 30000 }
    );
    if (orchResp.status() !== 200) {
      const body = await orchResp.text().catch(() => "");
      throw new Error(`AI orchestrate failed: ${orchResp.status()} ${body.slice(0, 1000)}`);
    }
    const orchJson = await orchResp.json().catch(() => null);
    expect(orchJson).toBeTruthy();
    expect(typeof orchJson.trace_id).toBe("string");
    expect(typeof orchJson.answer).toBe("string");
    expect(String(orchJson.answer).trim().length).toBeGreaterThan(0);

    // Protected page should be accessible
    await page.goto(`${baseUrl}/overview`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await expect(page).not.toHaveURL(/\/auth\/signin/);
  });
});

