/** @jest-environment node */
/**
 * Comprehensive Protocol Integration Tests
 * 
 * Tests all agent protocols (A2A, ANP, AG-UI, AP2) working together
 * in realistic scenarios with full integration.
 * 
 * These tests require:
 * - a configured database (DATABASE_URL)
 * - Redis connection (optional, falls back to in-memory)
 *
 * Enable explicitly via RUN_INTEGRATION_TESTS=true.
 */

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === "true" &&
  Boolean(process.env.DATABASE_URL);

const describeIntegration = runIntegration ? describe : describe.skip;

// Dynamic imports to avoid Next.js server module issues in Jest
let A2AProtocol: typeof import("@/lib/a2a/protocol").A2AProtocol;
let ANPProtocol: typeof import("@/lib/anp/protocol").ANPProtocol;
let AGUIProtocol: typeof import("@/lib/ag-ui/protocol").AGUIProtocol;
let AP2Protocol: typeof import("@/lib/payment/ap2").AP2Protocol;
let ProtocolBridge: typeof import("@/lib/agents/protocol-bridge").ProtocolBridge;
let db: typeof import("@/lib/db/client").db;
let eventStore: typeof import("@/lib/events/store").eventStore;
let logger: typeof import("@/lib/logging/logger").logger;

describeIntegration("Comprehensive Protocol Integration", () => {
  let a2aProtocol: InstanceType<typeof A2AProtocol>;
  let anpProtocol: InstanceType<typeof ANPProtocol>;
  let aguiProtocol: InstanceType<typeof AGUIProtocol>;
  let ap2Protocol: InstanceType<typeof AP2Protocol>;
  let protocolBridge: InstanceType<typeof ProtocolBridge>;
  
  const testTenantId = "test-tenant-protocols";
  const testUserId = "test-user-protocols";

  beforeAll(async () => {
    // Dynamic imports to avoid Next.js server module issues
    const a2aModule = await import("@/lib/a2a/protocol");
    const anpModule = await import("@/lib/anp/protocol");
    const aguiModule = await import("@/lib/ag-ui/protocol");
    const ap2Module = await import("@/lib/payment/ap2");
    const bridgeModule = await import("@/lib/agents/protocol-bridge");
    const dbModule = await import("@/lib/db/client");
    const eventModule = await import("@/lib/events/store");
    const loggerModule = await import("@/lib/logging/logger");

    A2AProtocol = a2aModule.A2AProtocol;
    ANPProtocol = anpModule.ANPProtocol;
    AGUIProtocol = aguiModule.AGUIProtocol;
    AP2Protocol = ap2Module.AP2Protocol;
    ProtocolBridge = bridgeModule.ProtocolBridge;
    db = dbModule.db;
    eventStore = eventModule.eventStore;
    logger = loggerModule.logger;

    // Initialize protocols
    a2aProtocol = new A2AProtocol();
    anpProtocol = new ANPProtocol();
    aguiProtocol = new AGUIProtocol();
    ap2Protocol = new AP2Protocol();
    protocolBridge = new ProtocolBridge();
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await db.agentRegistry.deleteMany({
        where: { tenantId: testTenantId },
      });
      await db.agentNetwork.deleteMany({
        where: { tenantId: testTenantId },
      });
      await db.conversationSession.deleteMany({
        where: { tenantId: testTenantId },
      });
      await db.paymentMandate.deleteMany({
        where: { tenantId: testTenantId },
      });
    } catch (error) {
      logger.warn("Cleanup error (expected in test environment)", { error });
    }
  });

  describe("End-to-End Agent Workflow", () => {
    it("should complete full agent lifecycle: register → network → session → payment", async () => {
      // Step 1: Register agent with OASF profile
      const agentProfile = {
        agentId: "test-agent-integration",
        name: "Integration Test Agent",
        version: "1.0.0",
        description: "Test agent for integration",
        capabilities: ["text_generation", "data_analysis"],
        skills: [
          {
            skill: "natural_language_processing",
            proficiency: 0.9,
            verified: true,
          },
        ],
        cost: {
          baseCost: 0.01,
          currency: "USD",
          pricingModel: "per_request",
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
          currentLoad: 0,
        },
      };

      const registration = await a2aProtocol.registerAgent(
        testTenantId,
        agentProfile.agentId,
        agentProfile.name,
        agentProfile.capabilities,
        agentProfile
      );

      expect(registration).toBeDefined();
      expect(registration.agentId).toBe(agentProfile.agentId);

      // Step 2: Create network and join
      const network = await anpProtocol.createNetwork(
        testTenantId,
        "test-network",
        "mesh",
        { description: "Test network" }
      );

      expect(network).toBeDefined();
      expect(network.networkId).toBeDefined();

      const joinResult = await anpProtocol.joinNetwork(
        testTenantId,
        network.networkId,
        registration.agentId,
        { capabilities: agentProfile.capabilities }
      );

      expect(joinResult).toBeDefined();
      expect(joinResult.success).toBe(true);

      // Step 3: Start AG-UI session
      const session = await aguiProtocol.startSession(
        testTenantId,
        testUserId,
        {
          intent: "analyze_data",
          context: { agentId: registration.agentId },
        }
      );

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();

      // Step 4: Create payment mandate
      const mandate = await ap2Protocol.createMandate(
        testTenantId,
        testUserId,
        {
          type: "intent",
          description: "Payment for agent services",
          amount: 10.0,
          currency: "USD",
          recipientAgentId: registration.agentId,
        }
      );

      expect(mandate).toBeDefined();
      expect(mandate.mandateId).toBeDefined();

      // Step 5: Approve mandate
      const approval = await ap2Protocol.approveMandate(
        testTenantId,
        mandate.mandateId,
        testUserId,
        { signature: "test-signature" }
      );

      expect(approval).toBeDefined();
      expect(approval.status).toBe("approved");

      // Step 6: Execute payment
      const payment = await ap2Protocol.executePayment(
        testTenantId,
        mandate.mandateId,
        testUserId,
        { amount: 10.0, currency: "USD" }
      );

      expect(payment).toBeDefined();
      expect(payment.status).toBe("completed");

      // Verify all data persisted
      const agent = await db.agentRegistry.findUnique({
        where: { id: registration.agentId },
      });
      expect(agent).toBeDefined();

      const networkRecord = await db.agentNetwork.findUnique({
        where: { id: network.networkId },
      });
      expect(networkRecord).toBeDefined();

      const sessionRecord = await db.conversationSession.findUnique({
        where: { id: session.sessionId },
      });
      expect(sessionRecord).toBeDefined();

      const mandateRecord = await db.paymentMandate.findUnique({
        where: { id: mandate.mandateId },
      });
      expect(mandateRecord).toBeDefined();
      expect(mandateRecord?.status).toBe("approved");
    });
  });

  describe("Protocol Bridge Integration", () => {
    it("should route messages through protocol bridge", async () => {
      // Register agent
      const agentId = "test-agent-bridge";
      await a2aProtocol.registerAgent(
        testTenantId,
        agentId,
        "Bridge Test Agent",
        ["text_generation"],
        {
          agentId,
          name: "Bridge Test Agent",
          version: "1.0.0",
          capabilities: ["text_generation"],
        }
      );

      // Use protocol bridge to send message
      const result = await protocolBridge.execute({
        protocol: "a2a",
        action: "send_message",
        input: {
          tenantId: testTenantId,
          fromAgentId: "local-agent",
          toAgentId: agentId,
          message: { type: "text", content: "Test message" },
        },
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it("should handle network operations through bridge", async () => {
      // Create network
      const network = await anpProtocol.createNetwork(
        testTenantId,
        "bridge-network",
        "star",
        {}
      );

      // Use bridge to get network health
      const result = await protocolBridge.execute({
        protocol: "anp",
        action: "get_network_health",
        input: {
          tenantId: testTenantId,
          networkId: network.networkId,
        },
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe("Error Handling and Resilience", () => {
    it("should handle missing agent gracefully", async () => {
      const result = await a2aProtocol.sendMessage(
        testTenantId,
        "local-agent",
        "non-existent-agent",
        { type: "text", content: "Test" }
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });

    it("should handle network errors gracefully", async () => {
      const result = await anpProtocol.getNetworkHealth(
        testTenantId,
        "non-existent-network"
      );

      expect(result).toBeDefined();
      expect(result.health).toBe("unknown");
    });

    it("should handle payment errors gracefully", async () => {
      const result = await ap2Protocol.executePayment(
        testTenantId,
        "non-existent-mandate",
        testUserId,
        { amount: 10.0, currency: "USD" }
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });
  });

  describe("Health Monitoring Integration", () => {
    it("should report health for all protocols", async () => {
      const a2aHealth = a2aProtocol.getHealth();
      expect(a2aHealth).toBeDefined();
      expect(a2aHealth.agentCount).toBeGreaterThanOrEqual(0);

      const anpHealth = anpProtocol.getHealth();
      expect(anpHealth).toBeDefined();
      expect(anpHealth.networkCount).toBeGreaterThanOrEqual(0);

      const aguiHealth = aguiProtocol.getHealth();
      expect(aguiHealth).toBeDefined();
      expect(aguiHealth.sessionCount).toBeGreaterThanOrEqual(0);

      const ap2Health = ap2Protocol.getHealth();
      expect(ap2Health).toBeDefined();
    });
  });

  describe("Event Store Integration", () => {
    it("should store protocol events in event store", async () => {
      const agentId = "test-agent-events";
      await a2aProtocol.registerAgent(
        testTenantId,
        agentId,
        "Event Test Agent",
        ["text_generation"],
        {
          agentId,
          name: "Event Test Agent",
          version: "1.0.0",
          capabilities: ["text_generation"],
        }
      );

      // Check if events were stored
      const events = await eventStore.query({
        tenantId: testTenantId,
        entityType: "agent",
        entityId: agentId,
        limit: 10,
      });

      expect(events).toBeDefined();
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe("OASF Profile Integration", () => {
    it("should use OASF profiles for agent selection", async () => {
      // Register multiple agents with different profiles
      const agent1 = await a2aProtocol.registerAgent(
        testTenantId,
        "agent-1-oasf",
        "Agent 1",
        ["text_generation"],
        {
          agentId: "agent-1-oasf",
          name: "Agent 1",
          version: "1.0.0",
          capabilities: ["text_generation"],
          skills: [
            {
              skill: "nlp",
              proficiency: 0.9,
              verified: true,
            },
          ],
          cost: {
            baseCost: 0.01,
            currency: "USD",
            pricingModel: "per_request",
          },
          reliability: {
            uptime: 0.99,
            successRate: 0.95,
            averageLatency: 200,
            lastVerified: new Date(),
          },
        }
      );

      const agent2 = await a2aProtocol.registerAgent(
        testTenantId,
        "agent-2-oasf",
        "Agent 2",
        ["text_generation"],
        {
          agentId: "agent-2-oasf",
          name: "Agent 2",
          version: "1.0.0",
          capabilities: ["text_generation"],
          skills: [
            {
              skill: "nlp",
              proficiency: 0.8,
              verified: true,
            },
          ],
          cost: {
            baseCost: 0.02,
            currency: "USD",
            pricingModel: "per_request",
          },
          reliability: {
            uptime: 0.98,
            successRate: 0.90,
            averageLatency: 300,
            lastVerified: new Date(),
          },
        }
      );

      // Discover agents with filters
      const discovery = await a2aProtocol.discoverAgents(testTenantId, {
        capabilities: ["text_generation"],
        maxCost: 0.015,
        minReliability: 0.94,
      });

      expect(discovery).toBeDefined();
      expect(discovery.agents.length).toBeGreaterThan(0);
      // Agent 1 should be selected (lower cost, higher reliability)
      expect(discovery.agents[0].agentId).toBe(agent1.agentId);
    });
  });
});
