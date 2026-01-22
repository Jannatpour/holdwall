/**
 * Integrations API
 * Manage MCP/ACP integrations
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { MCPServerRegistry } from "@/lib/mcp/server-registry";
import { IntegrationManager } from "@/lib/mcp/integration-manager";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { logger } from "@/lib/logging/logger";
import { randomUUID } from "crypto";

const serverRegistry = new MCPServerRegistry();
const integrationManager = new IntegrationManager();

/**
 * GET /api/integrations
 * Get all registered integrations
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    // Get servers from registry
    const servers = serverRegistry.listServers();
    
    // Get integrations from manager
    const integrations = integrationManager.listIntegrations();

    // Combine and format
    const allIntegrations = [
      ...servers.map((server) => ({
        id: server.id,
        name: server.name,
        serverUrl: server.url,
        tools: server.tools,
        status: server.status === "online" ? "connected" : server.status === "error" ? "error" : "disconnected",
        lastSync: server.registeredAt,
        capabilities: server.capabilities,
      })),
      ...integrations.map((integration) => ({
        id: integration.id,
        name: integration.name,
        serverUrl: integration.serverUrl,
        tools: integration.tools,
        status: integration.status,
        lastSync: integration.lastSync,
        capabilities: [],
      })),
    ];

    return NextResponse.json({
      integrations: allIntegrations,
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching integrations", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
