/**
 * A2A (Agent-to-Agent Protocol)
 * 
 * Standardized protocol for AI agents to discover, connect, and communicate
 * with each other directly, enabling collaboration.
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { db } from "@/lib/db/client";
import { getProtocolSecurity } from "@/lib/security/protocol-security";
import type { ACPMessageEnvelope } from "@/lib/acp/types";
import { DatabaseEventStore } from "@/lib/events/store-db";

export type AgentCapability = 
  | "text_generation"
  | "code_execution"
  | "data_analysis"
  | "web_search"
  | "file_operations"
  | "database_query"
  | "api_integration"
  | "image_processing"
  | "audio_processing"
  | "custom";

/**
 * OASF (Open Agentic Schema) Agent Profile
 * Defines agent skills, costs, and reliability for discovery and hiring
 */
export interface AgentProfile {
  agentId: string;
  name: string;
  version: string;
  description?: string;
  capabilities: AgentCapability[];
  skills: Array<{
    skill: string;
    proficiency: number; // 0-1
    verified: boolean;
  }>;
  cost: {
    baseCost: number; // Base cost per request
    currency: string;
    pricingModel: "per_request" | "per_token" | "per_minute" | "subscription" | "free";
    tokenCost?: number; // Cost per 1k tokens (if applicable)
  };
  reliability: {
    uptime: number; // 0-1
    successRate: number; // 0-1
    averageLatency: number; // ms
    lastVerified: Date;
  };
  availability: {
    status: "available" | "busy" | "offline" | "maintenance";
    maxConcurrentTasks: number;
    currentLoad: number;
  };
  metadata?: {
    author?: string;
    tags?: string[];
    documentation?: string;
    license?: string;
    supportContact?: string;
  };
}

export interface AgentIdentity {
  agentId: string;
  name: string;
  version: string;
  capabilities: AgentCapability[];
  endpoint: string; // Agent's communication endpoint
  publicKey?: string; // For secure communication
  metadata?: {
    description?: string;
    author?: string;
    tags?: string[];
    maxConcurrentConnections?: number;
    rateLimit?: {
      requestsPerMinute: number;
      requestsPerHour: number;
    };
    // OASF profile data
    profile?: AgentProfile;
  };
}

export interface AgentConnection {
  connectionId: string;
  agentId: string;
  peerAgentId: string;
  status: "connecting" | "connected" | "disconnected" | "error";
  establishedAt: Date;
  lastHeartbeat?: Date;
  capabilities: AgentCapability[];
  metadata?: {
    protocolVersion?: string;
    encryptionEnabled?: boolean;
    latency?: number;
  };
}

export interface AgentMessage {
  messageId: string;
  fromAgentId: string;
  toAgentId: string;
  type: "request" | "response" | "notification" | "heartbeat";
  payload: unknown;
  timestamp: Date;
  correlationId?: string; // For request/response matching
  metadata?: {
    priority?: "low" | "normal" | "high" | "urgent";
    timeout?: number;
    retryCount?: number;
  };
}

export interface AgentDiscoveryRequest {
  requesterAgentId: string;
  requiredCapabilities?: AgentCapability[];
  filters?: {
    tags?: string[];
    version?: string;
    minUptime?: number;
    maxCost?: number; // Maximum cost per request
    minReliability?: number; // Minimum reliability score (0-1)
    requiredSkills?: string[]; // Required skills
    availableOnly?: boolean; // Only return available agents
  };
  maxResults?: number;
  sortBy?: "cost" | "reliability" | "latency" | "uptime"; // Sort results
}

export interface AgentDiscoveryResponse {
  agents: AgentIdentity[];
  totalFound: number;
  searchTime: number;
}

/**
 * A2A Protocol Implementation
 */
export class A2AProtocol {
  private agentRegistry: Map<string, AgentIdentity> = new Map();
  private connections: Map<string, AgentConnection> = new Map();
  private messageQueue: Map<string, AgentMessage[]> = new Map();
  private eventStore: DatabaseEventStore;

  constructor() {
    this.eventStore = new DatabaseEventStore();
    this.startHeartbeatMonitor();
  }

