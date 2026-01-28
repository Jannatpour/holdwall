/**
 * ANP (Agent Network Protocol)
 * 
 * Broader protocol for managing agent networks, facilitating discovery
 * and interactions across larger systems.
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { getA2AProtocol, type AgentIdentity } from "@/lib/a2a/protocol";
import { db } from "@/lib/db/client";
import { getProtocolSecurity } from "@/lib/security/protocol-security";

export interface AgentNetwork {
  networkId: string;
  name: string;
  description?: string;
  agents: string[]; // Agent IDs
  topology: "mesh" | "star" | "hierarchical" | "ring";
  metadata?: {
    created_at?: string;
    updated_at?: string;
    owner?: string;
    tags?: string[];
  };
}

export interface NetworkDiscoveryRequest {
  networkId?: string;
  topology?: AgentNetwork["topology"];
  minAgents?: number;
  maxAgents?: number;
  tags?: string[];
}

export interface NetworkDiscoveryResponse {
  networks: AgentNetwork[];
  totalFound: number;
}

export interface NetworkJoinRequest {
  agentId: string;
  networkId: string;
  credentials?: {
    token?: string;
    publicKey?: string;
  };
}

export interface NetworkJoinResponse {
  success: boolean;
  network?: AgentNetwork;
  assignedRole?: string;
  error?: string;
}

export interface NetworkMessage {
  messageId: string;
  networkId: string;
  fromAgentId: string;
  toAgentIds?: string[]; // If undefined, broadcast to all
  type: "broadcast" | "multicast" | "unicast";
  payload: unknown;
  timestamp: Date;
  metadata?: {
    priority?: "low" | "normal" | "high" | "urgent";
    ttl?: number; // Time to live in seconds
  };
}

export interface AgentHealthStatus {
  agentId: string;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  lastHeartbeat: Date;
  latency?: number; // ms
  errorRate?: number; // 0-1
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export interface NetworkRoutingResult {
  path: string[]; // Agent IDs in routing path
  hops: number;
  estimatedLatency: number; // ms
  reliability: number; // 0-1
}

export interface NetworkHealthReport {
  networkId: string;
  overallHealth: "healthy" | "degraded" | "unhealthy";
  agentCount: number;
  healthyAgents: number;
  degradedAgents: number;
  unhealthyAgents: number;
  averageLatency: number;
  agentStatuses: AgentHealthStatus[];
  timestamp: Date;
}

/**
 * ANP Protocol Implementation with Network Manager
 * Includes discovery, routing, and health monitoring
 */
