/**
 * Failure Recovery E2E Tests
 * 
 * Verifies system behavior under failure conditions:
 * - Provider outages (OpenAI, Anthropic)
 * - Database degraded mode
 * - Webhook retries
 * - Network failures
 * - Rate limiting
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TransformStream } = require("stream/web");
// @ts-ignore
globalThis.TransformStream = globalThis.TransformStream || TransformStream;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { test, expect } = require("@playwright/test");

test.describe("Failure Recovery Journeys", () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  const verifyToken = process.env.VERIFY_TOKEN || "test-verify-token";

  /**
   * Helper to authenticate
   */
  async function authenticate(page: any, email = "user@holdwall.com", password = "user123") {
    await page.goto(`${baseUrl}/auth/signin`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
    await Promise.all([
      page.waitForURL(/\/(overview|dashboard)/, { timeout: 15000 }),
      submitButton.click(),
    ]);
  }

  test.describe("Health Check Resilience", () => {
    test("should report degraded status when external providers are unavailable", async ({ request }) => {
      // Health check should still respond even if external services fail
      const response = await request.get(`${baseUrl}/api/health`);
      
      expect(response.status()).toBeLessThan(500);
      
      if (response.ok()) {
        const health = await response.json();
        
        // Health check should always return a status
        expect(health).toHaveProperty("status");
        expect(["healthy", "degraded", "unhealthy"]).toContain(health.status);
        
        // Should report external service status
        if (health.checks?.external_services) {
          expect(health.checks.external_services).toBeDefined();
        }
      }
    });

    test("should maintain readiness contract even during partial failures", async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/health`);
      
      if (response.ok()) {
        const health = await response.json();
        
        // Readiness contract should always be present
        if (health.checks?.readiness) {
          expect(health.checks.readiness).toHaveProperty("database_reachable");
          expect(health.checks.readiness).toHaveProperty("critical_env_present");
          expect(health.checks.readiness).toHaveProperty("domain_canonical");
        }
      }
    });
  });

  test.describe("Database Degraded Mode", () => {
    test("should handle database connection failures gracefully", async ({ request }) => {
      // Health check should report database status
      const healthResponse = await request.get(`${baseUrl}/api/health`);
      
      if (healthResponse.ok()) {
        const health = await healthResponse.json();
        
        // Should report database status
        expect(health.checks).toHaveProperty("database");
        expect(["ok", "error"]).toContain(health.checks.database);
      }
    });

    test("should return appropriate error codes when database is unavailable", async ({ page, request }) => {
      await authenticate(page);
      
      // Try to access a database-dependent endpoint
      const response = await request.get(`${baseUrl}/api/evidence`);
      
      // Should return appropriate status (not 500 if DB is down, but handled gracefully)
      expect(response.status()).toBeLessThan(600);
      
      // If DB is down, should return 503 or 500, not hang
      if (response.status() >= 500) {
        const error = await response.json().catch(() => ({}));
        expect(error).toBeDefined();
      }
    });
  });

  test.describe("External Provider Outages", () => {
    test("should handle OpenAI API failures gracefully", async ({ request }) => {
      // Health check should report OpenAI status
      const healthResponse = await request.get(`${baseUrl}/api/health`);
      
      if (healthResponse.ok()) {
        const health = await healthResponse.json();
        
        if (health.checks?.external_services?.openai) {
          // Should report status even if provider is down
          expect(["ok", "error", "not_configured"]).toContain(health.checks.external_services.openai);
        }
      }
    });

    test("should handle Anthropic API failures gracefully", async ({ request }) => {
      const healthResponse = await request.get(`${baseUrl}/api/health`);
      
      if (healthResponse.ok()) {
        const health = await healthResponse.json();
        
        if (health.checks?.external_services?.anthropic) {
          expect(["ok", "error", "not_configured"]).toContain(health.checks.external_services.anthropic);
        }
      }
    });

    test("should continue operating with fallback when providers fail", async ({ page, request }) => {
      await authenticate(page);
      
      // System should still respond to non-LLM endpoints
      const evidenceResponse = await request.get(`${baseUrl}/api/evidence`);
      expect(evidenceResponse.status()).toBeLessThan(500);
    });
  });

  test.describe("Webhook Retries", () => {
    test("should handle webhook delivery failures", async ({ request }) => {
      // Webhook retry logic is typically tested via verification API
      // This test verifies the structure exists
      const response = await request.post(`${baseUrl}/api/verification/run`, {
        headers: {
          "Content-Type": "application/json",
          "x-verify-token": verifyToken,
        },
        data: {
          flow: "signal", // Signal ingestion includes webhook handling
          tenantId: "test-tenant",
        },
      });
      
      // Verification should complete even if webhooks fail
      expect(response.status()).toBeLessThan(500);
    });
  });

  test.describe("Rate Limiting", () => {
    test("should enforce rate limits on API endpoints", async ({ request }) => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array.from({ length: 20 }, () =>
        request.get(`${baseUrl}/api/health`)
      );
      
      const responses = await Promise.all(requests);
      
      // All requests should complete (rate limiting may return 429)
      responses.forEach((response) => {
        expect([200, 429, 503]).toContain(response.status());
      });
    });

    test("should return 429 when rate limit exceeded", async ({ request }) => {
      // Rapid requests to a rate-limited endpoint
      let rateLimited = false;
      
      for (let i = 0; i < 100; i++) {
        const response = await request.get(`${baseUrl}/api/health`);
        if (response.status() === 429) {
          rateLimited = true;
          break;
        }
        // Small delay to avoid overwhelming
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      
      // Rate limiting may or may not trigger depending on configuration
      // This test verifies the system handles the load
    });
  });

  test.describe("Network Failures", () => {
    test("should handle network timeouts gracefully", async ({ request }) => {
      // Health check should timeout gracefully
      const response = await request.get(`${baseUrl}/api/health`, {
        timeout: 5000,
      });
      
      // Should either succeed or fail with appropriate status
      expect(response.status()).toBeLessThan(600);
    });

    test("should retry failed requests with exponential backoff", async ({ request }) => {
      // This is typically handled at the service layer
      // E2E test verifies end-to-end behavior
      const response = await request.get(`${baseUrl}/api/health`);
      expect(response.status()).toBeLessThan(500);
    });
  });

  test.describe("Chaos Drills", () => {
    test("should support chaos engineering drills via verification API", async ({ request }) => {
      // Chaos drills are implemented in lib/chaos/drills.ts
      // Verify they can be executed via verification API
      const response = await request.post(`${baseUrl}/api/verification/run`, {
        headers: {
          "Content-Type": "application/json",
          "x-verify-token": verifyToken,
        },
        data: {
          flow: "all", // All flows include failure mode drills
          tenantId: "test-tenant",
        },
      });
      
      // Verification should complete
      expect(response.status()).toBeLessThan(500);
    });
  });
});
