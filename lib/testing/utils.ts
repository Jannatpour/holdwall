/**
 * Testing Utilities
 * Helpers for unit, integration, and E2E tests
 */

import { db } from "@/lib/db/client";

/**
 * Clean test database
 * Uses transactions for test isolation in production
 */
export async function cleanTestDatabase() {
  // Use test database if configured, otherwise use transactions
  const testDbUrl = process.env.TEST_DATABASE_URL;
  
  if (testDbUrl) {
    // Use separate test database
    // Set DATABASE_URL temporarily for test database
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testDbUrl;
    const { PrismaClient } = await import("@prisma/client");
    const testDb = new PrismaClient();
    if (originalUrl) {
      process.env.DATABASE_URL = originalUrl;
    }
    
    // Delete all test data in reverse dependency order
    await testDb.$transaction(async (tx) => {
      await tx.pushSubscription.deleteMany({});
      await tx.conversationSession.deleteMany({});
      await tx.agentConnection.deleteMany({});
      await tx.agentNetwork.deleteMany({});
      await tx.agentRegistry.deleteMany({});
      await tx.aAALArtifact.deleteMany({});
      await tx.forecast.deleteMany({});
      await tx.approval.deleteMany({});
      await tx.claim.deleteMany({});
      await tx.evidence.deleteMany({});
      await tx.connector.deleteMany({});
      await tx.user.deleteMany({});
      await tx.tenant.deleteMany({});
    });
    
    await testDb.$disconnect();
  } else {
    // In production, use transactions for test isolation
    // This should be called within a test transaction context
    await db.$transaction(async (tx) => {
      await tx.pushSubscription.deleteMany({});
      await tx.conversationSession.deleteMany({});
      await tx.agentConnection.deleteMany({});
      await tx.agentNetwork.deleteMany({});
      await tx.agentRegistry.deleteMany({});
      await tx.aAALArtifact.deleteMany({});
      await tx.forecast.deleteMany({});
      await tx.approval.deleteMany({});
      await tx.claim.deleteMany({});
      await tx.evidence.deleteMany({});
      await tx.connector.deleteMany({});
      await tx.user.deleteMany({});
      await tx.tenant.deleteMany({});
    });
  }
}

/**
 * Create test tenant
 */
export async function createTestTenant(name: string = "test-tenant") {
  return await db.tenant.create({
    data: {
      name,
      slug: `test-${Date.now()}`,
    },
  });
}

/**
 * Create test user
 */
export async function createTestUser(
  tenantId: string,
  email: string = `test-${Date.now()}@example.com`
) {
  return await db.user.create({
    data: {
      email,
      name: "Test User",
      tenantId,
      role: "USER",
    },
  });
}

/**
 * Mock evidence for testing
 */
export function createMockEvidence(tenantId: string) {
  return {
    tenant_id: tenantId,
    type: "signal" as const,
    source: {
      type: "reddit",
      id: "test-post-123",
      collected_at: new Date().toISOString(),
      collected_by: "test-connector",
      method: "api" as const,
    },
    content: {
      raw: "Test signal content",
      normalized: "Test signal content",
    },
    provenance: {
      collection_method: "api",
      retention_policy: "90 days",
    },
  };
}
