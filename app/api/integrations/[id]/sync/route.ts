/**
 * Sync Integration API
 * Sync a specific integration (MCP server) or connector to refresh tools/data
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { MCPServerRegistry } from "@/lib/mcp/server-registry";
import { IntegrationManager } from "@/lib/mcp/integration-manager";
import { ConnectorService } from "@/lib/connectors/service";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { logger } from "@/lib/logging/logger";
import type { EventEnvelope } from "@/lib/events/types";
import { randomUUID } from "crypto";

const serverRegistry = new MCPServerRegistry();
const integrationManager = new IntegrationManager();
const connectorService = new ConnectorService();

/**
 * POST /api/integrations/[id]/sync
 * Sync an integration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id: string | undefined;
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const user_id = (user as any).id || "";
    const resolvedParams = await params;
    id = resolvedParams.id;

    let synced = false;
    let integrationName = "";
    let syncType = "integration";

    // Try connector first (connectors are more common)
    try {
      const connector = await connectorService.get(id);
      if (connector && connector.tenantId === tenant_id) {
        await connectorService.sync(id);
        integrationName = connector.name;
        syncType = "connector";
        synced = true;
      }
    } catch (err) {
      // Not a connector, continue to try other types
    }

    // Try server registry
    if (!synced) {
      const server = serverRegistry.getServer(id);
      if (server) {
        serverRegistry.updateServerStatus(id, "online");
        integrationName = server.name;
        syncType = "mcp_server";
        synced = true;
      }
    }

    // Try integration manager
    if (!synced) {
      try {
        await integrationManager.syncIntegration(id);
        const integration = integrationManager.getIntegration(id);
        if (integration) {
          integrationName = integration.name;
          syncType = "integration";
          synced = true;
        }
      } catch (err) {
        // Integration not found in manager either
      }
    }

    if (!synced) {
      return NextResponse.json({ error: "Integration or connector not found" }, { status: 404 });
    }

    // Audit logging
    const auditLog = new DatabaseAuditLog();
    const correlationId = `integration-sync-${id}-${Date.now()}`;
    const occurredAt = new Date().toISOString();
    const auditEvent: EventEnvelope = {
      event_id: randomUUID(),
      tenant_id,
      actor_id: user_id,
      type: "action.integration_sync",
      occurred_at: occurredAt,
      correlation_id: correlationId,
      causation_id: undefined,
      schema_version: "1.0",
      evidence_refs: [id],
      payload: {
        integration_id: id,
        integration_name: integrationName,
        sync_type: syncType,
      },
      signatures: [],
    };
    await auditLog.append({
      audit_id: randomUUID(),
      tenant_id,
      actor_id: user_id,
      type: "event",
      timestamp: occurredAt,
      correlation_id: correlationId,
      causation_id: undefined,
      data: auditEvent,
      evidence_refs: [id],
    });

    return NextResponse.json({ success: true, synced: new Date().toISOString() });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error syncing integration", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      integrationId: id,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
