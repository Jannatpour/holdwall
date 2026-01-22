/**
 * Tests for POS Orchestrator
 */

import { POSOrchestrator } from "@/lib/pos/orchestrator";
import { db } from "@/lib/db/client";

jest.mock("@/lib/db/client");
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
      (db.beliefNode.findMany as jest.Mock).mockResolvedValue([]);
      (db.consensusSignal.findMany as jest.Mock).mockResolvedValue([]);
      (db.predictedComplaint.count as jest.Mock).mockResolvedValue(0);
      (db.externalValidator.count as jest.Mock).mockResolvedValue(0);
      (db.decisionCheckpoint.findMany as jest.Mock).mockResolvedValue([]);

      // Mock service methods
      const { EnhancedBeliefGraphEngineering } = await import("@/lib/pos/belief-graph-engineering");
      const bge = new EnhancedBeliefGraphEngineering();
      jest.spyOn(bge, "findWeakNodes").mockResolvedValue([]);

      const { ConsensusHijackingService } = await import("@/lib/pos/consensus-hijacking");
      const consensus = new ConsensusHijackingService();
      jest.spyOn(consensus, "getConsensusMetrics").mockResolvedValue({
        totalSignals: 0,
        averageTrustScore: 0,
        averageRelevanceScore: 0,
        consensusStrength: 0,
        coverage: 0,
      });

      const { AIAnswerAuthorityLayer } = await import("@/lib/pos/ai-answer-authority");
      const aaal = new AIAnswerAuthorityLayer();
      jest.spyOn(aaal, "getAICitationScore").mockResolvedValue({
        rebuttalScore: 0,
        incidentScore: 0,
        dashboardScore: 0,
        overallScore: 0,
      });

      const { TrustSubstitutionMechanism } = await import("@/lib/pos/trust-substitution");
      const tsm = new TrustSubstitutionMechanism();
      jest.spyOn(tsm, "getTrustSubstitutionScore").mockResolvedValue({
        validatorScore: 0,
        auditScore: 0,
        slaScore: 0,
        overallScore: 0,
      });

      const { DecisionFunnelDomination } = await import("@/lib/pos/decision-funnel-domination");
      const dfd = new DecisionFunnelDomination();
      jest.spyOn(dfd, "getFunnelMetrics").mockResolvedValue({
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
      (db.beliefNode.findMany as jest.Mock).mockResolvedValue([]);
      (db.predictedComplaint.create as jest.Mock).mockResolvedValue({ id: "pred-1" });

      const result = await orchestrator.executePOSCycle(tenantId);

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("actions");
      expect(result).toHaveProperty("metrics");
      expect(Array.isArray(result.actions)).toBe(true);
    });
  });

  describe("getRecommendations", () => {
    it("should return actionable recommendations", async () => {
      (db.beliefNode.findMany as jest.Mock).mockResolvedValue([]);
      (db.consensusSignal.findMany as jest.Mock).mockResolvedValue([]);
      (db.predictedComplaint.count as jest.Mock).mockResolvedValue(0);
      (db.externalValidator.count as jest.Mock).mockResolvedValue(0);
      (db.decisionCheckpoint.findMany as jest.Mock).mockResolvedValue([]);

      const recommendations = await orchestrator.getRecommendations(tenantId);

      expect(Array.isArray(recommendations)).toBe(true);
    });
  });
});
