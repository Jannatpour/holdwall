/**
 * MCP Server Registry
 * 
 * Separation of concerns: single responsibility per MCP server
 * with dynamic registration and discovery.
 */

import type { MCPTool } from "./types";

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  description: string;
  tools: MCPTool[];
  status: "online" | "offline" | "error";
  capabilities: string[];
  registeredAt: string;
}

export class MCPServerRegistry {
  private servers: Map<string, MCPServer> = new Map();
  private toolToServer: Map<string, string> = new Map(); // tool_name -> server_id

  /**
   * Register MCP server
   */
  registerServer(server: Omit<MCPServer, "id" | "registeredAt">): MCPServer {
    const fullServer: MCPServer = {
      ...server,
      id: crypto.randomUUID(),
      registeredAt: new Date().toISOString(),
    };

    this.servers.set(fullServer.id, fullServer);

    // Map tools to server
    for (const tool of fullServer.tools) {
      this.toolToServer.set(tool.name, fullServer.id);
    }

    return fullServer;
  }

  /**
   * Get server for tool
   */
  getServerForTool(toolName: string): MCPServer | null {
    const serverId = this.toolToServer.get(toolName);
    if (!serverId) {
      return null;
    }

    return this.servers.get(serverId) || null;
  }

  /**
   * List all servers
   */
  listServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get server by ID
   */
  getServer(id: string): MCPServer | null {
    return this.servers.get(id) || null;
  }

  /**
   * Find servers by capability
   */
  findServersByCapability(capability: string): MCPServer[] {
    return Array.from(this.servers.values())
      .filter(server => server.capabilities.includes(capability));
  }

  /**
   * Update server status
   */
  updateServerStatus(id: string, status: MCPServer["status"]): void {
    const server = this.servers.get(id);
    if (server) {
      server.status = status;
    }
  }
}
