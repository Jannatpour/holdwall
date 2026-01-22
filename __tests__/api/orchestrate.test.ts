/** @jest-environment node */
/**
 * Comprehensive Tests for Advanced AI Orchestration Endpoint
 * 
 * Tests all three flags: use_graphrag, use_composite, use_k2
 * Verifies contract correctness, error handling, and response shapes
 */

import { GET } from "@/app/api/ai/orchestrate/route";
import { NextRequest } from "next/server";

// Mock dependencies
jest.mock("@/lib/auth/session", () => ({
  requireAuth: jest.fn(() => Promise.resolve({ tenantId: "test-tenant", id: "test-user" })),
}));

jest.mock("@/lib/evidence/vault-db", () => ({
  DatabaseEvidenceVault: jest.fn(() => ({
    search: jest.fn(() => Promise.resolve([])),
    query: jest.fn(() => Promise.resolve([])),
    store: jest.fn(() => Promise.resolve("ev-123")),
  })),
}));

jest.mock("@/lib/ai/graphrag", () => ({
  GraphRAG: jest.fn(() => ({
    buildKnowledgeGraph: jest.fn(() => Promise.resolve({ nodes: [], edges: [] })),
    query: jest.fn(() => Promise.resolve({
      results: [{ id: "ev-1", relevance: 0.9 }],
      answer: "Test answer",
    })),
  })),
}));

jest.mock("@/lib/ai/composite-orchestrator", () => ({
  CompositeOrchestrator: jest.fn(() => ({
    execute: jest.fn(() => Promise.resolve({
      result: "Composite result",
      steps: [],
    })),
  })),
}));

jest.mock("@/lib/ai/k2-reasoning", () => ({
  K2Reasoning: jest.fn(() => ({
    reason: jest.fn(() => Promise.resolve({
      conclusion: "K2 conclusion",
      steps: [],
    })),
  })),
}));

describe("Advanced AI Orchestration Endpoint", () => {
  const baseUrl = "http://localhost:3000/api/ai/orchestrate";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GraphRAG Flag (use_graphrag)", () => {
    it("should use GraphRAG when flag is true", async () => {
      const request = new NextRequest(
        `${baseUrl}?query=test&use_graphrag=true`,
        { method: "GET" }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("answer");
      expect(data).toHaveProperty("sources");
      expect(data.method).toBe("graphrag");
    });

    it("should handle GraphRAG errors gracefully", async () => {
      const { GraphRAG } = await import("@/lib/ai/graphrag");
      const mockGraphRAG = GraphRAG as any;
      mockGraphRAG.mockImplementationOnce(() => ({
        buildKnowledgeGraph: jest.fn(() => Promise.reject(new Error("GraphRAG error"))),
        query: jest.fn(() => Promise.reject(new Error("Query error"))),
      }));

      const request = new NextRequest(
        `${baseUrl}?query=test&use_graphrag=true`,
        { method: "GET" }
      );

      const response = await GET(request);
      expect(response.status).toBe(500);
    });

    it("should use correct GraphRAG query parameters", async () => {
      const { GraphRAG } = await import("@/lib/ai/graphrag");
      const mockInstance = {
        buildKnowledgeGraph: jest.fn(() => Promise.resolve({ nodes: [], edges: [] })),
        query: jest.fn(() => Promise.resolve({ results: [], answer: "" })),
      };
      (GraphRAG as any).mockImplementationOnce(() => mockInstance);

      const request = new NextRequest(
        `${baseUrl}?query=test&use_graphrag=true&maxResults=10&minConfidence=0.7`,
        { method: "GET" }
      );

      await GET(request);

      expect(mockInstance.query).toHaveBeenCalledWith(
        "test",
        expect.objectContaining({
          maxResults: 10,
          minConfidence: 0.7,
        })
      );
    });
  });

  describe("Composite Orchestrator Flag (use_composite)", () => {
    it("should use Composite Orchestrator when flag is true", async () => {
      const request = new NextRequest(
        `${baseUrl}?query=test&use_composite=true`,
        { method: "GET" }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("answer");
      expect(data.method).toBe("composite");
    });

    it("should map request to CompositeTask correctly", async () => {
      const { CompositeOrchestrator } = await import("@/lib/ai/composite-orchestrator");
      const mockInstance = {
        execute: jest.fn(() => Promise.resolve({ result: "Test", steps: [] })),
      };
      (CompositeOrchestrator as any).mockImplementationOnce(() => mockInstance);

      const request = new NextRequest(
        `${baseUrl}?query=test&use_composite=true&tenantId=test-tenant`,
        { method: "GET" }
      );

      await GET(request);

      expect(mockInstance.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          type: expect.any(String),
          input: expect.any(String),
        })
      );
    });
  });

  describe("K2 Reasoning Flag (use_k2)", () => {
    it("should use K2 Reasoning when flag is true", async () => {
      const request = new NextRequest(
        `${baseUrl}?query=test&use_k2=true`,
        { method: "GET" }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("answer");
      expect(data.method).toBe("k2");
    });

    it("should use correct K2 reasoning parameters", async () => {
      const { K2Reasoning } = await import("@/lib/ai/k2-reasoning");
      const mockInstance = {
        reason: jest.fn(() => Promise.resolve({ conclusion: "Test", steps: [] })),
      };
      (K2Reasoning as any).mockImplementationOnce(() => mockInstance);

      const request = new NextRequest(
        `${baseUrl}?query=test&use_k2=true&maxSteps=5&requireVerification=true`,
        { method: "GET" }
      );

      await GET(request);

      expect(mockInstance.reason).toHaveBeenCalledWith(
        "test",
        expect.objectContaining({
          maxSteps: 5,
          requireVerification: true,
        })
      );
    });
  });

  describe("Multiple Flags", () => {
    it("should prioritize GraphRAG when multiple flags are set", async () => {
      const request = new NextRequest(
        `${baseUrl}?query=test&use_graphrag=true&use_composite=true&use_k2=true`,
        { method: "GET" }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.method).toBe("graphrag");
    });
  });

  describe("Error Handling", () => {
    it("should return 401 for unauthorized requests", async () => {
      const { requireAuth } = await import("@/lib/auth/session");
      (requireAuth as any).mockRejectedValueOnce(new Error("Unauthorized"));

      const request = new NextRequest(`${baseUrl}?query=test`, { method: "GET" });
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it("should return 400 for missing query", async () => {
      const request = new NextRequest(`${baseUrl}`, { method: "GET" });
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it("should handle service unavailability gracefully", async () => {
      const { DatabaseEvidenceVault } = await import("@/lib/evidence/vault-db");
      (DatabaseEvidenceVault as any).mockImplementationOnce(() => ({
        search: jest.fn(() => Promise.reject(new Error("Service unavailable"))),
        query: jest.fn(() => Promise.resolve([])),
        store: jest.fn(() => Promise.resolve("ev-123")),
      }));

      const request = new NextRequest(
        `${baseUrl}?query=test&use_graphrag=true`,
        { method: "GET" }
      );

      const response = await GET(request);
      expect(response.status).toBe(500);
    });
  });

  describe("Response Shape", () => {
    it("should return consistent response structure", async () => {
      const request = new NextRequest(
        `${baseUrl}?query=test&use_graphrag=true`,
        { method: "GET" }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data).toMatchObject({
        answer: expect.any(String),
        sources: expect.any(Array),
        method: expect.any(String),
        confidence: expect.any(Number),
      });
    });

    it("should include trace_id in response", async () => {
      const request = new NextRequest(
        `${baseUrl}?query=test&use_graphrag=true`,
        { method: "GET" }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty("trace_id");
    });
  });
});
