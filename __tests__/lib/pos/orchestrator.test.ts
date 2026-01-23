/**
 * Tests for POS Orchestrator
 */

import { POSOrchestrator } from "@/lib/pos/orchestrator";
import { db } from "@/lib/db/client";

jest.mock("@/lib/db/client", () => ({
  db: {
    beliefNode: {
      findMany: jest.fn(),
    },
    consensusSignal: {
      findMany: jest.fn(),
    },
    predictedComplaint: {
      count: jest.fn(),
      create: jest.fn(),
    },
    externalValidator: {
      count: jest.fn(),
    },
    decisionCheckpoint: {
      findMany: jest.fn(),
    },
  },
}));
jest.mock("@/lib/pos/belief-graph-engineering");
jest.mock("@/lib/pos/consensus-hijacking");
jest.mock("@/lib/pos/ai-answer-authority");
jest.mock("@/lib/pos/narrative-preemption");
jest.mock("@/lib/pos/trust-substitution");
jest.mock("@/lib/pos/decision-funnel-domination");

describe("POSOrchestrator", () => {
  let orchestrator: POSOrchestrator;
  const tenantId = "test-tenant";

  beforeEach(() => {
    orchestrator = new POSOrchestrator();
    jest.clearAllMocks();
  });

  describe("getMetrics", () => {
    it("should return comprehensive POS metrics", async () => {
      const { db } = require("@/lib/db/client");
      (db.beliefNode.findMany as jest.Mock).mockResolvedValue([]);
      (db.consensusSignal.findMany as jest.Mock).mockResolvedValue([]);
      (db.predictedComplaint.count as jest.Mock).mockResolvedValue(0);
      (db.externalValidator.count as jest.Mock).mockResolvedValue(0);
      (db.decisionCheckpoint.findMany as jest.Mock).mockResolvedValue([]);

      // Mock service methods on the orchestrator's instances
      jest.spyOn(orchestrator["bge"], "findWeakNodes").mockResolvedValue([]);
      jest.spyOn(orchestrator["consensus"], "getConsensusMetrics").mockResolvedValue({
        totalSignals: 0,
        averageTrustScore: 0,
        averageRelevanceScore: 0,
        consensusStrength: 0,
        coverage: 0,
      });
      jest.spyOn(orchestrator["aaal"], "getAICitationScore").mockResolvedValue({
        rebuttalScore: 0,
        incidentScore: 0,
        dashboardScore: 0,
        overallScore: 0,
      });
      jest.spyOn(orchestrator["tsm"], "getTrustSubstitutionScore").mockResolvedValue({
        validatorScore: 0,
        auditScore: 0,
        slaScore: 0,
        overallScore: 0,
      });
      jest.spyOn(orchestrator["dfd"], "getFunnelMetrics").mockResolvedValue({
        awarenessControl: 0,
        researchControl: 0,
        comparisonControl: 0,
        decisionControl: 0,
        postPurchaseControl: 0,
        overallControl: 0,
      });

      const metrics = await orchestrator.getMetrics(tenantId);

      expect(metrics).toHaveProperty("bge");
      expect(metrics).toHaveProperty("consensus");
      expect(metrics).toHaveProperty("aaal");
      expect(metrics).toHaveProperty("npe");
      expect(metrics).toHaveProperty("tsm");
      expect(metrics).toHaveProperty("dfd");
      expect(metrics).toHaveProperty("overall");
      expect(metrics.overall.posScore).toBeGreaterThanOrEqual(0);
      expect(metrics.overall.posScore).toBeLessThanOrEqual(1);
    });
  });

  describe("executePOSCycle", () => {
    it("should execute complete POS cycle and return results", async () => {
      const { db } = require("@/lib/db/client");
      (db.beliefNode.findMany as jest.Mock).mockResolvedValue([]);
      (db.predictedComplaint.create as jest.Mock).mockResolvedValue({ id: "pred-1" });

      // Mock service methods
      jest.spyOn(orchestrator["bge"], "findWeakNodes").mockResolvedValue([]);
      jest.spyOn(orchestrator["bge"], "makeStructurallyIrrelevant").mockResolvedValue(["edge-1"]);
      jest.spyOn(orchestrator["npe"], "predictComplaints").mockResolvedValue(["pred-1"]);
      jest.spyOn(orchestrator["npe"], "generatePreemptiveAction").mockResolvedValue({
        actionId: "action-1",
        type: "artifact",
        content: "Test action content",
        evidenceRefs: [],
      });
      jest.spyOn(orchestrator, "getMetrics").mockResolvedValue({
        bge: { weakNodesCount: 0, averageIrrelevance: 0 },
        consensus: { totalSignals: 0, consensusStrength: 0 },
        aaal: { citationScore: 0, publishedContent: 0 },
        npe: { activePredictions: 0, preemptiveActions: 0 },
        tsm: { trustScore: 0, validatorCount: 0 },
        dfd: { overallControl: 0, stageCoverage: 0 },
        overall: { posScore: 0 },
      });

      const result = await orchestrator.executePOSCycle(tenantId);

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("actions");
      expect(result).toHaveProperty("metrics");
      expect(Array.isArray(result.actions)).toBe(true);
    });
  });

  describe("getRecommendations", () => {
    it("should return actionable recommendations", async () => {
      const { db } = require("@/lib/db/client");
      (db.beliefNode.findMany as jest.Mock).mockResolvedValue([]);
      (db.consensusSignal.findMany as jest.Mock).mockResolvedValue([]);
      (db.predictedComplaint.count as jest.Mock).mockResolvedValue(0);
      (db.externalValidator.count as jest.Mock).mockResolvedValue(0);
      (db.decisionCheckpoint.findMany as jest.Mock).mockResolvedValue([]);

      // Mock service methods
      jest.spyOn(orchestrator["bge"], "findWeakNodes").mockResolvedValue([]);
      jest.spyOn(orchestrator["consensus"], "getConsensusMetrics").mockResolvedValue({
        totalSignals: 0,
        averageTrustScore: 0,
        averageRelevanceScore: 0,
        consensusStrength: 0,
        coverage: 0,
      });
      jest.spyOn(orchestrator["aaal"], "getAICitationScore").mockResolvedValue({
        rebuttalScore: 0,
        incidentScore: 0,
        dashboardScore: 0,
        overallScore: 0,
      });
      jest.spyOn(orchestrator["tsm"], "getTrustSubstitutionScore").mockResolvedValue({
        validatorScore: 0,
        auditScore: 0,
        slaScore: 0,
        overallScore: 0,
      });
      jest.spyOn(orchestrator["dfd"], "getFunnelMetrics").mockResolvedValue({
        awarenessControl: 0,
        researchControl: 0,
        comparisonControl: 0,
        decisionControl: 0,
        postPurchaseControl: 0,
        overallControl: 0,
      });

      const recommendations = await orchestrator.getRecommendations(tenantId);

      expect(Array.isArray(recommendations)).toBe(true);
    });
  });
});
