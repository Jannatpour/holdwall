/**
 * ANP Protocol Health Monitoring and Routing Tests
 */

import { ANPProtocol } from "@/lib/anp/protocol";
import { getA2AProtocol } from "@/lib/a2a/protocol";
import type { AgentNetwork } from "@/lib/anp/protocol";

describe("ANP Protocol Health Monitoring and Routing", () => {
  let protocol: ANPProtocol;
  let a2aProtocol: ReturnType<typeof getA2AProtocol>;

  beforeEach(() => {
    protocol = new ANPProtocol();
    a2aProtocol = getA2AProtocol();
  });

  afterEach(() => {
    protocol.destroy();
  });

  test("should create network and start health monitoring", async () => {
    const network: AgentNetwork = {
      networkId: "test-network",
      name: "Test Network",
      agents: [],
      topology: "mesh",
    };

    await protocol.createNetwork(network);
    const created = protocol.getNetwork("test-network");
    expect(created).toBeTruthy();
    expect(created?.networkId).toBe("test-network");
  });

  test("should check agent health", async () => {
    // Register agent first
    await a2aProtocol.registerAgent({
      agentId: "test-agent",
      name: "Test Agent",
      version: "1.0.0",
      capabilities: ["text_generation"],
      endpoint: "http://localhost:3000",
    });

    const health = await protocol.checkAgentHealth("test-agent");
    expect(health).toBeTruthy();
    expect(health.agentId).toBe("test-agent");
    expect(["healthy", "degraded", "unhealthy", "unknown"]).toContain(health.status);
  });

  test("should get network health report", async () => {
    // Register agents
    await a2aProtocol.registerAgent({
      agentId: "agent-1",
      name: "Agent 1",
      version: "1.0.0",
      capabilities: ["text_generation"],
      endpoint: "http://localhost:3001",
    });

    await a2aProtocol.registerAgent({
      agentId: "agent-2",
      name: "Agent 2",
      version: "1.0.0",
      capabilities: ["data_analysis"],
      endpoint: "http://localhost:3002",
    });

    const network: AgentNetwork = {
      networkId: "health-test-network",
      name: "Health Test Network",
      agents: ["agent-1", "agent-2"],
      topology: "mesh",
    };

    await protocol.createNetwork(network);

    const healthReport = await protocol.getNetworkHealthReport("health-test-network");
    expect(healthReport).toBeTruthy();
    expect(healthReport.networkId).toBe("health-test-network");
    expect(healthReport.agentCount).toBe(2);
    expect(healthReport.agentStatuses.length).toBe(2);
    expect(["healthy", "degraded", "unhealthy"]).toContain(healthReport.overallHealth);
  });

  test("should route message through network", async () => {
    // Register agents
    await a2aProtocol.registerAgent({
      agentId: "route-agent-1",
      name: "Route Agent 1",
      version: "1.0.0",
      capabilities: ["text_generation"],
      endpoint: "http://localhost:3001",
    });

    await a2aProtocol.registerAgent({
      agentId: "route-agent-2",
      name: "Route Agent 2",
      version: "1.0.0",
      capabilities: ["data_analysis"],
      endpoint: "http://localhost:3002",
    });

    const network: AgentNetwork = {
      networkId: "routing-network",
      name: "Routing Network",
      agents: ["route-agent-1", "route-agent-2"],
      topology: "mesh",
    };

    await protocol.createNetwork(network);

    const routingResult = await protocol.routeMessage(
      "routing-network",
      "route-agent-1",
      "route-agent-2"
    );

    expect(routingResult).toBeTruthy();
    expect(routingResult.path).toContain("route-agent-1");
    expect(routingResult.path).toContain("route-agent-2");
    expect(routingResult.hops).toBeGreaterThanOrEqual(0);
    expect(routingResult.estimatedLatency).toBeGreaterThanOrEqual(0);
    expect(routingResult.reliability).toBeGreaterThanOrEqual(0);
    expect(routingResult.reliability).toBeLessThanOrEqual(1);
  });

  test("should select best agent from network", async () => {
    // Register agents
    await a2aProtocol.registerAgent({
      agentId: "select-agent-1",
      name: "Select Agent 1",
      version: "1.0.0",
      capabilities: ["text_generation", "data_analysis"],
      endpoint: "http://localhost:3001",
    });

    await a2aProtocol.registerAgent({
      agentId: "select-agent-2",
      name: "Select Agent 2",
      version: "1.0.0",
      capabilities: ["code_execution"],
      endpoint: "http://localhost:3002",
    });

    const network: AgentNetwork = {
      networkId: "selection-network",
      name: "Selection Network",
      agents: ["select-agent-1", "select-agent-2"],
      topology: "mesh",
    };

    await protocol.createNetwork(network);

    const selected = await protocol.selectAgent("selection-network", {
      requiredCapabilities: ["text_generation"],
    });

    expect(selected).toBe("select-agent-1");
  });

  test("should stop health monitoring on destroy", () => {
    protocol.destroy();
    // Should not throw - health monitoring should be stopped
    expect(() => protocol.destroy()).not.toThrow();
  });
});
