import { defineConfig, devices } from "@playwright/test";

/**
 * Production Playwright configuration (no webServer).
 * Runs smoke checks against an already-deployed environment.
 */
export default defineConfig({
  testDir: "./__tests__/e2e",
  testMatch: ["**/production-smoke.test.ts"],
  fullyParallel: false,
  retries: 0,
  reporter: "html",
  use: {
    baseURL: process.env.BASE_URL || "https://www.holdwall.com",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

