/**
 * A2A OASF Profile Tests
 * 
 * Tests for OASF (Open Agentic Schema) agent profile functionality
 */

import { A2AProtocol, type AgentProfile } from "@/lib/a2a/protocol";

describe("A2A OASF Profile", () => {
  let a2aProtocol: A2AProtocol;
  const testProfile: AgentProfile = {
    agentId: "test-agent-oasf",
    name: "Test OASF Agent",
    version: "1.0.0",
    description: "Test agent with OASF profile",
    capabilities: ["text_generation", "data_analysis"],
    skills: [
      {
        skill: "natural_language_processing",
        proficiency: 0.9,
        verified: true,
      },
      {
        skill: "data_analysis",
        proficiency: 0.8,
        verified: true,
      },
    ],
    cost: {
      baseCost: 0.01,
      currency: "USD",
      pricingModel: "per_request",
      tokenCost: 0.002,
    },
    reliability: {
      uptime: 0.99,
      successRate: 0.95,
      averageLatency: 250,
      lastVerified: new Date(),
    },
    availability: {
      status: "available",
      maxConcurrentTasks: 10,
      currentLoad: 2,
    },
    metadata: {
      author: "Test Author",
      tags: ["test", "nlp", "analysis"],
      documentation: "https://example.com/docs",
      license: "MIT",
      supportContact: "support@example.com",
    },
  };

  beforeEach(() => {
    a2aProtocol = new A2AProtocol();
  });

  describe("Agent Registration with Profile", () => {
    it("should register agent with OASF profile", async () => {
      await a2aProtocol.registerAgentWithProfile(
        testProfile,
        "https://example.com/agent",
        "test-public-key"
      );

      const agent = a2aProtocol.getAgent(testProfile.agentId);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe(testProfile.name);
      expect(agent?.metadata?.profile).toBeDefined();
    });

    it("should retrieve agent with profile", async () => {
      await a2aProtocol.registerAgentWithProfile(
        testProfile,
        "https://example.com/agent",
        "test-public-key"
      );

      const agent = a2aProtocol.getAgent(testProfile.agentId);
      const profile = agent?.metadata?.profile as AgentProfile | undefined;

      expect(profile).toBeDefined();
      expect(profile?.agentId).toBe(testProfile.agentId);
      expect(profile?.skills).toHaveLength(2);
      expect(profile?.cost.baseCost).toBe(0.01);
      expect(profile?.reliability.uptime).toBe(0.99);
      expect(profile?.availability.status).toBe("available");
    });
  });

  describe("Agent Discovery with OASF Filters", () => {
    beforeEach(async () => {
      await a2aProtocol.registerAgentWithProfile(
        testProfile,
        "https://example.com/agent",
        "test-public-key"
      );
    });

    it("should filter agents by cost", async () => {
      const result = await a2aProtocol.discoverAgents({
        requesterAgentId: "system",
        requiredCapabilities: ["text_generation"],
        filters: {
          maxCost: 0.05,
        },
        maxResults: 10,
      });

      expect(result.agents.length).toBeGreaterThan(0);
      const agent = result.agents[0];
      const profile = agent.metadata?.profile as AgentProfile | undefined;
      if (profile) {
        expect(profile.cost.baseCost).toBeLessThanOrEqual(0.05);
      }
    });

    it("should filter agents by reliability", async () => {
      const result = await a2aProtocol.discoverAgents({
        requesterAgentId: "system",
        requiredCapabilities: ["text_generation"],
        filters: {
          minReliability: 0.9,
        },
        maxResults: 10,
      });

      expect(result.agents.length).toBeGreaterThan(0);
    });

    it("should filter agents by required skills", async () => {
      const result = await a2aProtocol.discoverAgents({
        requesterAgentId: "system",
        requiredCapabilities: ["text_generation"],
        filters: {
          requiredSkills: ["natural_language_processing"],
        },
        maxResults: 10,
      });

      expect(result.agents.length).toBeGreaterThan(0);
      const agent = result.agents[0];
      const profile = agent.metadata?.profile as AgentProfile | undefined;
      if (profile) {
        const hasSkill = profile.skills.some(
          (s) => s.skill === "natural_language_processing" && s.proficiency >= 0.7 && s.verified
        );
        expect(hasSkill).toBe(true);
      }
    });

    it("should filter agents by availability", async () => {
      const result = await a2aProtocol.discoverAgents({
        requesterAgentId: "system",
        requiredCapabilities: ["text_generation"],
        filters: {
          availableOnly: true,
        },
        maxResults: 10,
      });

      expect(result.agents.length).toBeGreaterThan(0);
      const agent = result.agents[0];
      const profile = agent.metadata?.profile as AgentProfile | undefined;
      if (profile) {
        expect(profile.availability.status).toBe("available");
        expect(profile.availability.currentLoad).toBeLessThan(profile.availability.maxConcurrentTasks);
      }
    });

    it("should sort agents by cost", async () => {
      // Register another agent with higher cost
      const expensiveProfile: AgentProfile = {
        ...testProfile,
        agentId: "expensive-agent",
        name: "Expensive Agent",
        cost: {
          ...testProfile.cost,
          baseCost: 0.1,
        },
      };

      await a2aProtocol.registerAgentWithProfile(
        expensiveProfile,
        "https://example.com/expensive",
        "test-public-key-2"
      );

      const result = await a2aProtocol.discoverAgents({
        requesterAgentId: "system",
        requiredCapabilities: ["text_generation"],
        filters: {},
        maxResults: 10,
        sortBy: "cost",
      });

      expect(result.agents.length).toBeGreaterThanOrEqual(2);
      // First agent should have lower cost
      const firstProfile = result.agents[0].metadata?.profile as AgentProfile | undefined;
      const secondProfile = result.agents[1].metadata?.profile as AgentProfile | undefined;
      if (firstProfile && secondProfile) {
        expect(firstProfile.cost.baseCost).toBeLessThanOrEqual(secondProfile.cost.baseCost);
      }
    });

    it("should sort agents by reliability", async () => {
      const result = await a2aProtocol.discoverAgents({
        requesterAgentId: "system",
        requiredCapabilities: ["text_generation"],
        filters: {},
        maxResults: 10,
        sortBy: "reliability",
      });

      expect(result.agents.length).toBeGreaterThan(0);
    });
  });

  describe("Agent Hiring", () => {
    beforeEach(async () => {
      await a2aProtocol.registerAgentWithProfile(
        testProfile,
        "https://example.com/agent",
        "test-public-key"
      );
    });

    it("should hire agent based on task requirements", async () => {
      const hiredAgent = await a2aProtocol.hireAgent({
        taskType: "text_analysis",
        requiredCapabilities: ["text_generation", "data_analysis"],
        budget: 0.05,
        maxLatency: 500,
        requiredSkills: ["natural_language_processing"],
      });

      expect(hiredAgent).toBeDefined();
      expect(hiredAgent?.agentId).toBe(testProfile.agentId);
    });

    it("should return null if no suitable agent found", async () => {
      const hiredAgent = await a2aProtocol.hireAgent({
        taskType: "image_processing",
        requiredCapabilities: ["image_processing"],
        budget: 0.001,
        maxLatency: 50,
      });

      expect(hiredAgent).toBeNull();
    });

    it("should filter by latency when hiring", async () => {
      const hiredAgent = await a2aProtocol.hireAgent({
        taskType: "text_analysis",
        requiredCapabilities: ["text_generation"],
        maxLatency: 100, // Very strict latency requirement
      });

      // Should return null if no agent meets latency requirement
      // (testProfile has 250ms latency)
      expect(hiredAgent).toBeNull();
    });
  });

  describe("Reliability Score Calculation", () => {
    it("should calculate reliability score correctly", async () => {
      await a2aProtocol.registerAgentWithProfile(
        testProfile,
        "https://example.com/agent",
        "test-public-key"
      );

      const result = await a2aProtocol.discoverAgents({
        requesterAgentId: "system",
        requiredCapabilities: ["text_generation"],
        filters: {
          minReliability: 0.8,
        },
        maxResults: 10,
      });

      // Should find the agent since it has high reliability
      expect(result.agents.length).toBeGreaterThan(0);
    });
  });
});