export class ANPProtocol {
  private networks: Map<string, AgentNetwork> = new Map();
  private agentNetworks: Map<string, Set<string>> = new Map(); // agentId -> networkIds
  private agentHealth: Map<string, AgentHealthStatus> = new Map(); // agentId -> health
  private a2aProtocol = getA2AProtocol();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (process.env.NODE_ENV !== "test") {
      // IMPORTANT: Avoid side effects (DB writes, timers) during cold start on serverless.
      // Protocol instances can be imported by unrelated endpoints (signup/health).
      this.initializeDefaultNetworks();

      const isServerless = !!process.env.VERCEL;
      if (!isServerless && process.env.ANP_ENABLE_HEALTH_MONITORING === "true") {
        this.startHealthMonitoring();
      }
    }
  }

  /**
   * Create agent network with security verification
   */
  async createNetwork(network: AgentNetwork, creatorAgentId?: string): Promise<void> {
    // Security verification if creator agent is provided
    if (creatorAgentId) {
      const protocolSecurity = getProtocolSecurity();
      const securityContext = await protocolSecurity.verifyAgentIdentity(creatorAgentId);
      
      if (!securityContext || !securityContext.identityVerified) {
        throw new Error(`Agent identity verification failed: ${creatorAgentId}`);
      }

      const hasPermission = await protocolSecurity.checkProtocolPermission(
        creatorAgentId,
        "anp",
        "create_network"
      );

      if (!hasPermission) {
        throw new Error(`Agent ${creatorAgentId} does not have permission to create networks`);
      }
    }

    this.networks.set(network.networkId, network);

    // Update agent network mappings
    for (const agentId of network.agents) {
      const networks = this.agentNetworks.get(agentId) || new Set();
      networks.add(network.networkId);
      this.agentNetworks.set(agentId, networks);
    }

    // Store in database (Prisma model: AgentNetwork)
    // Default OFF in serverless to prevent cold-start DB thrash; enable explicitly if needed.
    const isServerless = !!process.env.VERCEL;
    const persistEnabled =
      process.env.ANP_PERSIST_NETWORKS === "true" && !(isServerless && process.env.ANP_PERSIST_NETWORKS_ON_SERVERLESS !== "true");

    if (persistEnabled) {
      try {
        await db.agentNetwork.upsert({
          where: { networkId: network.networkId },
          create: {
            networkId: network.networkId,
            name: network.name,
            description: network.description || null,
            agents: network.agents as any,
            topology: network.topology,
            metadata: network.metadata || {},
          },
          update: {
            name: network.name,
            description: network.description || null,
            agents: network.agents as any,
            topology: network.topology,
            metadata: network.metadata || {},
          },
        });
      } catch (error) {
        logger.warn("Failed to persist network to database", {
          error: error instanceof Error ? error.message : String(error),
          networkId: network.networkId,
        });
      }
    }

    metrics.increment("anp_networks_created_total", {
      network_id: network.networkId,
      topology: network.topology,
    });

    logger.info("Agent network created", {
      networkId: network.networkId,
      name: network.name,
      agentCount: network.agents.length,
      topology: network.topology,
    });
  }

  /**
   * Discover networks
   */
  async discoverNetworks(
    request: NetworkDiscoveryRequest
  ): Promise<NetworkDiscoveryResponse> {
    const results: AgentNetwork[] = [];

    for (const [networkId, network] of this.networks.entries()) {
      // Filter by network ID
      if (request.networkId && networkId !== request.networkId) {
        continue;
      }

      // Filter by topology
      if (request.topology && network.topology !== request.topology) {
        continue;
      }

      // Filter by agent count
      if (request.minAgents && network.agents.length < request.minAgents) {
        continue;
      }
      if (request.maxAgents && network.agents.length > request.maxAgents) {
        continue;
      }

      // Filter by tags
      if (request.tags && network.metadata?.tags) {
        const hasMatchingTag = request.tags.some((tag) =>
          network.metadata!.tags!.includes(tag)
        );
        if (!hasMatchingTag) {
          continue;
        }
      }

      results.push(network);
    }

    logger.debug("Network discovery completed", {
      resultsCount: results.length,
      filters: request,
    });

    return {
      networks: results,
      totalFound: results.length,
    };
  }

  /**
   * Join agent to network
   */
  async joinNetwork(request: NetworkJoinRequest): Promise<NetworkJoinResponse> {
    const network = this.networks.get(request.networkId);
    if (!network) {
      return {
        success: false,
        error: `Network ${request.networkId} not found`,
      };
    }

    // Check if agent exists
    const agent = this.a2aProtocol.getAgent(request.agentId);
    if (!agent) {
      return {
        success: false,
        error: `Agent ${request.agentId} not registered`,
      };
    }

    // Add agent to network
    if (!network.agents.includes(request.agentId)) {
      network.agents.push(request.agentId);
    }

    // Update agent network mappings
    const networks = this.agentNetworks.get(request.agentId) || new Set();
    networks.add(request.networkId);
    this.agentNetworks.set(request.agentId, networks);

    // Determine role based on topology
    let assignedRole: string | undefined;
    if (network.topology === "hierarchical") {
      assignedRole = network.agents.length === 1 ? "coordinator" : "worker";
    } else if (network.topology === "star") {
      assignedRole = network.agents.length === 1 ? "hub" : "spoke";
    }

    // Update network in database (Prisma model: AgentNetwork)
    try {
      await db.agentNetwork.update({
        where: { networkId: request.networkId },
        data: {
          agents: network.agents as any,
        },
      });
    } catch (error) {
      logger.warn("Failed to update network in database", {
        error: error instanceof Error ? error.message : String(error),
        networkId: request.networkId,
      });
    }

    metrics.increment("anp_agents_joined_total", {
      network_id: request.networkId,
      agent_id: request.agentId,
    });

    logger.info("Agent joined network", {
      agentId: request.agentId,
      networkId: request.networkId,
      role: assignedRole,
    });

    return {
      success: true,
      network,
      assignedRole,
    };
  }

  /**
   * Leave network
   */
  async leaveNetwork(agentId: string, networkId: string): Promise<void> {
    const network = this.networks.get(networkId);
    if (!network) {
      return;
    }

    // Remove agent from network
    network.agents = network.agents.filter((id) => id !== agentId);

    // Update agent network mappings
    const networks = this.agentNetworks.get(agentId);
    if (networks) {
      networks.delete(networkId);
      if (networks.size === 0) {
        this.agentNetworks.delete(agentId);
      }
    }

    // Update in database (Prisma model: AgentNetwork)
    try {
      await db.agentNetwork.update({
        where: { networkId },
        data: {
          agents: network.agents as any,
        },
      });
    } catch (error) {
      logger.warn("Failed to update network in database", {
        error: error instanceof Error ? error.message : String(error),
        networkId,
      });
    }

    logger.info("Agent left network", {
      agentId,
      networkId,
    });
  }

  /**
   * Send message to network with optional routing
   */
  async sendNetworkMessage(
    message: NetworkMessage,
    options?: {
      useRouting?: boolean;
      preferHealthy?: boolean;
    }
  ): Promise<void> {
    const network = this.networks.get(message.networkId);
    if (!network) {
      throw new Error(`Network ${message.networkId} not found`);
    }

    // Determine target agents based on message type
    let targetAgents: string[];
    if (message.type === "broadcast") {
      targetAgents = network.agents.filter((id) => id !== message.fromAgentId);
    } else if (message.type === "multicast" && message.toAgentIds) {
      targetAgents = message.toAgentIds.filter((id) =>
        network.agents.includes(id)
      );
    } else if (message.type === "unicast" && message.toAgentIds) {
      targetAgents = message.toAgentIds.slice(0, 1); // Single target
    } else {
      throw new Error("Invalid message type or missing target agents");
    }

      // Filter out unhealthy agents if preferHealthy is true
      if (options?.preferHealthy !== false) {
        targetAgents = targetAgents.filter((agentId) => {
          const health = this.agentHealth.get(agentId);
          return health?.status !== "unhealthy";
        });
      }

    // Send message to each target agent via A2A protocol
    // Use routing if enabled and message is unicast
    if (options?.useRouting && message.type === "unicast" && targetAgents.length === 1) {
      const targetAgentId = targetAgents[0];
      try {
        const routingResult = await this.routeMessage(
          message.networkId,
          message.fromAgentId,
          targetAgentId,
          { preferHighReliability: options.preferHealthy !== false }
        );

        // Send message through routing path
        for (let i = 0; i < routingResult.path.length - 1; i++) {
          const currentAgentId = routingResult.path[i];
          const nextAgentId = routingResult.path[i + 1];

          await this.a2aProtocol.sendMessage({
            messageId: `${message.messageId}:${currentAgentId}:${nextAgentId}`,
            fromAgentId: currentAgentId,
            toAgentId: nextAgentId,
            type: i === 0 ? "request" : "notification",
            payload: i === routingResult.path.length - 2 
              ? message.payload 
              : { 
                  originalMessage: message,
                  nextHop: nextAgentId,
                  finalDestination: targetAgentId,
                },
            timestamp: message.timestamp,
            metadata: message.metadata,
          });
        }

        metrics.increment("anp_messages_routed_total", {
          network_id: message.networkId,
          hops: String(routingResult.hops),
        });
      } catch (error) {
        logger.warn("Failed to route network message", {
          error: error instanceof Error ? error.message : String(error),
          networkId: message.networkId,
          fromAgentId: message.fromAgentId,
          toAgentId: targetAgentId,
        });
        // Fallback to direct send
        await this.sendDirectMessage(message, targetAgentId);
      }
    } else {
      // Direct send to all target agents
      for (const targetAgentId of targetAgents) {
        await this.sendDirectMessage(message, targetAgentId);
      }
    }

    metrics.increment("anp_messages_sent_total", {
      network_id: message.networkId,
      message_type: message.type,
      target_count: String(targetAgents.length),
    });

    logger.debug("Network message sent", {
      messageId: message.messageId,
      networkId: message.networkId,
      type: message.type,
      targetCount: targetAgents.length,
    });
  }

  /**
   * Send message directly to an agent
   */
  private async sendDirectMessage(
    message: NetworkMessage,
    targetAgentId: string
  ): Promise<void> {
    try {
      await this.a2aProtocol.sendMessage({
        messageId: `${message.messageId}:${targetAgentId}`,
        fromAgentId: message.fromAgentId,
        toAgentId: targetAgentId,
        type: "notification",
        payload: message.payload,
        timestamp: message.timestamp,
        metadata: message.metadata,
      });
    } catch (error) {
      logger.warn("Failed to send network message to agent", {
        error: error instanceof Error ? error.message : String(error),
        networkId: message.networkId,
        fromAgentId: message.fromAgentId,
        toAgentId: targetAgentId,
      });
      throw error;
    }
  }

  /**
   * Get network
   */
  getNetwork(networkId: string): AgentNetwork | null {
    return this.networks.get(networkId) || null;
  }

  /**
   * Get networks for agent
   */
  getAgentNetworks(agentId: string): AgentNetwork[] {
    const networkIds = this.agentNetworks.get(agentId) || new Set();
    return Array.from(networkIds)
      .map((id) => this.networks.get(id))
      .filter((n): n is AgentNetwork => n !== undefined);
  }

  /**
   * Get all networks
   */
  getAllNetworks(): AgentNetwork[] {
    return Array.from(this.networks.values());
  }

  /**
   * Initialize default networks
   */
  private initializeDefaultNetworks(): void {
    // Example: Default collaboration network
    // IMPORTANT: Do not persist default networks to the database during init.
    // This avoids DB writes on cold start (serverless).
    this.networks.set("default-collaboration", {
      networkId: "default-collaboration",
      name: "Default Collaboration Network",
      description: "Default network for agent collaboration",
      agents: [],
      topology: "mesh",
      metadata: {
        created_at: new Date().toISOString(),
        tags: ["default", "collaboration"],
      },
    });
  }

  /**
   * Network Manager: Route message through network with optimal path
   */
  async routeMessage(
    networkId: string,
    fromAgentId: string,
    toAgentId: string,
    options?: {
      preferLowLatency?: boolean;
      preferHighReliability?: boolean;
      maxHops?: number;
    }
  ): Promise<NetworkRoutingResult> {
    const network = this.networks.get(networkId);
    if (!network) {
      throw new Error(`Network ${networkId} not found`);
    }

    if (!network.agents.includes(fromAgentId) || !network.agents.includes(toAgentId)) {
      throw new Error("Agents not in network");
    }

    // Direct connection if both agents are connected
    const directConnection = this.a2aProtocol.getConnections(fromAgentId).find(
      (conn) => conn.peerAgentId === toAgentId && conn.status === "connected"
    );

    if (directConnection) {
      const fromHealth = this.agentHealth.get(fromAgentId);
      const toHealth = this.agentHealth.get(toAgentId);
      
      // Enhanced health-based routing: prefer healthy agents
      if (options?.preferHighReliability) {
        if (fromHealth?.status === "unhealthy" || toHealth?.status === "unhealthy") {
          throw new Error(
            `Cannot route through unhealthy agents: ${fromAgentId} (${fromHealth?.status}), ${toAgentId} (${toHealth?.status})`
          );
        }
      }
      
      const latency = (fromHealth?.latency || 0) + (toHealth?.latency || 0);
      
      // Record routing metrics
      metrics.increment("anp_messages_routed", {
        network_id: networkId,
        from_agent: fromAgentId,
        to_agent: toAgentId,
        routing_strategy: options?.preferLowLatency ? "low_latency" : options?.preferHighReliability ? "high_reliability" : "default",
      });
      metrics.observe("anp_routing_latency_ms", latency, {
        network_id: networkId,
      });

      return {
        path: [fromAgentId, toAgentId],
        hops: 1,
        estimatedLatency: latency,
        reliability: this.calculateReliability([fromAgentId, toAgentId]),
      };
    }

    // Find optimal path based on topology
    const path = this.findOptimalPath(
      network,
      fromAgentId,
      toAgentId,
      options
    );

    return {
      path,
      hops: path.length - 1,
      estimatedLatency: this.estimatePathLatency(path),
      reliability: this.calculateReliability(path),
    };
  }

  /**
   * Find optimal path through network
   */
  private findOptimalPath(
    network: AgentNetwork,
    fromAgentId: string,
    toAgentId: string,
    options?: {
      preferLowLatency?: boolean;
      preferHighReliability?: boolean;
      maxHops?: number;
    }
  ): string[] {
    const maxHops = options?.maxHops || 5;

    // Simple shortest path for now (can be enhanced with Dijkstra/A*)
    if (network.topology === "mesh") {
      // In mesh, try direct or one-hop
      const directConn = this.a2aProtocol.getConnections(fromAgentId).find(
        (conn) => conn.peerAgentId === toAgentId
      );
      if (directConn) {
        return [fromAgentId, toAgentId];
      }

      // Find common neighbor
      const fromConnections = this.a2aProtocol.getConnections(fromAgentId);
      const toConnections = this.a2aProtocol.getConnections(toAgentId);

      for (const fromConn of fromConnections) {
        if (fromConn.status === "connected") {
          const commonNeighbor = toConnections.find(
            (conn) => conn.peerAgentId === fromConn.peerAgentId && conn.status === "connected"
          );
          if (commonNeighbor) {
            return [fromAgentId, fromConn.peerAgentId, toAgentId];
          }
        }
      }
    } else if (network.topology === "star") {
      // In star, route through hub
      const hubAgent = network.agents.find((id) => {
        const health = this.agentHealth.get(id);
        return health?.status === "healthy";
      });
      if (hubAgent && hubAgent !== fromAgentId && hubAgent !== toAgentId) {
        return [fromAgentId, hubAgent, toAgentId];
      }
    } else if (network.topology === "hierarchical") {
      // In hierarchical, route up to coordinator then down
      const coordinator = network.agents[0]; // First agent is coordinator
      if (coordinator) {
        return [fromAgentId, coordinator, toAgentId];
      }
    }

    // Fallback: direct path
    return [fromAgentId, toAgentId];
  }

  /**
   * Estimate latency for path
   */
  private estimatePathLatency(path: string[]): number {
    let totalLatency = 0;
    for (const agentId of path) {
      const health = this.agentHealth.get(agentId);
      if (health?.latency) {
        totalLatency += health.latency;
      } else {
        totalLatency += 50; // Default 50ms
      }
    }
    return totalLatency;
  }

  /**
   * Calculate reliability for path
   */
  private calculateReliability(path: string[]): number {
    let reliability = 1.0;
    for (const agentId of path) {
      const health = this.agentHealth.get(agentId);
      if (health?.status === "healthy") {
        reliability *= 0.99;
      } else if (health?.status === "degraded") {
        reliability *= 0.85;
      } else {
        reliability *= 0.5;
      }
    }
    return reliability;
  }

  /**
   * Check agent health
   */
  async checkAgentHealth(agentId: string): Promise<AgentHealthStatus> {
    const agent = this.a2aProtocol.getAgent(agentId);
    if (!agent) {
      return {
        agentId,
        status: "unknown",
        lastHeartbeat: new Date(),
      };
    }

    const connections = this.a2aProtocol.getConnections(agentId);
    const connectedCount = connections.filter((c) => c.status === "connected").length;
    const totalCount = connections.length;

    let status: AgentHealthStatus["status"] = "healthy";
    if (totalCount === 0) {
      status = "unknown";
    } else if (connectedCount / totalCount < 0.5) {
      status = "unhealthy";
    } else if (connectedCount / totalCount < 0.8) {
      status = "degraded";
    }

    // Measure latency (simplified - in production, ping agent endpoint)
    const latency = connections.length > 0
      ? connections.reduce((sum, conn) => sum + (conn.metadata?.latency || 50), 0) / connections.length
      : 50;

    const healthStatus: AgentHealthStatus = {
      agentId,
      status,
      lastHeartbeat: new Date(),
      latency,
      capabilities: agent.capabilities,
    };

    this.agentHealth.set(agentId, healthStatus);

    return healthStatus;
  }

  /**
   * Get health status for an agent
   */
  getAgentHealth(agentId: string): AgentHealthStatus | null {
    return this.agentHealth.get(agentId) || null;
  }

  /**
   * Get network health report (alias for getNetworkHealthReport)
   */
  async getNetworkHealth(networkId: string): Promise<NetworkHealthReport> {
    return this.getNetworkHealthReport(networkId);
  }

  /**
   * Get network health report
   */
  async getNetworkHealthReport(networkId: string): Promise<NetworkHealthReport> {
    const network = this.networks.get(networkId);
    if (!network) {
      throw new Error(`Network ${networkId} not found`);
    }

    const agentStatuses: AgentHealthStatus[] = [];
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;
    let totalLatency = 0;

    for (const agentId of network.agents) {
      const health = await this.checkAgentHealth(agentId);
      agentStatuses.push(health);

      if (health.status === "healthy") {
        healthyCount++;
      } else if (health.status === "degraded") {
        degradedCount++;
      } else {
        unhealthyCount++;
      }

      if (health.latency) {
        totalLatency += health.latency;
      }
    }

    const averageLatency = agentStatuses.length > 0
      ? totalLatency / agentStatuses.length
      : 0;

    let overallHealth: NetworkHealthReport["overallHealth"] = "healthy";
    if (unhealthyCount > agentStatuses.length * 0.3) {
      overallHealth = "unhealthy";
    } else if (degradedCount + unhealthyCount > agentStatuses.length * 0.3) {
      overallHealth = "degraded";
    }

    return {
      networkId,
      overallHealth,
      agentCount: network.agents.length,
      healthyAgents: healthyCount,
      degradedAgents: degradedCount,
      unhealthyAgents: unhealthyCount,
      averageLatency,
      agentStatuses,
      timestamp: new Date(),
    };
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (process.env.NODE_ENV === "test") return;
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks().catch((error) => {
        logger.error("Health check cycle failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, 30000);
    (this.healthCheckInterval as any).unref?.();

    // Perform initial health check
    this.performHealthChecks().catch((error) => {
      logger.error("Initial health check failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /**
   * Perform health checks for all agents in all networks
   */
  private async performHealthChecks(): Promise<void> {
    const allAgentIds = new Set<string>();
    
    // Collect all unique agent IDs from all networks
    for (const network of this.networks.values()) {
      for (const agentId of network.agents) {
        allAgentIds.add(agentId);
      }
    }

    // Check health for each agent
    const healthCheckPromises = Array.from(allAgentIds).map((agentId) =>
      this.checkAgentHealth(agentId).catch((error) => {
        logger.warn("Agent health check failed", {
          agentId,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      })
    );

    await Promise.allSettled(healthCheckPromises);

    // Update metrics with enhanced health tracking
    const healthyCount = Array.from(this.agentHealth.values()).filter(
      (h) => h.status === "healthy"
    ).length;
    const degradedCount = Array.from(this.agentHealth.values()).filter(
      (h) => h.status === "degraded"
    ).length;
    const unhealthyCount = Array.from(this.agentHealth.values()).filter(
      (h) => h.status === "unhealthy" || h.status === "unknown"
    ).length;

    const totalAgents = this.agentHealth.size;
    const averageLatency = totalAgents > 0
      ? Array.from(this.agentHealth.values())
          .filter((h) => h.latency !== undefined)
          .reduce((sum, h) => sum + (h.latency || 0), 0) / totalAgents
      : 0;

    metrics.gauge("anp_agents_healthy_total", healthyCount);
    metrics.gauge("anp_agents_degraded_total", degradedCount);
    metrics.gauge("anp_agents_unhealthy_total", unhealthyCount);
    metrics.gauge("anp_agents_total", totalAgents);
    metrics.observe("anp_agent_health_check_latency_ms", averageLatency);

    // Log health summary periodically
    if (unhealthyCount > 0 || degradedCount > totalAgents * 0.3) {
      logger.warn("ANP network health degraded", {
        totalAgents,
        healthyCount,
        degradedCount,
        unhealthyCount,
        averageLatency,
      });
    }
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Select best agent from network based on criteria
   */
  async selectAgent(
    networkId: string,
    criteria: {
      requiredCapabilities?: string[];
      preferLowLatency?: boolean;
      preferHighReliability?: boolean;
      excludeAgentIds?: string[];
    }
  ): Promise<string | null> {
    const network = this.networks.get(networkId);
    if (!network) {
      return null;
    }

    const candidates = network.agents.filter((agentId) => {
      if (criteria.excludeAgentIds?.includes(agentId)) {
        return false;
      }

      if (criteria.requiredCapabilities) {
        const agent = this.a2aProtocol.getAgent(agentId);
        if (!agent) {
          return false;
        }
        const hasAll = criteria.requiredCapabilities.every((cap) =>
          agent.capabilities.includes(cap as any)
        );
        if (!hasAll) {
          return false;
        }
      }

      return true;
    });

    if (candidates.length === 0) {
      return null;
    }

    // Score candidates
    const scored = candidates.map((agentId) => {
      const health = this.agentHealth.get(agentId);
      // Enhanced scoring with health status weighting
      const latency = health?.latency || 0;
      const errorRate = health?.errorRate || 0;
      
      // Health score (most important for reliability)
      let healthScore = 1.0;
      if (health?.status === "healthy") {
        healthScore = 1.0;
      } else if (health?.status === "degraded") {
        healthScore = 0.5;
      } else {
        healthScore = 0.1; // Unhealthy or unknown
      }
      
      const healthWeight = criteria.preferHighReliability ? 0.6 : 0.3;
      const latencyWeight = criteria.preferLowLatency ? 0.5 : 0.2;
      const reliabilityWeight = criteria.preferHighReliability ? 0.3 : 0.2;
      const baseWeight = 0.2;
      
      // Health component (most important for reliability)
      const healthComponent = healthScore * 1000 * healthWeight;
      
      // Latency component (inverse - lower latency = higher score)
      const latencyComponent = (1000 / Math.max(latency, 1)) * latencyWeight;
      
      // Reliability component (lower error rate = higher score)
      const reliabilityComponent = (1 - errorRate) * 1000 * reliabilityWeight;
      
      // Base score for all agents
      const baseComponent = 100 * baseWeight;
      
      const score = healthComponent + latencyComponent + reliabilityComponent + baseComponent;

      return { agentId, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.agentId || null;
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    this.stopHealthMonitoring();
    this.networks.clear();
    this.agentNetworks.clear();
    this.agentHealth.clear();
  }

  /**
   * Get network count (for health checks)
   */
  getNetworkCount(): number {
    return this.networks.size;
  }

  /**
   * Get total agent count across all networks (for health checks)
   */
  getTotalAgentCount(): number {
    let total = 0;
    for (const network of this.networks.values()) {
      total += network.agents.length;
    }
    return total;
  }
}

// Singleton instance
let anpProtocolInstance: ANPProtocol | null = null;

export function getANPProtocol(): ANPProtocol {
  if (!anpProtocolInstance) {
    anpProtocolInstance = new ANPProtocol();
  }
  return anpProtocolInstance;
}