  /**
   * Register agent in the network with security verification
   */
  async registerAgent(identity: AgentIdentity): Promise<void> {
    // Verify agent identity with protocol security
    const protocolSecurity = getProtocolSecurity();
    const securityContext = await protocolSecurity.verifyAgentIdentity(identity.agentId);

    if (!securityContext || !securityContext.identityVerified) {
      throw new Error(`Agent identity verification failed: ${identity.agentId}`);
    }

    // Check permissions
    const hasPermission = await protocolSecurity.checkProtocolPermission(
      identity.agentId,
      "a2a",
      "register"
    );

    if (!hasPermission) {
      throw new Error(`Agent ${identity.agentId} does not have permission to register`);
    }

    this.agentRegistry.set(identity.agentId, identity);
    
    // Store in database for persistence (Prisma model: AgentRegistry)
    try {
      await db.agentRegistry.upsert({
        where: { agentId: identity.agentId },
        create: {
          agentId: identity.agentId,
          name: identity.name,
          version: identity.version,
          capabilities: identity.capabilities as any,
          endpoint: identity.endpoint,
          publicKey: identity.publicKey || null,
          metadata: (identity.metadata || {}) as any,
        },
        update: {
          name: identity.name,
          version: identity.version,
          capabilities: identity.capabilities as any,
          endpoint: identity.endpoint,
          publicKey: identity.publicKey || null,
          metadata: (identity.metadata || {}) as any,
        },
      });
    } catch (error) {
      logger.warn("Failed to persist agent registration to database", {
        error: error instanceof Error ? error.message : String(error),
        agentId: identity.agentId,
      });
    }

    metrics.increment("a2a_agents_registered_total", {
      agent_id: identity.agentId,
    });

    logger.info("Agent registered in A2A network", {
      agentId: identity.agentId,
      name: identity.name,
      capabilities: identity.capabilities,
    });
  }

  /**
   * Unregister agent
   */
  async unregisterAgent(agentId: string): Promise<void> {
    this.agentRegistry.delete(agentId);
    
    // Close all connections
    for (const [connId, conn] of this.connections.entries()) {
      if (conn.agentId === agentId || conn.peerAgentId === agentId) {
        this.connections.delete(connId);
      }
    }

    // Remove from database (Prisma model: AgentRegistry)
    try {
      await db.agentRegistry.delete({ where: { agentId } });
    } catch (error) {
      logger.warn("Failed to remove agent from database", {
        error: error instanceof Error ? error.message : String(error),
        agentId,
      });
    }

    logger.info("Agent unregistered from A2A network", { agentId });
  }

