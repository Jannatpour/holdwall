/**
 * E2E Tests for POS (Perception Operating System) Journey
 */

import { test, expect } from "@playwright/test";

test.describe("POS Journey", () => {
  test.beforeEach(async ({ page }) => {
    // Sign in (assuming test user exists)
    await page.goto("/auth/signin");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/overview");
  });

  test("should navigate to POS dashboard", async ({ page }) => {
    await page.goto("/pos");
    await expect(page.locator("h1")).toContainText("Perception Operating System");
  });

  test("should display POS metrics", async ({ page }) => {
    await page.goto("/pos");
    
    // Wait for metrics to load
    await page.waitForSelector('[data-testid="pos-score"]', { timeout: 10000 });
    
    // Check overall POS score is displayed
    const scoreElement = page.locator('[data-testid="pos-score"]');
    await expect(scoreElement).toBeVisible();
    
    // Check component metrics are displayed
    await expect(page.locator("text=BGE")).toBeVisible();
    await expect(page.locator("text=Consensus")).toBeVisible();
    await expect(page.locator("text=AAAL")).toBeVisible();
  });

  test("should execute POS cycle", async ({ page }) => {
    await page.goto("/pos");
    
    // Click execute cycle button
    const executeButton = page.locator('button:has-text("Execute Cycle")');
    await executeButton.click();
    
    // Wait for execution to complete
    await page.waitForTimeout(3000);
    
    // Check that metrics are updated
    await expect(page.locator("text=POS cycle completed")).toBeVisible({ timeout: 10000 });
  });

  test("should display recommendations", async ({ page }) => {
    await page.goto("/pos");
    
    // Wait for recommendations to load
    await page.waitForSelector("text=Recommendations", { timeout: 10000 });
    
    // Check recommendations section exists
    const recommendationsSection = page.locator("text=Recommendations");
    await expect(recommendationsSection).toBeVisible();
  });

  test("should navigate between POS component tabs", async ({ page }) => {
    await page.goto("/pos");
    
    // Click on different tabs
    await page.click('button:has-text("Belief Graph")');
    await expect(page.locator("text=Weak Nodes")).toBeVisible();
    
    await page.click('button:has-text("Consensus")');
    await expect(page.locator("text=Consensus Signals")).toBeVisible();
    
    await page.click('button:has-text("AI Authority")');
    await expect(page.locator("text=AI Citation Score")).toBeVisible();
  });
});
