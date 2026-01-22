/**
 * M+N Integration Model
 * 
 * Replaces bespoke integrations with standardized MCP connections
 * (M+N instead of M×N integrations).
 */

import type { MCPTool, MCPToolCall } from "./types";

export interface MCPIntegration {
  id: string;
  name: string;
  serverUrl: string;
  tools: MCPTool[];
  status: "connected" | "disconnected" | "error";
  lastSync: string;
}

export class IntegrationManager {
  private integrations: Map<string, MCPIntegration> = new Map();
  private toolMap: Map<string, string> = new Map(); // tool_name -> integration_id

  /**
   * Register MCP integration
   */
  registerIntegration(integration: Omit<MCPIntegration, "id" | "lastSync">): MCPIntegration {
    const fullIntegration: MCPIntegration = {
      ...integration,
      id: crypto.randomUUID(),
      lastSync: new Date().toISOString(),
    };

    this.integrations.set(fullIntegration.id, fullIntegration);

    // Map tools to integration
    for (const tool of fullIntegration.tools) {
      this.toolMap.set(tool.name, fullIntegration.id);
    }

    return fullIntegration;
  }

  /**
   * Get integration for tool
   */
  getIntegrationForTool(toolName: string): MCPIntegration | null {
    const integrationId = this.toolMap.get(toolName);
    if (!integrationId) {
      return null;
    }

    return this.integrations.get(integrationId) || null;
  }

  /**
   * List all integrations
   */
  listIntegrations(): MCPIntegration[] {
    return Array.from(this.integrations.values());
  }

  /**
   * Get integration by ID
   */
  getIntegration(id: string): MCPIntegration | null {
    return this.integrations.get(id) || null;
  }

  /**
   * Sync integration (refresh tools)
   */
  async syncIntegration(id: string): Promise<void> {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error(`Integration ${id} not found`);
    }

    try {
      // In production, would fetch tools from MCP server
      // For now, mark as synced
      integration.lastSync = new Date().toISOString();
      integration.status = "connected";
    } catch (error) {
      integration.status = "error";
      throw error;
    }
  }

  /**
   * Disconnect integration
   */
  disconnect(id: string): void {
    const integration = this.integrations.get(id);
    if (integration) {
      integration.status = "disconnected";
    }
  }
}