  /**
   * Discover agents by capabilities with OASF-based filtering and hiring logic
   */
  async discoverAgents(request: AgentDiscoveryRequest): Promise<AgentDiscoveryResponse> {
    const startTime = Date.now();
    const results: AgentIdentity[] = [];
    const scoredResults: Array<{ agent: AgentIdentity; score: number }> = [];

    for (const [agentId, agent] of this.agentRegistry.entries()) {
      // Skip requester
      if (agentId === request.requesterAgentId) {
        continue;
      }

      // Check required capabilities
      if (request.requiredCapabilities && request.requiredCapabilities.length > 0) {
        const hasAllCapabilities = request.requiredCapabilities.every((cap) =>
          agent.capabilities.includes(cap)
        );
        if (!hasAllCapabilities) {
          continue;
        }
      }

      // Check OASF profile filters
      const profile = agent.metadata?.profile as AgentProfile | undefined;
      
      if (request.filters) {
        // Check tags
        if (request.filters.tags && agent.metadata?.tags) {
          const hasMatchingTag = request.filters.tags.some((tag) =>
            agent.metadata!.tags!.includes(tag)
          );
          if (!hasMatchingTag) {
            continue;
          }
        }

        // Check version
        if (request.filters.version && agent.version !== request.filters.version) {
          continue;
        }

        // Check cost
        if (request.filters.maxCost !== undefined && profile?.cost) {
          if (profile.cost.baseCost > request.filters.maxCost) {
            continue;
          }
        }

        // Check reliability
        if (request.filters.minReliability !== undefined && profile?.reliability) {
          const reliabilityScore = this.calculateReliabilityScore(profile.reliability);
          if (reliabilityScore < request.filters.minReliability) {
            continue;
          }
        }

        // Check required skills
        if (request.filters.requiredSkills && profile?.skills) {
          const hasAllSkills = request.filters.requiredSkills.every((requiredSkill) =>
            profile.skills.some(
              (skill) => skill.skill === requiredSkill && skill.proficiency >= 0.7 && skill.verified
            )
          );
          if (!hasAllSkills) {
            continue;
          }
        }

        // Check availability
        if (request.filters.availableOnly && profile?.availability) {
          if (profile.availability.status !== "available") {
            continue;
          }
          if (profile.availability.currentLoad >= profile.availability.maxConcurrentTasks) {
            continue;
          }
        }

        // Check uptime
        if (request.filters.minUptime !== undefined && profile?.reliability) {
          if (profile.reliability.uptime < request.filters.minUptime) {
            continue;
          }
        }
      }

      // Calculate hiring score for sorting
      let score = 0;
      if (profile) {
        // Reliability score (0-40 points)
        const reliabilityScore = this.calculateReliabilityScore(profile.reliability);
        score += reliabilityScore * 40;

        // Cost score (0-30 points, lower cost = higher score)
        if (profile.cost) {
          const normalizedCost = Math.max(0, 1 - profile.cost.baseCost / 1000); // Normalize to 0-1
          score += normalizedCost * 30;
        }

        // Availability score (0-20 points)
        if (profile.availability.status === "available") {
          const loadRatio = profile.availability.maxConcurrentTasks > 0
            ? 1 - (profile.availability.currentLoad / profile.availability.maxConcurrentTasks)
            : 1;
          score += loadRatio * 20;
        }

        // Skill proficiency score (0-10 points)
        if (profile.skills.length > 0) {
          const avgProficiency = profile.skills.reduce((sum, s) => sum + s.proficiency, 0) / profile.skills.length;
          score += avgProficiency * 10;
        }
      } else {
        // Default score for agents without OASF profile
        score = 50;
      }

      scoredResults.push({ agent, score });
    }

    // Sort by score if sortBy is specified
    if (request.sortBy) {
      scoredResults.sort((a, b) => {
        if (request.sortBy === "cost") {
          const costA = (a.agent.metadata?.profile as AgentProfile | undefined)?.cost?.baseCost || Infinity;
          const costB = (b.agent.metadata?.profile as AgentProfile | undefined)?.cost?.baseCost || Infinity;
          return costA - costB;
        } else if (request.sortBy === "reliability") {
          const relA = this.calculateReliabilityScore(
            (a.agent.metadata?.profile as AgentProfile | undefined)?.reliability
          );
          const relB = this.calculateReliabilityScore(
            (b.agent.metadata?.profile as AgentProfile | undefined)?.reliability
          );
          return relB - relA; // Higher is better
        } else if (request.sortBy === "latency") {
          const latA = (a.agent.metadata?.profile as AgentProfile | undefined)?.reliability?.averageLatency || Infinity;
          const latB = (b.agent.metadata?.profile as AgentProfile | undefined)?.reliability?.averageLatency || Infinity;
          return latA - latB;
        } else if (request.sortBy === "uptime") {
          const uptimeA = (a.agent.metadata?.profile as AgentProfile | undefined)?.reliability?.uptime || 0;
          const uptimeB = (b.agent.metadata?.profile as AgentProfile | undefined)?.reliability?.uptime || 0;
          return uptimeB - uptimeA; // Higher is better
        }
        return b.score - a.score; // Default: sort by hiring score
      });
    } else {
      // Default: sort by hiring score
      scoredResults.sort((a, b) => b.score - a.score);
    }

    // Extract agents and apply maxResults
    for (const { agent } of scoredResults) {
      results.push(agent);
      if (request.maxResults && results.length >= request.maxResults) {
        break;
      }
    }

    const searchTime = Date.now() - startTime;

    metrics.histogram("a2a_discovery_time_ms", searchTime);
    metrics.gauge("a2a_discovery_results_count", results.length);

    logger.debug("Agent discovery completed", {
      requesterAgentId: request.requesterAgentId,
      resultsCount: results.length,
      searchTime,
      sortBy: request.sortBy,
    });

    return {
      agents: results,
      totalFound: scoredResults.length,
      searchTime,
    };
  }

