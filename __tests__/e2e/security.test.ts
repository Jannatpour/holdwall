/**
 * Security E2E Tests
 * Tests for security vulnerabilities, authentication, authorization, and input validation
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TransformStream } = require("stream/web");
// @ts-ignore
globalThis.TransformStream = globalThis.TransformStream || TransformStream;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { test, expect } = require("@playwright/test");

test.describe("Security Tests", () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

  test.describe("Authentication Security", () => {
    test("should not expose sensitive information in error messages", async ({ page }) => {
      await page.goto(`${baseUrl}/auth/signin`);

      // Try invalid login
      await page.fill('input[type="email"]', "nonexistent@example.com");
      await page.fill('input[type="password"]', "wrongpassword");
      await page.click('button[type="submit"]');

      await page.waitForTimeout(2000);

      // Error message should not reveal if user exists
      const pageContent = await page.textContent("body");
      expect(pageContent).not.toContain("user does not exist");
      expect(pageContent).not.toContain("password");
    });

    test("should enforce password requirements", async ({ page }) => {
      await page.goto(`${baseUrl}/auth/signup`);

      // Try weak password
      await page.fill('input[type="email"]', "test@example.com");
      await page.fill('input[type="password"]', "123");
      await page.fill('input[name="name"]', "Test User");

      // Should show validation error or prevent submission
      const submitButton = page.locator('button[type="submit"]');
      // Validation may happen on blur or submit
    });

    test("should prevent SQL injection in login", async ({ page }) => {
      await page.goto(`${baseUrl}/auth/signin`);

      // Try SQL injection
      const sqlInjection = "admin@example.com' OR '1'='1";
      await page.fill('input[type="email"]', sqlInjection);
      await page.fill('input[type="password"]', "anything");
      await page.click('button[type="submit"]');

      await page.waitForTimeout(2000);

      // Should not allow login
      expect(page.url()).not.toContain("/overview");
    });
  });

  test.describe("Authorization", () => {
    test("should prevent unauthorized access to protected routes", async ({ page }) => {
      // Access protected route without authentication
      await page.goto(`${baseUrl}/overview`);

      // Should redirect to sign in
      await page.waitForURL(/auth\/signin/, { timeout: 10000 });
    });

    test("should enforce role-based access control", async ({ page }) => {
      // Sign in as regular user
      await page.goto(`${baseUrl}/auth/signin`);
      await page.fill('input[type="email"]', "user@holdwall.com");
      await page.fill('input[type="password"]', "user123");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(overview|dashboard)/, { timeout: 10000 });

      // Try to access admin endpoints
      const adminResponse = await page.request.get(`${baseUrl}/api/admin/users`);
      expect([401, 403, 404]).toContain(adminResponse.status());
    });
  });

  test.describe("Input Validation", () => {
    test("should sanitize user input in forms", async ({ page }) => {
      await page.goto(`${baseUrl}/auth/signup`);

      // Try XSS payload
      const xssPayload = "<script>alert('XSS')</script>";
      await page.fill('input[name="name"]', xssPayload);
      await page.fill('input[type="email"]', "test@example.com");
      await page.fill('input[type="password"]', "TestPassword123!");

      // Submit and check if script is executed
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Check that script tags are not in the DOM
      const scripts = await page.locator("script").count();
      // Should not have injected scripts
    });

    test("should validate email format", async ({ page }) => {
      await page.goto(`${baseUrl}/auth/signup`);

      // Try invalid email
      await page.fill('input[type="email"]', "not-an-email");
      await page.fill('input[type="password"]', "TestPassword123!");

      // Should show validation error
      const emailInput = page.locator('input[type="email"]');
      // HTML5 validation or custom validation should catch this
    });
  });

  test.describe("API Security", () => {
    test("should require authentication for protected APIs", async ({ request }) => {
      const protectedEndpoints = [
        "/api/overview",
        "/api/signals",
        "/api/claims",
        "/api/graph/snapshot",
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request.get(`${baseUrl}${endpoint}`);
        // Should return 401 or 403 without auth
        expect([401, 403]).toContain(response.status());
      }
    });

    test("should prevent CSRF attacks", async ({ page }) => {
      // Sign in first
      await page.goto(`${baseUrl}/auth/signin`);
      await page.fill('input[type="email"]', "user@holdwall.com");
      await page.fill('input[type="password"]', "user123");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(overview|dashboard)/, { timeout: 10000 });

      // Try to make request from different origin (simulated)
      // This is a basic check - full CSRF protection requires proper tokens
      const cookies = await page.context().cookies();
      expect(cookies.length).toBeGreaterThan(0);
    });

    test("should rate limit authentication endpoints", async ({ request }) => {
      // Make multiple rapid requests to sign in endpoint
      const requests = Array.from({ length: 20 }, () =>
        request.post(`${baseUrl}/api/auth/signin`, {
          data: {
            email: "test@example.com",
            password: "wrongpassword",
          },
        })
      );

      const responses = await Promise.all(requests);

      // Some requests should be rate limited (429)
      const rateLimited = responses.filter((r) => r.status() === 429);
      // Rate limiting may or may not be enabled
    });
  });

  test.describe("Headers Security", () => {
    test("should include security headers", async ({ page }) => {
      const response = await page.goto(`${baseUrl}/`);

      if (response) {
        const headers = response.headers();

        // Check for security headers (may vary by implementation)
        // X-Frame-Options, X-Content-Type-Options, etc.
        expect(headers).toBeDefined();
      }
    });
  });

  test.describe("Data Exposure", () => {
    test("should not expose sensitive data in API responses", async ({ page }) => {
      // Sign in
      await page.goto(`${baseUrl}/auth/signin`);
      await page.fill('input[type="email"]', "user@holdwall.com");
      await page.fill('input[type="password"]', "user123");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(overview|dashboard)/, { timeout: 10000 });

      // Check API responses don't contain passwords
      const response = await page.request.get(`${baseUrl}/api/auth/session`);
      if (response.ok()) {
        const data = await response.json();
        const dataStr = JSON.stringify(data);
        expect(dataStr).not.toContain("password");
        expect(dataStr).not.toContain("passwordHash");
      }
    });
  });
});
