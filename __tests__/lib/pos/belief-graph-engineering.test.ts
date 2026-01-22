/**
 * Tests for Belief Graph Engineering (BGE)
 */

import { EnhancedBeliefGraphEngineering } from "@/lib/pos/belief-graph-engineering";
import { db } from "@/lib/db/client";

jest.mock("@/lib/db/client");
jest.mock("@/lib/events/store-db");
jest.mock("@/lib/logging/logger");
jest.mock("@/lib/observability/metrics");

describe("EnhancedBeliefGraphEngineering", () => {
  let bge: EnhancedBeliefGraphEngineering;
  const tenantId = "test-tenant";

  beforeEach(() => {
    bge = new EnhancedBeliefGraphEngineering();
    jest.clearAllMocks();
  });

  describe("analyzeStructuralIrrelevance", () => {
    it("should identify weak nodes with low trust and no reinforcing edges", async () => {
      const nodeId = "test-node";
      (db.beliefNode.findUnique as jest.Mock).mockResolvedValue({
        id: nodeId,
        tenantId,
        type: "CLAIM",
        content: "Negative claim",
        trustScore: -0.8,
        decisiveness: 0.3,
        decayFactor: 0.99,
        createdAt: new Date(),
        updatedAt: new Date(),
        toEdges: [
          { type: "NEUTRALIZATION", weight: -0.5 },
          { type: "DECAY", weight: -0.3 },
        ],
      });

      const analysis = await bge.analyzeStructuralIrrelevance(tenantId, nodeId);

      expect(analysis.isWeak).toBe(true);
      expect(analysis.structuralIrrelevance).toBeGreaterThan(0.6);
      expect(analysis.reinforcingEdges).toBe(0);
      expect(analysis.recommendation).toBe("neutralize");
    });

    it("should identify strong nodes with high trust and reinforcing edges", async () => {
      const nodeId = "test-node";
      (db.beliefNode.findUnique as jest.Mock).mockResolvedValue({
        id: nodeId,
        tenantId,
        type: "PROOF_POINT",
        content: "Positive proof",
        trustScore: 0.9,
        decisiveness: 0.8,
        decayFactor: 0.99,
        createdAt: new Date(),
        updatedAt: new Date(),
        toEdges: [
          { type: "REINFORCEMENT", weight: 0.7 },
          { type: "REINFORCEMENT", weight: 0.6 },
        ],
      });

      const analysis = await bge.analyzeStructuralIrrelevance(tenantId, nodeId);

      expect(analysis.isWeak).toBe(false);
      expect(analysis.structuralIrrelevance).toBeLessThan(0.6);
      expect(analysis.reinforcingEdges).toBe(2);
      expect(analysis.recommendation).toBe("reinforce");
    });
  });

  describe("findWeakNodes", () => {
    it("should find weak nodes filtered by irrelevance threshold", async () => {
      (db.beliefNode.findMany as jest.Mock).mockResolvedValue([
        {
          id: "node1",
          tenantId,
          type: "CLAIM",
          trustScore: -0.7,
          decisiveness: 0.2,
        },
        {
          id: "node2",
          tenantId,
          type: "CLAIM",
          trustScore: -0.5,
          decisiveness: 0.4,
        },
      ]);

      const weakNodes = await bge.findWeakNodes(tenantId, {
        minIrrelevance: 0.6,
        limit: 10,
      });

      expect(weakNodes.length).toBeGreaterThan(0);
      weakNodes.forEach((node) => {
        expect(node.structuralIrrelevance).toBeGreaterThanOrEqual(0.6);
      });
    });
  });
});
