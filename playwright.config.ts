import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for E2E testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./__tests__/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  webServer: {
    // Ensure the dev server starts from this package directory (not the workspace root).
    // Playwright loads this config via a CommonJS wrapper, so __dirname is available here.
    cwd: __dirname,
    stdout: "pipe",
    stderr: "pipe",
    command:
      "NEXTAUTH_SECRET=dev-nextauth-secret-dev-nextauth-secret " +
      "CSRF_SECRET=dev-csrf-secret-dev-csrf-secret " +
      "EVIDENCE_SIGNING_SECRET=dev-evidence-signing-secret-dev-evidence-signing-secret " +
      "docker compose up -d postgres redis && " +
      // Ensure a clean, isolated database for E2E runs without touching dev data.
      "rm -rf .next && " +
      "docker exec holdwall-postgres-1 psql -U holdwall -d holdwall -c \"DROP DATABASE IF EXISTS holdwall_test;\" && " +
      "docker exec holdwall-postgres-1 psql -U holdwall -d holdwall -c \"CREATE DATABASE holdwall_test;\" && " +
      "DATABASE_URL=postgresql://holdwall:holdwall@localhost:15432/holdwall_test " +
      "NEXT_PUBLIC_APP_URL=http://localhost:3001 " +
      "NEXT_PUBLIC_BASE_URL=http://localhost:3001 " +
      "NEXTAUTH_URL=http://localhost:3001 " +
      "NEXTAUTH_SECRET=dev-nextauth-secret-dev-nextauth-secret " +
      "CSRF_SECRET=dev-csrf-secret-dev-csrf-secret " +
      "EVIDENCE_SIGNING_SECRET=dev-evidence-signing-secret-dev-evidence-signing-secret " +
      "VERIFY_TOKEN=test-verify-token " +
      "npx prisma migrate deploy && " +
      "DATABASE_URL=postgresql://holdwall:holdwall@localhost:15432/holdwall_test " +
      "tsx scripts/seed-test-users.ts && " +
      "DATABASE_URL=postgresql://holdwall:holdwall@localhost:15432/holdwall_test " +
      "NEXT_PUBLIC_APP_URL=http://localhost:3001 " +
      "NEXT_PUBLIC_BASE_URL=http://localhost:3001 " +
      "NEXTAUTH_URL=http://localhost:3001 " +
      "NEXTAUTH_SECRET=dev-nextauth-secret-dev-nextauth-secret " +
      "CSRF_SECRET=dev-csrf-secret-dev-csrf-secret " +
      "EVIDENCE_SIGNING_SECRET=dev-evidence-signing-secret-dev-evidence-signing-secret " +
      "VERIFY_TOKEN=test-verify-token " +
      // Build the production bundle for E2E.
      "LOG_LEVEL=debug NEXT_TELEMETRY_DISABLED=1 npx next build && " +
      "DATABASE_URL=postgresql://holdwall:holdwall@localhost:15432/holdwall_test " +
      "NEXT_PUBLIC_APP_URL=http://localhost:3001 " +
      "NEXT_PUBLIC_BASE_URL=http://localhost:3001 " +
      "NEXTAUTH_URL=http://localhost:3001 " +
      "NEXTAUTH_SECRET=dev-nextauth-secret-dev-nextauth-secret " +
      "CSRF_SECRET=dev-csrf-secret-dev-csrf-secret " +
      "EVIDENCE_SIGNING_SECRET=dev-evidence-signing-secret-dev-evidence-signing-secret " +
      "VERIFY_TOKEN=test-verify-token " +
      "LOG_LEVEL=debug NEXT_TELEMETRY_DISABLED=1 npx next start -p 3001",
    port: 3001,
    reuseExistingServer: true,
    timeout: 300 * 1000,
  },
});
