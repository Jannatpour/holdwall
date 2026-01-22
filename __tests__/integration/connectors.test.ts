/** @jest-environment node */
/**
 * Integration Tests for Connectors
 * 
 * These tests require:
 * - a running Next.js server (NEXT_PUBLIC_APP_URL or APP_URL)
 * - a configured database (DATABASE_URL)
 * - API authentication
 *
 * Enable explicitly via RUN_INTEGRATION_TESTS=true.
 */

const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === "true" &&
  Boolean(process.env.DATABASE_URL) &&
  Boolean(appUrl);

const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration("Connectors Integration Tests", () => {
  let testTenantId: string;
  let authToken: string;
  let createdConnectorId: string;

  beforeAll(async () => {
    // Setup: Create test tenant and get auth token
    // In production, use proper authentication
    testTenantId = "test-tenant-" + Date.now();
    authToken = "test-token"; // Replace with real auth token
  });

  afterAll(async () => {
    // Cleanup: Delete test connector
    if (createdConnectorId) {
      try {
        await fetch(`${appUrl}/api/integrations/connectors/${createdConnectorId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${authToken}`,
          },
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe("Connector CRUD Operations", () => {
    it("should create an RSS connector", async () => {
      const response = await fetch(`${appUrl}/api/integrations/connectors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          type: "rss",
          name: "Test RSS Feed",
          config: {
            url: "https://feeds.feedburner.com/oreilly/radar",
            retentionPolicy: "90 days",
          },
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty("connector");
      expect(data.connector).toHaveProperty("id");
      expect(data.connector.type).toBe("rss");
      expect(data.connector.name).toBe("Test RSS Feed");
      createdConnectorId = data.connector.id;
    });

    it("should list connectors", async () => {
      const response = await fetch(`${appUrl}/api/integrations/connectors`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("connectors");
      expect(Array.isArray(data.connectors)).toBe(true);
      
      if (createdConnectorId) {
        const connector = data.connectors.find((c: any) => c.id === createdConnectorId);
        expect(connector).toBeDefined();
        expect(connector.type).toBe("rss");
      }
    });

    it("should get a specific connector", async () => {
      if (!createdConnectorId) {
        return; // Skip if connector wasn't created
      }

      const response = await fetch(`${appUrl}/api/integrations/connectors/${createdConnectorId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("connector");
      expect(data.connector.id).toBe(createdConnectorId);
      expect(data.connector.type).toBe("rss");
    });

    it("should update a connector", async () => {
      if (!createdConnectorId) {
        return; // Skip if connector wasn't created
      }

      const response = await fetch(`${appUrl}/api/integrations/connectors/${createdConnectorId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: "Updated RSS Feed",
          enabled: true,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.connector.name).toBe("Updated RSS Feed");
    });

    it("should delete a connector", async () => {
      if (!createdConnectorId) {
        return; // Skip if connector wasn't created
      }

      const response = await fetch(`${appUrl}/api/integrations/connectors/${createdConnectorId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      createdConnectorId = ""; // Clear so cleanup doesn't try again
    });
  });

  describe("Connector Sync Operations", () => {
    let syncConnectorId: string;

    beforeAll(async () => {
      // Create a connector for sync testing
      const response = await fetch(`${appUrl}/api/integrations/connectors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          type: "rss",
          name: "Sync Test RSS",
          config: {
            url: "https://feeds.feedburner.com/oreilly/radar",
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        syncConnectorId = data.connector.id;
      }
    });

    afterAll(async () => {
      // Cleanup
      if (syncConnectorId) {
        try {
          await fetch(`${appUrl}/api/integrations/connectors/${syncConnectorId}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${authToken}`,
            },
          });
        } catch (error) {
          // Ignore
        }
      }
    });

    it("should sync a connector", async () => {
      if (!syncConnectorId) {
        return; // Skip if connector wasn't created
      }

      const response = await fetch(`${appUrl}/api/integrations/${syncConnectorId}/sync`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`,
        },
      });

      // Sync might take time, so accept 200 or 202
      expect([200, 202]).toContain(response.status);
      
      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty("runId");
      }
    });

    it("should test connector configuration", async () => {
      if (!syncConnectorId) {
        return; // Skip if connector wasn't created
      }

      const response = await fetch(`${appUrl}/api/integrations/connectors/${syncConnectorId}/test`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("success");
      expect(typeof data.success).toBe("boolean");
    });
  });

  describe("Connector Type Validation", () => {
    it("should reject invalid connector type", async () => {
      const response = await fetch(`${appUrl}/api/integrations/connectors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          type: "invalid-type",
          name: "Invalid Connector",
          config: {},
        }),
      });

      expect(response.status).toBe(400);
    });

    it("should reject invalid RSS configuration", async () => {
      const response = await fetch(`${appUrl}/api/integrations/connectors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          type: "rss",
          name: "Invalid RSS",
          config: {
            // Missing required 'url' field
          },
        }),
      });

      expect(response.status).toBe(400);
    });

    it("should reject invalid GitHub configuration", async () => {
      const response = await fetch(`${appUrl}/api/integrations/connectors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          type: "github",
          name: "Invalid GitHub",
          config: {
            // Missing required fields
          },
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("Connector Status and Metrics", () => {
    it("should return connector status", async () => {
      const response = await fetch(`${appUrl}/api/integrations/connectors`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      if (data.connectors.length > 0) {
        const connector = data.connectors[0];
        expect(connector).toHaveProperty("status");
        expect(connector).toHaveProperty("enabled");
        expect(typeof connector.enabled).toBe("boolean");
        expect(["connected", "disconnected", "error"]).toContain(connector.status);
      }
    });

    it("should return connector run history", async () => {
      const response = await fetch(`${appUrl}/api/integrations/connectors`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      if (data.connectors.length > 0) {
        const connector = data.connectors[0];
        if (connector.lastRun) {
          expect(connector.lastRun).toHaveProperty("status");
          expect(connector.lastRun).toHaveProperty("itemsProcessed");
          expect(connector.lastRun).toHaveProperty("itemsCreated");
        }
      }
    });
  });
});
