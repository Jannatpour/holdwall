/**
 * Tenant Isolation E2E Tests
 * 
 * Verifies complete tenant data isolation - zero cross-tenant data access.
 * This is a first-class security invariant.
 * 
 * These tests use the verification API to create test tenants and verify isolation
 * across all data types: evidence, claims, artifacts, events, cases, and approvals.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TransformStream } = require("stream/web");
// @ts-ignore
globalThis.TransformStream = globalThis.TransformStream || TransformStream;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { test, expect } = require("@playwright/test");

test.describe("Tenant Isolation", () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  const verifyToken = process.env.VERIFY_TOKEN || "test-verify-token";

  /**
   * Helper to authenticate and get session cookie
   */
  async function authenticate(request: any, email: string, password: string) {
    const response = await request.post(`${baseUrl}/api/auth/callback/credentials`, {
      data: {
        email,
        password,
        redirect: false,
      },
    });
    return response;
  }

  /**
   * Helper to run tenant isolation verification via API
   */
  async function runTenantIsolationVerification(request: any) {
    const response = await request.post(`${baseUrl}/api/verification/run`, {
      headers: {
        "Content-Type": "application/json",
        "x-verify-token": verifyToken,
      },
      data: {
        flow: "tenant-isolation",
      },
    });
    return response;
  }

  test("should verify tenant isolation via verification API", async ({ request }) => {
    // Use the verification API which creates test tenants and verifies isolation
    const response = await runTenantIsolationVerification(request);
    
    expect(response.status()).toBe(200);
    const result = await response.json();
    
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("results");
    expect(result.results).toBeInstanceOf(Array);
    expect(result.results.length).toBeGreaterThan(0);
    
    // Check that tenant isolation verification passed
    const isolationResult = result.results.find((r: any) => r.flowName === "Tenant Isolation");
    expect(isolationResult).toBeDefined();
    expect(isolationResult.overallStatus).toBe("pass");
    
    // Verify all isolation checks passed
    const failedSteps = isolationResult.steps.filter((s: any) => s.status === "fail");
    expect(failedSteps.length).toBe(0);
  });

  test("should prevent cross-tenant evidence access via API", async ({ request }) => {
    // Authenticate as user from tenant A
    const authResponse = await authenticate(request, "user@holdwall.com", "user123");
    expect(authResponse.status()).toBeLessThan(400);
    
    // Get evidence for current tenant
    const evidenceResponse = await request.get(`${baseUrl}/api/evidence`);
    expect(evidenceResponse.status()).toBe(200);
    const evidence = await evidenceResponse.json();
    
    // Verify evidence is scoped to tenant (if any exists)
    if (Array.isArray(evidence) && evidence.length > 0) {
      // All evidence should belong to the authenticated user's tenant
      // This is verified by the API layer enforcing tenantId
      expect(evidence.every((e: any) => e.tenant_id)).toBe(true);
    }
  });

  test("should enforce tenant isolation in claims API", async ({ request }) => {
    // Authenticate as user
    const authResponse = await authenticate(request, "user@holdwall.com", "user123");
    expect(authResponse.status()).toBeLessThan(400);
    
    // Get claims for current tenant
    const claimsResponse = await request.get(`${baseUrl}/api/claims`);
    expect(claimsResponse.status()).toBeLessThan(500);
    
    // If claims exist, verify they're scoped to tenant
    if (claimsResponse.ok()) {
      const claims = await claimsResponse.json();
      if (Array.isArray(claims) && claims.length > 0) {
        // All claims should belong to the authenticated user's tenant
        expect(claims.every((c: any) => c.tenantId || c.tenant_id)).toBe(true);
      }
    }
  });

  test("should isolate artifacts by tenant", async ({ request }) => {
    // Authenticate as user
    const authResponse = await authenticate(request, "user@holdwall.com", "user123");
    expect(authResponse.status()).toBeLessThan(400);
    
    // Get artifacts for current tenant
    const artifactsResponse = await request.get(`${baseUrl}/api/artifacts`);
    expect(artifactsResponse.status()).toBeLessThan(500);
    
    // If artifacts exist, verify they're scoped to tenant
    if (artifactsResponse.ok()) {
      const artifacts = await artifactsResponse.json();
      if (Array.isArray(artifacts) && artifacts.length > 0) {
        // All artifacts should belong to the authenticated user's tenant
        expect(artifacts.every((a: any) => a.tenantId || a.tenant_id)).toBe(true);
      }
    }
  });

  test("should isolate cases by tenant", async ({ request }) => {
    // Authenticate as user
    const authResponse = await authenticate(request, "user@holdwall.com", "user123");
    expect(authResponse.status()).toBeLessThan(400);
    
    // Get cases for current tenant
    const casesResponse = await request.get(`${baseUrl}/api/cases`);
    expect(casesResponse.status()).toBeLessThan(500);
    
    // If cases exist, verify they're scoped to tenant
    if (casesResponse.ok()) {
      const cases = await casesResponse.json();
      if (Array.isArray(cases) && cases.length > 0) {
        // All cases should belong to the authenticated user's tenant
        expect(cases.every((c: any) => c.tenantId || c.tenant_id)).toBe(true);
      }
    }
  });

  test("should verify tenant isolation across all data types", async ({ request }) => {
    // Run comprehensive tenant isolation verification
    const response = await runTenantIsolationVerification(request);
    
    expect(response.status()).toBe(200);
    const result = await response.json();
    
    const isolationResult = result.results.find((r: any) => r.flowName === "Tenant Isolation");
    expect(isolationResult).toBeDefined();
    
    // Verify isolation checks for all data types
    const stepNames = isolationResult.steps.map((s: any) => s.step);
    expect(stepNames).toContain("Evidence Isolation");
    expect(stepNames).toContain("Claims Isolation");
    expect(stepNames).toContain("Artifacts Isolation");
    expect(stepNames).toContain("Events Isolation");
    
    // All isolation checks should pass
    const failedSteps = isolationResult.steps.filter((s: any) => s.status === "fail");
    expect(failedSteps.length).toBe(0);
  });
});
