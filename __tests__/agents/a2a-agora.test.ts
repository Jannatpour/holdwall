/**
 * A2A Protocol AGORA Optimization Tests
 */

import { A2AProtocol } from "@/lib/a2a/protocol";
import type { AgentIdentity } from "@/lib/a2a/protocol";

describe("A2A Protocol AGORA Optimization", () => {
  let protocol: A2AProtocol;
  let agent1: AgentIdentity;
  let agent2: AgentIdentity;

  beforeEach(() => {
    protocol = new A2AProtocol();
    agent1 = {
      agentId: "agent-1",
      name: "Test Agent 1",
      version: "1.0.0",
      capabilities: ["text_generation", "data_analysis"],
      endpoint: "http://localhost:3001",
    };
    agent2 = {
      agentId: "agent-2",
      name: "Test Agent 2",
      version: "1.0.0",
      capabilities: ["text_generation", "code_execution"],
      endpoint: "http://localhost:3002",
    };
  });

  afterEach(async () => {
    // Cleanup
    try {
      await protocol.unregisterAgent("agent-1");
      await protocol.unregisterAgent("agent-2");
    } catch {
      // Ignore cleanup errors
    }
  });

  test("should convert 'get resource' to routine", async () => {
    await protocol.registerAgent(agent1);
    await protocol.registerAgent(agent2);
    await protocol.connectAgents("agent-1", "agent-2");

    const message = {
      messageId: "msg-1",
      fromAgentId: "agent-1",
      toAgentId: "agent-2",
      type: "request" as const,
      payload: "get user profile",
      timestamp: new Date(),
    };

    await protocol.sendMessage(message);
    const received = await protocol.receiveMessages("agent-2");

    expect(received.length).toBe(1);
    const payload = received[0].payload;
    expect(payload).toHaveProperty("type", "routine");
    expect(payload).toHaveProperty("action", "get");
    expect(payload).toHaveProperty("parameters");
  });

  test("should convert 'create document' to routine", async () => {
    await protocol.registerAgent(agent1);
    await protocol.registerAgent(agent2);
    await protocol.connectAgents("agent-1", "agent-2");

    const message = {
      messageId: "msg-2",
      fromAgentId: "agent-1",
      toAgentId: "agent-2",
      type: "request" as const,
      payload: "create new document",
      timestamp: new Date(),
    };

    await protocol.sendMessage(message);
    const received = await protocol.receiveMessages("agent-2");

    expect(received.length).toBe(1);
    const payload = received[0].payload;
    expect(payload).toHaveProperty("type", "routine");
    expect(payload).toHaveProperty("action", "create");
  });

  test("should preserve existing routine payloads", async () => {
    await protocol.registerAgent(agent1);
    await protocol.registerAgent(agent2);
    await protocol.connectAgents("agent-1", "agent-2");

    const routinePayload = {
      type: "routine",
      action: "execute",
      parameters: { capability: "text_generation", input: "test" },
    };

    const message = {
      messageId: "msg-3",
      fromAgentId: "agent-1",
      toAgentId: "agent-2",
      type: "request" as const,
      payload: routinePayload,
      timestamp: new Date(),
    };

    await protocol.sendMessage(message);
    const received = await protocol.receiveMessages("agent-2");

    expect(received.length).toBe(1);
    expect(received[0].payload).toEqual(routinePayload);
  });

  test("should fallback to NL when no routine match", async () => {
    await protocol.registerAgent(agent1);
    await protocol.registerAgent(agent2);
    await protocol.connectAgents("agent-1", "agent-2");

    const nlPayload = "Hello, how are you today?";

    const message = {
      messageId: "msg-4",
      fromAgentId: "agent-1",
      toAgentId: "agent-2",
      type: "notification" as const,
      payload: nlPayload,
      timestamp: new Date(),
    };

    await protocol.sendMessage(message);
    const received = await protocol.receiveMessages("agent-2");

    expect(received.length).toBe(1);
    expect(received[0].payload).toBe(nlPayload);
  });
});
