/**
 * API Tests for POS Orchestrator
 * @jest-environment node
 */

import { POST, GET } from "@/app/api/pos/orchestrator/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth/session", () => ({
  requireAuth: jest.fn().mockResolvedValue({ id: "user-1", tenantId: "tenant-1" }),
}));
jest.mock("@/lib/pos/orchestrator");

describe("POS Orchestrator API", () => {
  const mockUser = { id: "user-1", tenantId: "tenant-1" };

  beforeEach(() => {
    jest.clearAllMocks();
    const { requireAuth } = require("@/lib/auth/session");
    (requireAuth as jest.Mock).mockResolvedValue(mockUser);
  });

  describe("GET /api/pos/orchestrator", () => {
    it("should return metrics when action=metrics", async () => {
      const { POSOrchestrator } = await import("@/lib/pos/orchestrator");
      const mockOrchestrator = {
        getMetrics: jest.fn().mockResolvedValue({
          overall: { posScore: 0.75 },
        }),
      };
      jest.spyOn(POSOrchestrator.prototype, "getMetrics").mockImplementation(
        mockOrchestrator.getMetrics
      );

      const request = new NextRequest(
        "http://localhost:3000/api/pos/orchestrator?action=metrics"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("metrics");
      expect(data.metrics.overall.posScore).toBe(0.75);
    });

    it("should return recommendations when action=recommendations", async () => {
      const { POSOrchestrator } = await import("@/lib/pos/orchestrator");
      const mockOrchestrator = {
        getRecommendations: jest.fn().mockResolvedValue([
          "Create more consensus signals",
          "Publish rebuttal documents",
        ]),
      };
      jest
        .spyOn(POSOrchestrator.prototype, "getRecommendations")
        .mockImplementation(mockOrchestrator.getRecommendations);

      const request = new NextRequest(
        "http://localhost:3000/api/pos/orchestrator?action=recommendations"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("recommendations");
      expect(Array.isArray(data.recommendations)).toBe(true);
    });
  });

  describe("POST /api/pos/orchestrator", () => {
    it("should execute POS cycle when action=execute-cycle", async () => {
      const { POSOrchestrator } = await import("@/lib/pos/orchestrator");
      const mockOrchestrator = {
        executePOSCycle: jest.fn().mockResolvedValue({
          success: true,
          actions: ["BGE: Made node1 structurally irrelevant"],
          metrics: { overall: { posScore: 0.8 } },
        }),
      };
      jest
        .spyOn(POSOrchestrator.prototype, "executePOSCycle")
        .mockImplementation(mockOrchestrator.executePOSCycle);

      const request = new NextRequest(
        "http://localhost:3000/api/pos/orchestrator",
        {
          method: "POST",
          body: JSON.stringify({ action: "execute-cycle" }),
        }
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("success");
      expect(data.success).toBe(true);
      expect(data).toHaveProperty("actions");
      expect(data).toHaveProperty("metrics");
    });
  });
});
