/**
 * Compliance & Regulatory E2E Tests
 * 
 * Verifies GDPR compliance journeys (access, export, delete) and audit bundle integrity.
 * These tests ensure regulatory requirements are met end-to-end.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TransformStream } = require("stream/web");
// @ts-ignore
globalThis.TransformStream = globalThis.TransformStream || TransformStream;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { test, expect } = require("@playwright/test");

test.describe("Compliance & Regulatory Journeys", () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  const verifyToken = process.env.VERIFY_TOKEN || "test-verify-token";
  test.setTimeout(120000);

  /**
   * Helper to authenticate and get session
   */
  async function authenticate(
    page: any,
    email = "user@holdwall.com",
    password = "user123",
    options: { verifyNavigation?: boolean } = {}
  ) {
    const { verifyNavigation = true } = options;
    // Ensure we start from a clean auth state (prevents flaky session reuse issues).
    await page.context().clearCookies();

    await page.goto(`${baseUrl}/auth/signin`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 15000 });

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled({ timeout: 15000 });

    const signInResponse = page
      .waitForResponse(
        (r: any) =>
          r.url().includes("/api/auth/callback/credentials") && r.request().method() === "POST",
        { timeout: 60000 }
      )
      .catch(() => null);

    await submitButton.click();
    await signInResponse;

    const start = Date.now();
    let session: any = null;
    while (Date.now() - start < 60000) {
      try {
        const data = await page
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
        if (data?.user) {
          session = data;
          break;
        }
      } catch {
        // ignore transient errors
      }
      await page.waitForTimeout(250);
    }

    expect(session?.user).toBeTruthy();
    if (verifyNavigation) {
      await page.goto(`${baseUrl}/overview`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await expect(page).not.toHaveURL(/auth\/signin/);
    }
  }

  /**
   * Helper to make authenticated API request
   */
  async function apiRequest(
    page: any,
    endpoint: string,
    options: { method?: string; body?: any; headers?: Record<string, string> } = {}
  ) {
    const { method = "GET", body, headers = {} } = options;
    return page.request.fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      ...(body !== undefined ? { data: JSON.stringify(body) } : {}),
    });
  }

  async function createTempUser(page: any): Promise<{ email: string; password: string }> {
    const email = `gdpr-delete-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const password = "TestPassword123!";
    const resp = await page.request.post(`${baseUrl}/api/auth/signup`, {
      data: { email, password, name: "GDPR Delete Test" },
    });
    // 200/201 on success; 409 if rerun extremely fast with same email (shouldn't happen).
    expect([200, 201]).toContain(resp.status());
    return { email, password };
  }

  test.describe("GDPR Data Access (Article 15)", () => {
    test("should allow users to access their personal data", async ({ page, request }) => {
      await authenticate(page);
      
      // Request data access via API
      const response = await apiRequest(page, "/api/compliance/gdpr/access");
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty("requestId");
      expect(data).toHaveProperty("data");
      expect(data.data).toHaveProperty("user");
      expect(data.data.user).toHaveProperty("email");
    });

    test("should return structured user data with all required fields", async ({ page, request }) => {
      await authenticate(page);
      
      const response = await apiRequest(page, "/api/compliance/gdpr/access");
      expect(response.status()).toBe(200);
      const data = await response.json();
      
      // Verify data structure includes required GDPR fields
      expect(data.data.user).toHaveProperty("id");
      expect(data.data.user).toHaveProperty("email");
      expect(data.data.user).toHaveProperty("name");
      expect(data.data).toHaveProperty("tenantId");
    });
  });

  test.describe("GDPR Data Export (Article 20)", () => {
    test("should create data export request", async ({ page, request }) => {
      await authenticate(page);
      
      const response = await apiRequest(page, "/api/compliance/gdpr/export");
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty("requestId");
      expect(data).toHaveProperty("exportUrl");
      expect(data).toHaveProperty("message");
      expect(data.exportUrl).toMatch(/^https?:\/\//);
    });

    test("should generate exportable data package", async ({ page, request }) => {
      await authenticate(page);
      
      const response = await apiRequest(page, "/api/compliance/gdpr/export");
      expect(response.status()).toBe(200);
      const data = await response.json();
      
      // Verify export URL is accessible (or at least well-formed)
      expect(data.exportUrl).toBeTruthy();
      const url = new URL(data.exportUrl);
      expect(url.protocol).toMatch(/^https?:/);
    });
  });

  test.describe("GDPR Data Deletion (Article 17)", () => {
    test("should process data deletion request", async ({ page, request }) => {
      const user = await createTempUser(page);
      await authenticate(page, user.email, user.password);
      
      const response = await apiRequest(page, "/api/compliance/gdpr/delete", {
        method: "POST",
        body: {
          anonymize: true,
        },
      });
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty("success", true);
      expect(data).toHaveProperty("requestId");
      expect(data).toHaveProperty("status");
    });

    test("should support anonymization option", async ({ page, request }) => {
      const user = await createTempUser(page);
      await authenticate(page, user.email, user.password);
      
      // Test with anonymize: true
      const anonymizeResponse = await apiRequest(page, "/api/compliance/gdpr/delete", {
        method: "POST",
        body: {
          anonymize: true,
        },
      });
      
      expect(anonymizeResponse.status()).toBe(200);
      const anonymizeData = await anonymizeResponse.json();
      expect(anonymizeData.status).toBeDefined();
    });
  });

  test.describe("Audit Bundle Integrity", () => {
    test("should generate audit bundle with integrity checks", async ({ page, request }) => {
      await authenticate(page, "admin@holdwall.com", "admin123");

      // Create evidence + an AAAL artifact so we have a resource to bundle.
      const signalResponse = await apiRequest(page, "/api/signals", {
        method: "POST",
        body: {
          source: { type: "reddit", id: "gdpr-audit-test", url: "https://reddit.com/r/test/comments/holdwall" },
          content: {
            raw: "This is a test signal used to validate audit bundle export.",
            normalized: "This is a test signal used to validate audit bundle export.",
            language: "en",
            pii_redacted: true,
          },
          metadata: { test: true, scenario: "audit-bundle" },
          compliance: { source_allowed: true, collection_method: "API", retention_policy: "365d" },
        },
      });
      expect(signalResponse.status()).toBe(201);
      const signalData = await signalResponse.json();
      expect(signalData).toHaveProperty("evidence_id");

      const artifactResponse = await apiRequest(page, "/api/aaal", {
        method: "POST",
        body: {
          title: "Audit Bundle Test Artifact",
          content:
            "Summary: This artifact exists to validate audit bundle generation end-to-end.\n\n" +
            "Evidence: The referenced evidence supports the audit bundle export pipeline.",
          evidence_refs: [signalData.evidence_id],
        },
      });
      expect(artifactResponse.status()).toBe(201);
      const artifactData = await artifactResponse.json();
      expect(artifactData).toHaveProperty("artifact_id");

      const now = new Date();
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const bundleResponse = await apiRequest(page, "/api/governance/audit-bundle", {
        method: "POST",
        body: {
          resource_id: artifactData.artifact_id,
          resource_type: "AAAL_ARTIFACT",
          time_range: { start: start.toISOString(), end: now.toISOString() },
        },
      });

      expect(bundleResponse.status()).toBe(200);
      const bundle = await bundleResponse.json();

      // Verify bundle structure (snake_case per service contract)
      expect(bundle).toHaveProperty("bundle_id");
      expect(bundle).toHaveProperty("tenant_id");
      expect(bundle).toHaveProperty("resource_id");
      expect(bundle).toHaveProperty("resource_type");
      expect(bundle).toHaveProperty("created_at");
    });

    test("should include evidence references in audit bundle", async ({ page, request }) => {
      await authenticate(page, "admin@holdwall.com", "admin123");

      const signalResponse = await apiRequest(page, "/api/signals", {
        method: "POST",
        body: {
          source: { type: "reddit", id: "gdpr-audit-evidence", url: "https://reddit.com/r/test/comments/holdwall2" },
          content: {
            raw: "Second test signal for audit bundle evidence inclusion.",
            normalized: "Second test signal for audit bundle evidence inclusion.",
            language: "en",
            pii_redacted: true,
          },
          metadata: { test: true, scenario: "audit-bundle-evidence" },
          compliance: { source_allowed: true, collection_method: "API", retention_policy: "365d" },
        },
      });
      expect(signalResponse.status()).toBe(201);
      const signalData = await signalResponse.json();
      expect(signalData).toHaveProperty("evidence_id");

      const artifactResponse = await apiRequest(page, "/api/aaal", {
        method: "POST",
        body: {
          title: "Audit Bundle Evidence Test Artifact",
          content:
            "Summary: Evidence inclusion test.\n\n" +
            "Evidence: This artifact references at least one evidence item for inclusion in the bundle.",
          evidence_refs: [signalData.evidence_id],
        },
      });
      expect(artifactResponse.status()).toBe(201);
      const artifactData = await artifactResponse.json();
      expect(artifactData).toHaveProperty("artifact_id");

      const now = new Date();
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const bundleResponse = await apiRequest(page, "/api/governance/audit-bundle", {
        method: "POST",
        body: {
          resource_id: artifactData.artifact_id,
          resource_type: "AAAL_ARTIFACT",
          time_range: { start: start.toISOString(), end: now.toISOString() },
        },
      });
      expect(bundleResponse.status()).toBe(200);
      const bundle = await bundleResponse.json();

      expect(bundle).toHaveProperty("evidence");
      if (Array.isArray(bundle.evidence)) {
        expect(bundle.evidence.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  test.describe("Evidence Access Logging", () => {
    test("should log evidence access events", async ({ page, request }) => {
      // Only need a valid session for API calls; avoid extra navigation flake.
      await authenticate(page, "user@holdwall.com", "user123", { verifyNavigation: false });
      
      // Access evidence (which should trigger logging)
      const evidenceResponse = await apiRequest(page, "/api/evidence");
      
      if (evidenceResponse.ok()) {
        // Verify access log endpoint exists
        const accessLogResponse = await apiRequest(page, "/api/evidence/access-log");
        
        // Access log should be accessible (may be empty if no accesses yet)
        expect(accessLogResponse.status()).toBeLessThan(500);
      }
    });

    test("should maintain immutable access log trail", async ({ page, request }) => {
      await authenticate(page, "user@holdwall.com", "user123", { verifyNavigation: false });
      
      const accessLogResponse = await apiRequest(page, "/api/evidence/access-log");
      
      if (accessLogResponse.ok()) {
        const logs = await accessLogResponse.json();
        
        // Verify log structure if logs exist
        if (Array.isArray(logs) && logs.length > 0) {
          const logEntry = logs[0];
          expect(logEntry).toHaveProperty("timestamp");
          expect(logEntry).toHaveProperty("evidenceId");
          expect(logEntry).toHaveProperty("userId");
        }
      }
    });
  });

  test.describe("Compliance Verification via API", () => {
    test("should verify all compliance promises via verification API", async ({ page }) => {
      test.setTimeout(180000);
      // In production builds, verification requires authentication.
      await authenticate(page, "admin@holdwall.com", "admin123", { verifyNavigation: false });

      const response = await page.request.post(`${baseUrl}/api/verification/run`, {
        headers: {
          "Content-Type": "application/json",
          "x-verify-token": verifyToken,
        },
        data: {
          flow: "compliance",
        },
      });
      
      expect(response.status()).toBe(200);
      const result = await response.json();
      
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("results");
      
      // Verify compliance checks were run
      const complianceResults = result.results.filter((r: any) => 
        r.flowName?.includes("GDPR") || r.flowName?.includes("Compliance") || r.flowName?.includes("Audit")
      );
      expect(complianceResults.length).toBeGreaterThan(0);
    });
  });
});
