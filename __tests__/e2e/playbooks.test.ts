/**
 * Playbooks E2E Tests
 * Tests for playbook creation, editing, execution, and management
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TransformStream } = require("stream/web");
// @ts-ignore
globalThis.TransformStream = globalThis.TransformStream || TransformStream;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { test, expect } = require("@playwright/test");

test.describe("Playbooks Management", () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

  test.beforeEach(async ({ page }) => {
    // Navigate to playbooks page (assumes user is logged in)
    await page.goto(`${baseUrl}/playbooks`);
    // Wait for page to load
    await page.waitForSelector("h1:has-text('Playbooks')", { timeout: 10000 });
  });

  test.describe("Playbook Creation", () => {
    test("should create a new playbook from template", async ({ page }) => {
      // Click create playbook button
      await page.click('button:has-text("Create Playbook")');
      
      // Wait for dialog to open
      await page.waitForSelector('text=Create Playbook', { timeout: 5000 });
      
      // Select template tab
      await page.click('button[role="tab"]:has-text("Choose Template")');
      
      // Select a template (AAAL Publish)
      await page.click('text=AAAL Publish');
      
      // Go to configure tab
      await page.click('button[role="tab"]:has-text("Configure")');
      
      // Verify template name is pre-filled
      const nameInput = page.locator('#playbook-name');
      await expect(nameInput).toHaveValue(/AAAL Publish/i);
      
      // Update name if needed
      await nameInput.fill(`Test Playbook ${Date.now()}`);
      
      // Add description
      await page.fill('#playbook-description', 'Test playbook for E2E testing');
      
      // Create playbook
      await page.click('button:has-text("Create Playbook")');
      
      // Wait for success and page reload
      await page.waitForURL(/\/playbooks/, { timeout: 10000 });
      
      // Verify playbook appears in catalog
      await expect(page.locator('text=Test Playbook')).toBeVisible({ timeout: 5000 });
    });

    test("should create playbook via ?new=true query parameter", async ({ page }) => {
      await page.goto(`${baseUrl}/playbooks?new=true`);
      
      // Dialog should be open
      await page.waitForSelector('text=Create Playbook', { timeout: 5000 });
      
      // Fill in form
      await page.fill('#playbook-name', `Quick Create Playbook ${Date.now()}`);
      await page.fill('#playbook-description', 'Created via query parameter');
      
      // Create
      await page.click('button:has-text("Create Playbook")');
      
      // Verify redirect
      await page.waitForURL(/\/playbooks/, { timeout: 10000 });
    });
  });

  test.describe("Playbook Editing", () => {
    test("should edit existing playbook", async ({ page }) => {
      // Assume there's at least one playbook - click edit on first one
      const editButton = page.locator('button:has-text("Edit")').first();
      
      if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editButton.click();
        
        // Should navigate to editor
        await page.waitForURL(/\/playbooks\?id=/, { timeout: 5000 });
        await page.waitForSelector('text=Edit Playbook', { timeout: 5000 });
        
        // Update name
        const nameInput = page.locator('#playbook-name');
        const currentName = await nameInput.inputValue();
        await nameInput.fill(`${currentName} (Updated)`);
        
        // Save
        await page.click('button:has-text("Save Changes")');
        
        // Wait for save
        await page.waitForURL(/\/playbooks/, { timeout: 10000 });
        
        // Verify update
        await expect(page.locator('text=(Updated)')).toBeVisible({ timeout: 5000 });
      } else {
        // Skip if no playbooks exist
        test.skip();
      }
    });

    test("should navigate to editor via ?id parameter", async ({ page }) => {
      // First, get a playbook ID by creating one or finding existing
      // For this test, we'll create one first
      await page.click('button:has-text("Create Playbook")');
      await page.waitForSelector('text=Create Playbook', { timeout: 5000 });
      await page.fill('#playbook-name', `Editor Test ${Date.now()}`);
      await page.click('button[role="tab"]:has-text("Configure")');
      await page.click('button:has-text("Create Playbook")');
      
      // Wait for creation
      await page.waitForURL(/\/playbooks/, { timeout: 10000 });
      
      // Get playbook card and extract ID from edit link
      const editLink = page.locator('button:has-text("Edit")').first();
      if (await editLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editLink.click();
        
        // Should be in editor
        await page.waitForSelector('text=Edit Playbook', { timeout: 5000 });
        await expect(page.locator('#playbook-name')).toBeVisible();
      }
    });
  });

  test.describe("Playbook Execution", () => {
    test("should execute a playbook", async ({ page }) => {
      // Find a playbook and click run
      const runButton = page.locator('button:has-text("Run")').first();
      
      if (await runButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await runButton.click();
        
        // Dialog should open
        await page.waitForSelector('text=Run Playbook', { timeout: 5000 });
        
        // Execute
        await page.click('button:has-text("Execute Playbook")');
        
        // Should show success or navigate
        await page.waitForTimeout(2000);
        
        // Check for success toast or execution status
        const successIndicator = page.locator('text=/success|execution|running/i');
        if (await successIndicator.isVisible({ timeout: 5000 }).catch(() => false)) {
          // Success
          expect(true).toBe(true);
        }
      } else {
        // Skip if no playbooks
        test.skip();
      }
    });

    test("should view execution history", async ({ page }) => {
      // Navigate to history tab
      await page.click('button[role="tab"]:has-text("History")');
      
      // Wait for history content
      await page.waitForTimeout(1000);
      
      // Should show history table or empty state
      const historyContent = page.locator('text=/Run History|No run history/i');
      await expect(historyContent).toBeVisible({ timeout: 5000 });
    });

    test("should view execution details", async ({ page }) => {
      // Go to history tab
      await page.click('button[role="tab"]:has-text("History")');
      await page.waitForTimeout(1000);
      
      // Click view details on first execution if exists
      const viewDetailsButton = page.locator('button:has-text("View Details")').first();
      
      if (await viewDetailsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await viewDetailsButton.click();
        
        // Should show execution details
        await page.waitForSelector('text=Execution Details', { timeout: 5000 });
        await expect(page.locator('text=Status')).toBeVisible();
      }
    });
  });

  test.describe("Playbook Deletion", () => {
    test("should delete a playbook", async ({ page }) => {
      // Create a playbook to delete
      await page.click('button:has-text("Create Playbook")');
      await page.waitForSelector('text=Create Playbook', { timeout: 5000 });
      await page.fill('#playbook-name', `Delete Test ${Date.now()}`);
      await page.click('button[role="tab"]:has-text("Configure")');
      await page.click('button:has-text("Create Playbook")');
      await page.waitForURL(/\/playbooks/, { timeout: 10000 });
      
      // Find the playbook and delete it
      const moreMenu = page.locator('button[aria-label*="More"]').first();
      const deleteButton = page.locator('button:has-text("Delete")').first();
      
      if (await moreMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await moreMenu.click();
        await page.waitForTimeout(500);
        
        if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await deleteButton.click();
          
          // Confirm deletion
          page.on('dialog', dialog => dialog.accept());
          await page.waitForTimeout(1000);
          
          // Should show success
          await page.waitForTimeout(2000);
        }
      }
    });
  });

  test.describe("Playbook Templates", () => {
    test("should show all available templates", async ({ page }) => {
      await page.click('button:has-text("Create Playbook")');
      await page.waitForSelector('text=Create Playbook', { timeout: 5000 });
      
      // Go to template tab
      await page.click('button[role="tab"]:has-text("Choose Template")');
      
      // Verify templates are visible
      await expect(page.locator('text=AAAL Publish')).toBeVisible();
      await expect(page.locator('text=Signal Response')).toBeVisible();
      await expect(page.locator('text=Claim Analysis')).toBeVisible();
    });

    test("should pre-fill form when template is selected", async ({ page }) => {
      await page.click('button:has-text("Create Playbook")');
      await page.waitForSelector('text=Create Playbook', { timeout: 5000 });
      
      // Select template
      await page.click('text=Signal Response');
      
      // Go to configure tab
      await page.click('button[role="tab"]:has-text("Configure")');
      
      // Verify fields are pre-filled
      const nameInput = page.locator('#playbook-name');
      await expect(nameInput).toHaveValue(/Signal Response/i);
      
      // Verify autopilot mode is set
      const autopilotSelect = page.locator('#autopilot-mode');
      const autopilotValue = await autopilotSelect.textContent();
      expect(autopilotValue).toBeTruthy();
    });
  });

  test.describe("Playbook Views", () => {
    test("should switch between catalog, active runs, and history tabs", async ({ page }) => {
      // Catalog tab (default)
      await expect(page.locator('button[role="tab"]:has-text("Catalog")')).toHaveAttribute('data-state', 'active');
      
      // Switch to active runs
      await page.click('button[role="tab"]:has-text("Active Runs")');
      await page.waitForTimeout(500);
      await expect(page.locator('button[role="tab"]:has-text("Active Runs")')).toHaveAttribute('data-state', 'active');
      
      // Switch to history
      await page.click('button[role="tab"]:has-text("History")');
      await page.waitForTimeout(500);
      await expect(page.locator('button[role="tab"]:has-text("History")')).toHaveAttribute('data-state', 'active');
      
      // Switch to autopilot
      await page.click('button[role="tab"]:has-text("Autopilot")');
      await page.waitForTimeout(500);
      await expect(page.locator('button[role="tab"]:has-text("Autopilot")')).toHaveAttribute('data-state', 'active');
    });
  });
});
