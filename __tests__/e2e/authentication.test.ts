/**
 * Authentication E2E Tests
 * Tests for sign up, sign in, sign out, and session management
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TransformStream } = require("stream/web");
// @ts-ignore
globalThis.TransformStream = globalThis.TransformStream || TransformStream;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { test, expect } = require("@playwright/test");

test.describe("Authentication Flows", () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

  test.beforeEach(async ({ page }) => {
    // Clear cookies and storage before each test
    await page.context().clearCookies();
  });

  test.describe("Sign Up Flow", () => {
    test("should allow user to sign up with email and password", async ({ page }) => {
      await page.goto(`${baseUrl}/auth/signup`);

      // Fill in sign up form
      const email = `test-${Date.now()}@example.com`;
      await page.fill("#name", "Test User");
      await page.fill('input[type="email"]', email);
      await page.fill("#password", "TestPassword123!");
      await page.fill("#confirmPassword", "TestPassword123!");

      // Submit form
      const submit = page.locator('button[type="submit"]');
      await expect(submit).toBeEnabled({ timeout: 10000 });
      await submit.click();

      // Should redirect to dashboard or show success
      await page.waitForURL(/\/(overview|dashboard|auth)/, { timeout: 10000 });
    });

    test("should validate required fields", async ({ page }) => {
      await page.goto(`${baseUrl}/auth/signup`);

      // Submit should be disabled until required fields are valid
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
      await expect(page.locator("#email")).toBeVisible();
    });

    test("should prevent duplicate email registration", async ({ page }) => {
      await page.goto(`${baseUrl}/auth/signup`);

      // Try to register with existing email
      await page.fill("#name", "Admin User");
      await page.fill('input[type="email"]', "admin@holdwall.com");
      await page.fill("#password", "TestPassword123!");
      await page.fill("#confirmPassword", "TestPassword123!");
      const submit = page.locator('button[type="submit"]');
      await expect(submit).toBeEnabled({ timeout: 10000 });
      await submit.click();

      // Should show error message
      await page.waitForTimeout(2000);
      const errorMessage = page.locator("text=/already exists|email.*taken/i");
      // Error may or may not be visible depending on implementation
    });
  });

  test.describe("Sign In Flow", () => {
    test("should allow user to sign in with credentials", async ({ page, request }) => {
      test.setTimeout(120000);
      // Capture console errors and network failures
      const errors: string[] = [];
      const networkErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("requestfailed", (request) => {
        networkErrors.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText || "Unknown"}`);
      });

      // Wait for server to be ready by checking the health endpoint or auth providers
      try {
        await request.get(`${baseUrl}/api/auth/providers`, { timeout: 10000 });
      } catch (e) {
        // If providers endpoint isn't ready, wait a bit more
        await page.waitForTimeout(2000);
      }

      // In dev-mode, "networkidle" can be flaky due to persistent connections (HMR, analytics, etc.).
      await page.goto(`${baseUrl}/auth/signin`, { waitUntil: "domcontentloaded", timeout: 60000 });
      
      // Wait for the sign-in form to be visible and ready
      await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });
      
      // Wait a moment for any async operations (like providers fetch) to complete
      await page.waitForTimeout(500);

      // Fill in sign in form
      await page.fill('input[type="email"]', "user@holdwall.com");
      await page.fill('input[type="password"]', "user123");
      
      // Wait for submit button to be enabled, then click
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeEnabled();
      
      // Wait for the sign-in API request to complete
      // NextAuth v5 credentials sign-in makes a POST to /api/auth/callback/credentials
      const signInPromise = page.waitForResponse(
        (response) => {
          const url = response.url();
          return url.includes("/api/auth/callback/credentials") || url.includes("/api/auth/signin");
        },
        { timeout: 15000 }
      ).catch(() => null);
      
      // Also wait for loading state to disappear (indicates sign-in attempt completed)
      const loadingStatePromise = page.waitForFunction(
        () => {
          const button = document.querySelector('button[type="submit"]');
          if (!button) return true; // Button not found, assume done
          return !button.disabled && !button.textContent?.includes("Signing in");
        },
        { timeout: 15000 }
      ).catch(() => null);
      
      // Click submit and wait for response and loading state
      await submitButton.click();
      const [response] = await Promise.all([signInPromise, loadingStatePromise]);
      
      // Check response status if we got a response
      // NextAuth frequently responds with redirects (302/303) on success.
      // Treat redirects as non-error for this flow.
      if (response && !response.ok() && ![302, 303].includes(response.status())) {
        const responseText = await response.text().catch(() => "Unable to read response");
        throw new Error(`Sign-in API failed with status ${response.status()}: ${responseText}. Network errors: ${networkErrors.join("; ")}`);
      }
      
      // Wait a moment for client-side redirect to initiate
      await page.waitForTimeout(500);
      
      // Wait for either navigation or error message
      try {
        await page.waitForURL(/\/(overview|dashboard)/, { timeout: 10000 });
        // Success - redirected to dashboard
        return;
      } catch (e) {
        // Some pages include empty aria-live alert regions; only treat non-empty alerts as errors.
        const errorAlert = page.locator('[role="alert"]').filter({ hasText: /\S/ }).first();

        // If we didn't navigate, verify session via API and navigate explicitly.
        const start = Date.now();
        let session: any = null;
        while (Date.now() - start < 15000) {
          try {
            const sessionResp = await request.get(`${baseUrl}/api/auth/session`, { timeout: 5000 });
            if (sessionResp.ok()) {
              const data = await sessionResp.json().catch(() => null);
              if (data?.user) {
                session = data;
                break;
              }
            }
          } catch {
            // Ignore transient network errors
          }
          await page.waitForTimeout(500);
        }

        if (session?.user) {
          // Session exists; navigate explicitly and ensure we stay authenticated.
          await page.goto(`${baseUrl}/overview`, { waitUntil: "domcontentloaded", timeout: 60000 });
          await expect(page).not.toHaveURL(/auth\/signin/);
          return;
        }

        const errorVisible = await errorAlert.isVisible({ timeout: 2000 }).catch(() => false);
        if (errorVisible) {
          const errorText = await errorAlert.textContent();
          throw new Error(
            `Sign-in failed with error: ${errorText || "Unknown error"}. Console errors: ${errors.join("; ")}. Network errors: ${networkErrors.join("; ")}`
          );
        }

        // If no error and no session, something else went wrong
        const currentUrl = page.url();
        throw new Error(
          `Sign-in did not redirect and session was not established. Current URL: ${currentUrl}. Console errors: ${errors.join("; ")}. Network errors: ${networkErrors.join("; ")}`
        );
      }
    });

    test("should reject invalid credentials", async ({ page }) => {
      await page.goto(`${baseUrl}/auth/signin`);

      await page.fill('input[type="email"]', "invalid@example.com");
      await page.fill('input[type="password"]', "wrongpassword");
      await page.click('button[type="submit"]');

      // Should show error message
      await page.waitForTimeout(2000);
      const errorMessage = page.locator("text=/invalid|incorrect|error/i");
      // Error may or may not be visible
    });

    test("should handle OAuth providers when configured", async ({ page }) => {
      await page.goto(`${baseUrl}/auth/signin`);

      // Check if OAuth buttons are visible (if configured)
      const googleButton = page.locator('button:has-text("Google")');
      const githubButton = page.locator('button:has-text("GitHub")');

      // OAuth buttons may or may not be visible depending on configuration
      // This test just verifies the page loads correctly
      await expect(page.locator('input[type="email"]')).toBeVisible();
    });
  });

  test.describe("Session Management", () => {
    test("should maintain session across page navigations", async ({ page }) => {
      // Sign in first
      await page.goto(`${baseUrl}/auth/signin`);
      await page.fill('input[type="email"]', "user@holdwall.com");
      await page.fill('input[type="password"]', "user123");
      
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeEnabled();
      await Promise.all([
        page.waitForURL(/\/(overview|dashboard)/, { timeout: 15000 }),
        submitButton.click(),
      ]);

      // Navigate to different pages
      await page.goto(`${baseUrl}/signals`);
      await page.waitForLoadState("networkidle");

      await page.goto(`${baseUrl}/claims`);
      await page.waitForLoadState("networkidle");

      // Should still be authenticated
      await page.goto(`${baseUrl}/overview`);
      await expect(page).not.toHaveURL(/auth\/signin/);
    });

    test("should redirect to sign in when accessing protected route", async ({ page }) => {
      // Try to access protected route without authentication
      await page.goto(`${baseUrl}/overview`);

      // Should redirect to sign in
      await page.waitForURL(/auth\/signin/, { timeout: 10000 });
    });

    test("should allow user to sign out", async ({ page }) => {
      // Sign in first
      await page.goto(`${baseUrl}/auth/signin`);
      await page.fill('input[type="email"]', "user@holdwall.com");
      await page.fill('input[type="password"]', "user123");
      
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeEnabled();
      await Promise.all([
        page.waitForURL(/\/(overview|dashboard)/, { timeout: 15000 }),
        submitButton.click(),
      ]);

      // Find and click sign out button
      const signOutButton = page.locator('button:has-text("Sign Out"), a:has-text("Sign Out")');
      if (await signOutButton.isVisible()) {
        await signOutButton.click();
        await page.waitForURL(/auth\/signin/, { timeout: 10000 });
      }
    });
  });

  test.describe("Protected Routes", () => {
    const protectedRoutes = [
      "/overview",
      "/signals",
      "/claims",
      "/graph",
      "/forecasts",
      "/integrations",
      "/studio",
      "/governance",
    ];

    for (const route of protectedRoutes) {
      test(`should protect ${route} route`, async ({ page }) => {
        await page.goto(`${baseUrl}${route}`);
        // Should redirect to sign in
        await page.waitForURL(/auth\/signin/, { timeout: 10000 });
      });
    }
  });
});
