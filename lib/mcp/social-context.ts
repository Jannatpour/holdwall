/**
 * Social Context Management
 * 
 * Awareness of other agents' capabilities and coordination
 * for multi-agent systems.
 */

export interface AgentCapability {
  agentId: string;
  capabilities: string[];
  status: "available" | "busy" | "offline";
  lastActivity: string;
}

export interface SocialContext {
  agents: Map<string, AgentCapability>;
  relationships: Array<{
    from: string;
    to: string;
    type: "collaborates" | "depends_on" | "conflicts";
    strength: number;
  }>;
}

export class SocialContextManager {
  private socialContext: SocialContext = {
    agents: new Map(),
    relationships: [],
  };

  /**
   * Register agent
   */
  registerAgent(agent: AgentCapability): void {
    this.socialContext.agents.set(agent.agentId, agent);
  }

  /**
   * Get agent capabilities
   */
  getAgentCapabilities(agentId: string): AgentCapability | null {
    return this.socialContext.agents.get(agentId) || null;
  }

  /**
   * Find agents with capability
   */
  findAgentsWithCapability(capability: string): AgentCapability[] {
    return Array.from(this.socialContext.agents.values())
      .filter(agent => agent.capabilities.includes(capability));
  }

  /**
   * Create relationship between agents
   */
  createRelationship(
    fromAgent: string,
    toAgent: string,
    type: "collaborates" | "depends_on" | "conflicts",
    strength: number = 0.5
  ): void {
    this.socialContext.relationships.push({
      from: fromAgent,
      to: toAgent,
      type,
      strength,
    });
  }

  /**
   * Get collaborating agents
   */
  getCollaborators(agentId: string): AgentCapability[] {
    const relationships = this.socialContext.relationships.filter(
      r => (r.from === agentId || r.to === agentId) && r.type === "collaborates"
    );

    const collaboratorIds = relationships.map(r =>
      r.from === agentId ? r.to : r.from
    );

    return collaboratorIds
      .map(id => this.socialContext.agents.get(id))
      .filter((a): a is AgentCapability => a !== undefined);
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId: string, status: AgentCapability["status"]): void {
    const agent = this.socialContext.agents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.lastActivity = new Date().toISOString();
    }
  }
}
