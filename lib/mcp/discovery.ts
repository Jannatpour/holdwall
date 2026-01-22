/**
 * Standardized Discovery
 * 
 * Dynamic capability learning at runtime for MCP servers
 * and tools.
 */

import type { MCPTool } from "./types";

export interface DiscoveryResult {
  serverId: string;
  serverUrl: string;
  tools: MCPTool[];
  capabilities: string[];
  discoveredAt: string;
}

export class MCPDiscovery {
  /**
   * Discover MCP server capabilities
   * Calls MCP server discovery endpoint following MCP protocol
   */
  async discover(serverUrl: string): Promise<DiscoveryResult> {
    try {
      // Call MCP server discovery endpoint
      // MCP protocol: GET /mcp/v1/tools or POST /mcp/v1/discover
      const discoveryUrl = `${serverUrl.replace(/\/$/, "")}/mcp/v1/tools`;
      
      let response: Response;
      try {
        // Try GET first (standard MCP discovery)
        response = await fetch(discoveryUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        });
      } catch {
        // Fallback to POST if GET fails
        response = await fetch(`${serverUrl.replace(/\/$/, "")}/mcp/v1/discover`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({}),
        });
      }

      if (!response.ok) {
        throw new Error(`MCP server discovery failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Parse MCP tools from response
      const tools: MCPTool[] = (data.tools || []).map((tool: any) => ({
        name: tool.name || tool.id,
        description: tool.description || "",
        version: tool.version || "1.0.0",
        inputSchema: tool.inputSchema || tool.input_schema || {
          type: "object",
          properties: {},
        },
        outputSchema: tool.outputSchema || tool.output_schema || {
          type: "object",
          properties: {},
        },
        requires_approval: tool.requires_approval || false,
        requires_evidence: tool.requires_evidence || false,
        cost: tool.cost || { credits: 1 },
      }));

      const capabilities = data.capabilities || tools.map((t: MCPTool) => t.name);

      return {
        serverId: data.serverId || data.id || crypto.randomUUID(),
        serverUrl,
        tools,
        capabilities: Array.isArray(capabilities) ? capabilities : ["search", "query"],
        discoveredAt: new Date().toISOString(),
      };
    } catch (error) {
      // If discovery fails, return minimal result for graceful degradation
      console.warn(`MCP discovery failed for ${serverUrl}:`, error);
      return {
        serverId: crypto.randomUUID(),
        serverUrl,
        tools: [],
        capabilities: [],
        discoveredAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Discover tools from server
   */
  async discoverTools(serverUrl: string): Promise<MCPTool[]> {
    const discovery = await this.discover(serverUrl);
    return discovery.tools;
  }

  /**
   * Discover capabilities
   */
  async discoverCapabilities(serverUrl: string): Promise<string[]> {
    const discovery = await this.discover(serverUrl);
    return discovery.capabilities;
  }

  /**
   * Auto-discover from known servers
   */
  async autoDiscover(serverUrls: string[]): Promise<DiscoveryResult[]> {
    const results: DiscoveryResult[] = [];

    for (const url of serverUrls) {
      try {
        const discovery = await this.discover(url);
        results.push(discovery);
      } catch (error) {
        console.warn(`Failed to discover ${url}:`, error);
      }
    }

    return results;
  }
}
