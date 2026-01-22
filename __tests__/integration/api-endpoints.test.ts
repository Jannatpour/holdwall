/** @jest-environment node */
/**
 * Integration Tests for API Endpoints
 * 
 * These tests require:
 * - a running Next.js server (NEXT_PUBLIC_APP_URL or APP_URL)
 * - a configured database (DATABASE_URL)
 *
 * Enable explicitly via RUN_INTEGRATION_TESTS=true.
 */

const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === "true" &&
  Boolean(process.env.DATABASE_URL) &&
  Boolean(appUrl);

const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration("API Endpoints Integration Tests", () => {
  beforeAll(async () => {
    // Setup test database if needed
  });

  afterAll(async () => {
    // Cleanup test data
  });

  describe("Metrics Summary API", () => {
    it("should return valid KPI metrics", async () => {
      const response = await fetch(`${appUrl}/api/metrics/summary?range=7d`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("perception_health_score");
      expect(data).toHaveProperty("outbreak_probability_7d");
      expect(data).toHaveProperty("ai_citation_coverage");
      expect(data).toHaveProperty("trust_coverage_ratio");
      expect(typeof data.perception_health_score).toBe("number");
      expect(data.perception_health_score).toBeGreaterThanOrEqual(0);
      expect(data.perception_health_score).toBeLessThanOrEqual(1);
    });
  });

  describe("Claim Clusters Top API", () => {
    it("should return top clusters sorted by decisiveness", async () => {
      const response = await fetch(`${appUrl}/api/claim-clusters/top?sort=decisiveness&range=7d`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("clusters");
      expect(Array.isArray(data.clusters)).toBe(true);
      
      if (data.clusters.length > 1) {
        expect(data.clusters[0].decisiveness).toBeGreaterThanOrEqual(data.clusters[1].decisiveness);
      }
    });
  });

  describe("Recommendations API", () => {
    it("should return prioritized recommendations", async () => {
      const response = await fetch(`${appUrl}/api/recommendations`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("recommendations");
      expect(Array.isArray(data.recommendations)).toBe(true);
      
      data.recommendations.forEach((rec: any) => {
        expect(rec).toHaveProperty("id");
        expect(rec).toHaveProperty("priority");
        expect(rec).toHaveProperty("action");
        expect(["high", "medium", "low"]).toContain(rec.priority);
      });
    });
  });

  describe("Trust Gaps API", () => {
    it("should identify clusters missing trust assets", async () => {
      const response = await fetch(`${appUrl}/api/trust/gaps`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("gaps");
      expect(Array.isArray(data.gaps)).toBe(true);
      
      data.gaps.forEach((gap: any) => {
        expect(gap).toHaveProperty("cluster_id");
        expect(gap).toHaveProperty("missing_asset_types");
        expect(Array.isArray(gap.missing_asset_types)).toBe(true);
      });
    });
  });

  describe("Graph Paths API", () => {
    it("should find paths between nodes", async () => {
      // First, get some nodes
      const { db } = await import("@/lib/db/client");
      const nodes = await db.beliefNode.findMany({ take: 2 });
      
      if (nodes.length >= 2) {
        const response = await fetch(
          `${appUrl}/api/graph/paths?from_node=${nodes[0].id}&to_node=${nodes[1].id}&depth=3`
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toHaveProperty("paths");
        expect(Array.isArray(data.paths)).toBe(true);
      }
    });
  });
});