  /**
   * Calculate reliability score from OASF reliability data
   */
  private calculateReliabilityScore(
    reliability?: AgentProfile["reliability"]
  ): number {
    if (!reliability) {
      return 0.5; // Default score
    }

    // Weighted combination: uptime (40%), success rate (40%), latency (20%)
    const uptimeScore = reliability.uptime;
    const successRateScore = reliability.successRate;
    const latencyScore = Math.max(0, 1 - reliability.averageLatency / 5000); // Normalize latency (5s = 0)

    return uptimeScore * 0.4 + successRateScore * 0.4 + latencyScore * 0.2;
  }

  /**
   * Register agent with OASF profile
   */
  async registerAgentWithProfile(profile: AgentProfile, endpoint: string, publicKey?: string): Promise<void> {
    const identity: AgentIdentity = {
      agentId: profile.agentId,
      name: profile.name,
      version: profile.version,
      capabilities: profile.capabilities,
      endpoint,
      publicKey,
      metadata: {
        description: profile.description,
        author: profile.metadata?.author,
        tags: profile.metadata?.tags,
        profile,
      },
    };

    await this.registerAgent(identity);
  }

  /**
   * Hire agent (select best agent for task based on OASF profile)
   */
  async hireAgent(request: {
    taskType: string;
    requiredCapabilities: AgentCapability[];
    budget?: number;
    maxLatency?: number;
    requiredSkills?: string[];
  }): Promise<AgentIdentity | null> {
    const discoveryRequest: AgentDiscoveryRequest = {
      requesterAgentId: "system",
      requiredCapabilities: request.requiredCapabilities,
      filters: {
        maxCost: request.budget,
        minReliability: 0.7,
        requiredSkills: request.requiredSkills,
        availableOnly: true,
      },
      maxResults: 10,
      sortBy: "reliability",
    };

    const result = await this.discoverAgents(discoveryRequest);
    
    if (result.agents.length === 0) {
      return null;
    }

    // Filter by latency if specified
    let candidates = result.agents;
    if (request.maxLatency) {
      candidates = result.agents.filter((agent) => {
        const profile = agent.metadata?.profile as AgentProfile | undefined;
        return !profile?.reliability || profile.reliability.averageLatency <= request.maxLatency!;
      });
    }

    // Return best candidate
    return candidates[0] || null;
  }

