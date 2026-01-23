/** @jest-environment node */
/**
 * Claims API Tests
 */

import { NextRequest } from "next/server";

// Mock dependencies
jest.mock("@/lib/auth/session", () => ({
  requireAuth: jest.fn(() => ({
    id: "user-123",
    tenantId: "tenant-123",
  })),
}));

const mockExtractClaims = jest.fn();
jest.mock("@/lib/claims/extraction", () => ({
  ClaimExtractionService: jest.fn(() => ({
    extractClaims: (...args: any[]) => mockExtractClaims(...args),
  })),
}));

jest.mock("@/lib/db/client", () => ({
  db: {
    claim: {
      findMany: jest.fn(),
    },
    evidence: {
      findMany: jest.fn(),
    },
    event: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/events/broadcast-helper", () => ({
  broadcastClaimUpdate: jest.fn(() => Promise.resolve()),
}));

describe("Claims API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/claims", () => {
    it("should return claims list", async () => {
      const { GET } = require("@/app/api/claims/route");
      const { db } = require("@/lib/db/client");
      db.claim.findMany.mockResolvedValue([
        {
          id: "claim-1",
          canonicalText: "Test claim",
          decisiveness: 0.8,
        },
      ]);

      const request = new NextRequest("http://localhost:3000/api/claims");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].canonicalText).toBe("Test claim");
    });

    it("should filter by cluster_id", async () => {
      const { GET } = require("@/app/api/claims/route");
      const { db } = require("@/lib/db/client");
      db.claim.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/claims?cluster_id=cluster-123"
      );
      await GET(request);

      expect(db.claim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clusterId: "cluster-123",
          }),
        })
      );
    });
  });

  describe("POST /api/claims", () => {
    it("should extract claims from evidence", async () => {
      const { POST } = require("@/app/api/claims/route");
      const { db } = require("@/lib/db/client");
      
      // Mock evidence validation
      db.evidence.findMany.mockResolvedValue([
        { id: "ev-123", tenantId: "tenant-123" },
      ]);
      
      mockExtractClaims.mockResolvedValue([
        {
          claim_id: "claim-new",
          canonical_text: "New claim",
          decisiveness: 0.5,
        },
      ]);

      const request = new NextRequest("http://localhost:3000/api/claims", {
        method: "POST",
        body: JSON.stringify({
          evidence_id: "ev-123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].canonical_text).toBe("New claim");
    });

    it("should validate input", async () => {
      const { POST } = require("@/app/api/claims/route");
      const request = new NextRequest("http://localhost:3000/api/claims", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });
});
