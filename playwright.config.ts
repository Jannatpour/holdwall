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
    command:
      "docker compose up -d postgres redis && " +
      "DATABASE_URL=postgresql://holdwall:holdwall@localhost:5432/holdwall " +
      "NEXT_PUBLIC_APP_URL=http://localhost:3001 " +
      "NEXTAUTH_URL=http://localhost:3001 " +
      "NEXTAUTH_SECRET=dev-nextauth-secret " +
      "npx prisma migrate deploy && " +
      "DATABASE_URL=postgresql://holdwall:holdwall@localhost:5432/holdwall " +
      "tsx scripts/seed-test-users.ts && " +
      "DATABASE_URL=postgresql://holdwall:holdwall@localhost:5432/holdwall " +
      "NEXT_PUBLIC_APP_URL=http://localhost:3001 " +
      "NEXTAUTH_URL=http://localhost:3001 " +
      "NEXTAUTH_SECRET=dev-nextauth-secret " +
      "PORT=3001 npm run dev",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
