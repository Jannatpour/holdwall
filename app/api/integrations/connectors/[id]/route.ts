/**
 * Connector API (single connector operations)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ConnectorService } from "@/lib/connectors/service";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const connectorService = new ConnectorService();

const updateConnectorSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
  schedule: z.string().optional(),
  apiKeyId: z.string().optional(),
});

/**
 * GET /api/integrations/connectors/[id]
 * Get connector by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const { id } = await params;

    const connector = await connectorService.get(id);

    if (!connector) {
      return NextResponse.json({ error: "Connector not found" }, { status: 404 });
    }

    if (connector.tenantId !== tenant_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
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
      apiKeyId: connector.apiKeyId,
      cursor: connector.cursor,
      runs: connector.runs.map((run) => ({
        id: run.id,
        status: run.status,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString(),
        itemsProcessed: run.itemsProcessed,
        itemsCreated: run.itemsCreated,
        itemsFailed: run.itemsFailed,
        error: run.error,
        metadata: run.metadata,
      })),
      createdAt: connector.createdAt.toISOString(),
      updatedAt: connector.updatedAt.toISOString(),
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const paramsResolved = await params;
    const connectorId = paramsResolved.id;
    logger.error("Error fetching connector", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      connectorId,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/integrations/connectors/[id]
 * Update connector
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id: string | undefined;
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const resolvedParams = await params;
    id = resolvedParams.id;

    const connector = await connectorService.get(id);
    if (!connector) {
      return NextResponse.json({ error: "Connector not found" }, { status: 404 });
    }

    if (connector.tenantId !== tenant_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = updateConnectorSchema.parse(body);

    await connectorService.update(id, validated);

    return NextResponse.json({ success: true });
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
    const paramsResolved = await params;
    const connectorId = paramsResolved.id;
    logger.error("Error updating connector", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      connectorId,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/connectors/[id]
 * Delete connector
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id: string | undefined;
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const resolvedParams = await params;
    id = resolvedParams.id;

    const connector = await connectorService.get(id);
    if (!connector) {
      return NextResponse.json({ error: "Connector not found" }, { status: 404 });
    }

    if (connector.tenantId !== tenant_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectorService.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const paramsResolved = await params;
    const connectorId = paramsResolved.id;
    logger.error("Error deleting connector", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      connectorId,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
