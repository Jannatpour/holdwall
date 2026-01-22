/**
 * Connectors API
 * Manage data source connectors
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ConnectorService } from "@/lib/connectors/service";
import { connectorRegistry } from "@/lib/connectors/registry";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const connectorService = new ConnectorService();

const createConnectorSchema = z.object({
  type: z.string(),
  name: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
  apiKeyId: z.string().optional(),
  schedule: z.string().optional(),
});

const updateConnectorSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
  schedule: z.string().optional(),
  apiKeyId: z.string().optional(),
});

/**
 * GET /api/integrations/connectors
 * List all connectors for the tenant
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const connectors = await connectorService.list(tenant_id);

    return NextResponse.json({
      connectors: connectors.map((connector) => ({
        id: connector.id,
        type: connector.type,
        name: connector.name,
        status: connector.status,
        enabled: connector.enabled,
        lastSync: connector.lastSync?.toISOString(),
        lastError: connector.lastError,
        errorCount: connector.errorCount,
        schedule: connector.schedule,
        config: connector.config,
        lastRun: connector.runs[0]
          ? {
              id: connector.runs[0].id,
              status: connector.runs[0].status,
              startedAt: connector.runs[0].startedAt.toISOString(),
              completedAt: connector.runs[0].completedAt?.toISOString(),
              itemsProcessed: connector.runs[0].itemsProcessed,
              itemsCreated: connector.runs[0].itemsCreated,
              itemsFailed: connector.runs[0].itemsFailed,
              error: connector.runs[0].error,
            }
          : undefined,
        createdAt: connector.createdAt.toISOString(),
        updatedAt: connector.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching connectors", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations/connectors
 * Create a new connector
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const validated = createConnectorSchema.parse(body);

    const connectorId = await connectorService.create(
      tenant_id,
      validated.type,
      validated.name,
      validated.config,
      validated.apiKeyId
    );

    return NextResponse.json(
      { id: connectorId },
      { status: 201 }
    );
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    logger.error("Error creating connector", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/integrations/connectors/types
 * List available connector types
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAuth();

    // This endpoint is for getting connector types
    const url = new URL(request.url);
    if (url.searchParams.get("action") === "types") {
      const types = connectorRegistry.listTypes();
      return NextResponse.json({ types });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