  /**
   * Connect two agents
   */
  async connectAgents(
    agentId: string,
    peerAgentId: string
  ): Promise<AgentConnection> {
    const agent = this.agentRegistry.get(agentId);
    const peerAgent = this.agentRegistry.get(peerAgentId);

    if (!agent || !peerAgent) {
      throw new Error(
        `Agent not found: ${!agent ? agentId : peerAgentId}`
      );
    }

    const connectionId = `${agentId}:${peerAgentId}`;
    const connection: AgentConnection = {
      connectionId,
      agentId,
      peerAgentId,
      status: "connecting",
      establishedAt: new Date(),
      capabilities: peerAgent.capabilities,
    };

    // Attempt connection with actual network call
    try {
      // Make HTTP request to peer agent endpoint
      const peerEndpoint = peerAgent.endpoint;
      if (!peerEndpoint) {
        throw new Error(`Peer agent ${peerAgentId} has no endpoint configured`);
      }

      const connectResponse = await fetch(`${peerEndpoint}/a2a/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          peerAgentId,
          connectionId,
          capabilities: agent.capabilities,
        }),
      });

      if (!connectResponse.ok) {
        throw new Error(`Failed to connect to peer agent: ${connectResponse.statusText}`);
      }

      const connectData = await connectResponse.json();
      
      // Update connection status
      connection.status = connectData.status || "connected";
      connection.lastHeartbeat = new Date();
      this.connections.set(connectionId, connection);

      metrics.increment("a2a_connections_established_total", {
        agent_id: agentId,
        peer_agent_id: peerAgentId,
      });

      logger.info("Agent connection established", {
        agentId,
        peerAgentId,
        connectionId,
      });
    } catch (error) {
      connection.status = "error";
      throw new Error(
        `Failed to establish connection: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return connection;
  }

  /**
   * Disconnect agents
   */
  async disconnectAgents(agentId: string, peerAgentId: string): Promise<void> {
    const connectionId = `${agentId}:${peerAgentId}`;
    const connection = this.connections.get(connectionId);

    if (connection) {
      connection.status = "disconnected";
      this.connections.delete(connectionId);

      logger.info("Agent connection closed", {
        agentId,
        peerAgentId,
        connectionId,
      });
    }
  }

  /**
   * Send message between agents with AGORA-style optimization and security
   * Uses routines (structured protocols) when possible, falls back to NL
   */
  async sendMessage(message: AgentMessage): Promise<void> {
    // Security verification
    const protocolSecurity = getProtocolSecurity();
    
    // Verify sender identity
    const fromSecurityContext = await protocolSecurity.verifyAgentIdentity(message.fromAgentId);
    if (!fromSecurityContext || !fromSecurityContext.identityVerified) {
      throw new Error(`Sender identity verification failed: ${message.fromAgentId}`);
    }

    // Check permissions
    const hasPermission = await protocolSecurity.checkProtocolPermission(
      message.fromAgentId,
      "a2a",
      "send_message"
    );

    if (!hasPermission) {
      throw new Error(`Agent ${message.fromAgentId} does not have permission to send messages`);
    }

    // Validate agents exist
    const fromAgent = this.agentRegistry.get(message.fromAgentId);
    const toAgent = this.agentRegistry.get(message.toAgentId);

    if (!fromAgent || !toAgent) {
      throw new Error(
        `Agent not found: ${!fromAgent ? message.fromAgentId : message.toAgentId}`
      );
    }

    // Check connection
    const connectionId = `${message.fromAgentId}:${message.toAgentId}`;
    const connection = this.connections.get(connectionId);

    if (!connection || connection.status !== "connected") {
      throw new Error(
        `No active connection between ${message.fromAgentId} and ${message.toAgentId}`
      );
    }

    // AGORA-style optimization: Try routine first, fallback to NL
    const optimizedPayload = await this.optimizeCommunication(message.payload, fromAgent, toAgent);

    // Queue message (in production, would send via network)
    const queue = this.messageQueue.get(message.toAgentId) || [];
    queue.push({
      ...message,
      payload: optimizedPayload,
    });
    this.messageQueue.set(message.toAgentId, queue);

    // Map to ACP envelope for audit trail
    try {
      const acpEnvelope: ACPMessageEnvelope = {
        message_id: message.messageId,
        tenant_id: "default", // In production, get from agent context
        actor_id: message.fromAgentId,
        type: "event.emit", // A2A messages are events
        timestamp: message.timestamp.toISOString(),
        correlation_id: message.correlationId || crypto.randomUUID(),
        causation_id: undefined,
        schema_version: "1.0",
        payload: {
          event_type: "a2a.message",
          from_agent_id: message.fromAgentId,
          to_agent_id: message.toAgentId,
          message_type: message.type,
          payload: optimizedPayload,
          optimized: optimizedPayload !== message.payload,
        } as any,
        signatures: [],
        metadata: {
          protocol: "a2a",
          original_message_id: message.messageId,
          ...message.metadata,
        },
      };

      // Store in event store for audit
      await this.eventStore.append({
        event_id: acpEnvelope.message_id,
        tenant_id: acpEnvelope.tenant_id,
        actor_id: acpEnvelope.actor_id,
        type: acpEnvelope.type,
        occurred_at: acpEnvelope.timestamp,
        correlation_id: acpEnvelope.correlation_id,
        causation_id: acpEnvelope.causation_id,
        schema_version: acpEnvelope.schema_version,
        payload: acpEnvelope.payload as any,
        signatures: acpEnvelope.signatures as any,
        metadata: acpEnvelope.metadata as any,
        evidence_refs: [],
      });
    } catch (error) {
      logger.warn("Failed to create ACP envelope for audit", {
        error: error instanceof Error ? error.message : String(error),
        messageId: message.messageId,
      });
      // Continue even if audit fails
    }

    metrics.increment("a2a_messages_sent_total", {
      from_agent: message.fromAgentId,
      to_agent: message.toAgentId,
      message_type: message.type,
      optimized: optimizedPayload !== message.payload ? "true" : "false",
    });

    logger.debug("Agent message sent", {
      messageId: message.messageId,
      fromAgentId: message.fromAgentId,
      toAgentId: message.toAgentId,
      type: message.type,
      optimized: optimizedPayload !== message.payload,
    });
  }

  /**
   * AGORA-style communication optimization
   * Converts natural language to structured routines when possible
   */
  private async optimizeCommunication(
    payload: unknown,
    fromAgent: AgentIdentity,
    toAgent: AgentIdentity
  ): Promise<unknown> {
    // If payload is already structured (routine), use it
    if (this.isRoutine(payload)) {
      return payload;
    }

    // If payload is string (NL), try to convert to routine
    if (typeof payload === "string") {
      const routine = await this.naturalLanguageToRoutine(payload, fromAgent, toAgent);
      if (routine) {
        logger.debug("AGORA: Converted NL to routine", {
          fromAgent: fromAgent.agentId,
          toAgent: toAgent.agentId,
          routine: routine.type,
          action: routine.action,
        });
        return routine;
      }
    }

    // Fallback to original payload (NL)
    return payload;
  }

  /**
   * Check if payload is a routine (structured protocol)
   */
  private isRoutine(payload: unknown): boolean {
    if (typeof payload !== "object" || payload === null) {
      return false;
    }

    const obj = payload as Record<string, unknown>;
    return (
      typeof obj.type === "string" &&
      typeof obj.action === "string" &&
      (obj.type === "routine" || obj.type === "protocol" || obj.type === "command")
    );
  }

  /**
   * Convert natural language to routine when possible
   * Uses pattern matching first, then LLM-based conversion for complex cases
   */
  private async naturalLanguageToRoutine(
    text: string,
    fromAgent: AgentIdentity,
    toAgent: AgentIdentity
  ): Promise<{ type: string; action: string; parameters: Record<string, unknown> } | null> {
    const lowerText = text.toLowerCase();

    // Fast pattern matching for common routines
    if (lowerText.includes("get") || lowerText.includes("fetch") || lowerText.includes("retrieve")) {
      const match = text.match(/(?:get|fetch|retrieve)\s+(.+)/i);
      if (match) {
        return {
          type: "routine",
          action: "get",
          parameters: { resource: match[1].trim() },
        };
      }
    }

    if (lowerText.includes("create") || lowerText.includes("make") || lowerText.includes("generate")) {
      const match = text.match(/(?:create|make|generate)\s+(.+)/i);
      if (match) {
        return {
          type: "routine",
          action: "create",
          parameters: { resource: match[1].trim() },
        };
      }
    }

    if (lowerText.includes("update") || lowerText.includes("modify") || lowerText.includes("change")) {
      const match = text.match(/(?:update|modify|change)\s+(.+)/i);
      if (match) {
        return {
          type: "routine",
          action: "update",
          parameters: { resource: match[1].trim() },
        };
      }
    }

    if (lowerText.includes("delete") || lowerText.includes("remove")) {
      const match = text.match(/(?:delete|remove)\s+(.+)/i);
      if (match) {
        return {
          type: "routine",
          action: "delete",
          parameters: { resource: match[1].trim() },
        };
      }
    }

    // Check if agents share common capabilities that support routines
    const commonCapabilities = fromAgent.capabilities.filter((cap) =>
      toAgent.capabilities.includes(cap)
    );

    if (commonCapabilities.length > 0 && lowerText.includes("execute")) {
      return {
        type: "routine",
        action: "execute",
        parameters: {
          capability: commonCapabilities[0],
          input: text,
        },
      };
    }

    // For complex cases, try LLM-based conversion (non-blocking, fallback to NL)
    try {
      const { LLMProvider } = await import("@/lib/llm/providers");
      const llmProvider = new LLMProvider();
      
      const prompt = `Convert this agent communication into a structured routine if possible. 
Available actions: get, create, update, delete, execute, query, analyze, transform.
Agent capabilities: ${commonCapabilities.join(", ") || "general"}

Message: "${text}"

Respond with JSON only: {"type": "routine", "action": "action_name", "parameters": {...}} or null if not convertible.`;

      const response = await Promise.race([
        llmProvider.call({
          model: "gpt-4o-mini", // Fast, cost-effective model for routine conversion
          prompt,
          temperature: 0.1, // Low temperature for structured output
          max_tokens: 200,
        }),
        new Promise<{ text: string }>((resolve) => 
          setTimeout(() => resolve({ text: "null" }), 500) // 500ms timeout
        ),
      ]);

      if (response.text && response.text !== "null") {
        try {
          const parsed = JSON.parse(response.text.trim());
          if (parsed && typeof parsed === "object" && parsed.type === "routine" && parsed.action) {
            logger.debug("AGORA: LLM converted NL to routine", {
              fromAgent: fromAgent.agentId,
              toAgent: toAgent.agentId,
              action: parsed.action,
            });
            return parsed;
          }
        } catch {
          // Invalid JSON, fall through to null
        }
      }
    } catch (error) {
      // LLM conversion failed, fall back to NL
      logger.debug("AGORA: LLM conversion failed, using NL", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // No routine match found, return null to use NL
    return null;
  }

  /**
   * Receive messages for agent
   */
  async receiveMessages(agentId: string): Promise<AgentMessage[]> {
    const messages = this.messageQueue.get(agentId) || [];
    this.messageQueue.set(agentId, []); // Clear queue

    metrics.gauge("a2a_messages_received_count", messages.length, {
      agent_id: agentId,
    });

    return messages;
  }

  /**
   * Get agent identity
   */
  getAgent(agentId: string): AgentIdentity | null {
    return this.agentRegistry.get(agentId) || null;
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): AgentIdentity[] {
    return Array.from(this.agentRegistry.values());
  }

  /**
   * Get agent count (for health checks)
   */
  getAgentCount(): number {
    return this.agentRegistry.size;
  }

  /**
   * Get connection count (for health checks)
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get connections for agent
   */
  getConnections(agentId: string): AgentConnection[] {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.agentId === agentId || conn.peerAgentId === agentId
    );
  }

  /**
   * Start heartbeat monitor
   */
  private startHeartbeatMonitor(): void {
    if (process.env.NODE_ENV === "test") return;
    const timer = setInterval(() => {
      void this.checkHeartbeats();
    }, 30000); // Check every 30 seconds
    // Don't keep the process alive just for heartbeats
    (timer as any).unref?.();
  }

  /**
   * Check agent heartbeats
   */
  private async checkHeartbeats(): Promise<void> {
    const now = new Date();
    const timeout = 60000; // 60 seconds

    for (const [connId, connection] of this.connections.entries()) {
      if (connection.status === "connected" && connection.lastHeartbeat) {
        const timeSinceHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();
        if (timeSinceHeartbeat > timeout) {
          connection.status = "disconnected";
          logger.warn("Agent connection timeout", {
            connectionId: connId,
            agentId: connection.agentId,
            peerAgentId: connection.peerAgentId,
            timeSinceHeartbeat,
          });
        }
      }
    }
  }

  /**
   * Handle heartbeat from agent
   */
  async handleHeartbeat(agentId: string, peerAgentId: string): Promise<void> {
    const connectionId = `${agentId}:${peerAgentId}`;
    const connection = this.connections.get(connectionId);

    if (connection) {
      connection.lastHeartbeat = new Date();
      if (connection.status === "disconnected") {
        connection.status = "connected";
      }
    }
  }
}

// Singleton instance
let a2aProtocolInstance: A2AProtocol | null = null;

export function getA2AProtocol(): A2AProtocol {
  if (!a2aProtocolInstance) {
    a2aProtocolInstance = new A2AProtocol();
  }
  return a2aProtocolInstance;
}
