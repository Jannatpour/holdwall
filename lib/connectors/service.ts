/**
 * Connector Service
 * Manages connector lifecycle, syncing, and execution
 */

import { db } from "@/lib/db/client";
import { connectorRegistry } from "./registry";
import type { ConnectorExecutor } from "./base";
import { SignalIngestionService } from "@/lib/signals/ingestion";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { DatabaseEventStore } from "@/lib/events/store-db";

export class ConnectorService {
  private ingestionService: SignalIngestionService;

  constructor() {
    const evidenceVault = new DatabaseEvidenceVault();
    const eventStore = new DatabaseEventStore();
    this.ingestionService = new SignalIngestionService(evidenceVault, eventStore);
  }

  /**
   * Create a new connector
   */
  async create(
    tenantId: string,
    type: string,
    name: string,
    config: Record<string, unknown>,
    apiKeyId?: string
  ): Promise<string> {
    // Validate connector type
    const executor = connectorRegistry.getExecutor(type);
    if (!executor) {
      throw new Error(`Unknown connector type: ${type}`);
    }

    // Validate configuration
    const validation = await executor.validate({ ...config, tenantId });
    if (!validation.valid) {
      throw new Error(`Invalid connector configuration: ${validation.error}`);
    }

    // Create connector record
    const connector = await db.connector.create({
      data: {
        tenantId,
        type,
        name,
        config: config as any,
        apiKeyId: apiKeyId || undefined,
        status: "INACTIVE",
        enabled: true,
      },
    });

    return connector.id;
  }

  /**
   * Update connector
   */
  async update(
    connectorId: string,
    updates: {
      name?: string;
      config?: Record<string, unknown>;
      enabled?: boolean;
      schedule?: string;
      apiKeyId?: string;
    }
  ): Promise<void> {
    const connector = await db.connector.findUnique({
      where: { id: connectorId },
    });

    if (!connector) {
      throw new Error("Connector not found");
    }

    // Validate config if provided
    if (updates.config) {
      const executor = connectorRegistry.getExecutor(connector.type);
      if (executor) {
        const validation = await executor.validate({
          ...updates.config,
          tenantId: connector.tenantId,
        });
        if (!validation.valid) {
          throw new Error(`Invalid connector configuration: ${validation.error}`);
        }
      }
    }

    await db.connector.update({
      where: { id: connectorId },
      data: {
        name: updates.name,
        config: updates.config ? (updates.config as any) : undefined,
        enabled: updates.enabled,
        schedule: updates.schedule,
        apiKeyId: updates.apiKeyId,
      },
    });
  }

  /**
   * Delete connector
   */
  async delete(connectorId: string): Promise<void> {
    await db.connector.delete({
      where: { id: connectorId },
    });
  }

  /**
   * Get connector by ID
   */
  async get(connectorId: string) {
    return await db.connector.findUnique({
      where: { id: connectorId },
      include: {
        runs: {
          orderBy: { startedAt: "desc" },
          take: 10,
        },
      },
    });
  }

  /**
   * List connectors for tenant
   */
  async list(tenantId: string) {
    return await db.connector.findMany({
      where: { tenantId },
      include: {
        runs: {
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Sync connector (run ingestion)
   */
  async sync(connectorId: string): Promise<string> {
    const connector = await db.connector.findUnique({
      where: { id: connectorId },
    });

    if (!connector) {
      throw new Error("Connector not found");
    }

    if (!connector.enabled) {
      throw new Error("Connector is disabled");
    }

    // Get API key if needed
    let apiKey: string | undefined;
    if (connector.apiKeyId) {
      const keyRecord = await db.apiKey.findUnique({
        where: { id: connector.apiKeyId },
      });
      if (keyRecord && !keyRecord.revoked) {
        // In production, decrypt keyHash using secret manager
        // For now, we'll need the key to be provided via environment or key management
        apiKey = process.env[`${keyRecord.service.toUpperCase()}_API_KEY`] || undefined;
      }
    }

    // Create run record
    const run = await db.connectorRun.create({
      data: {
        connectorId: connector.id,
        status: "RUNNING",
      },
    });

    try {
      // Get executor
      const executor = connectorRegistry.getExecutor(connector.type, apiKey);
      if (!executor) {
        throw new Error(`Unknown connector type: ${connector.type}`);
      }

      // Execute sync
      const config = {
        ...(connector.config as Record<string, unknown>),
        tenantId: connector.tenantId,
      };

      const result = await executor.sync(config, connector.cursor || undefined);

      // Ingest signals
      let itemsCreated = 0;
      let itemsFailed = 0;

      for (const signal of result.signals) {
        try {
          const connectorWrapper = {
            name: connector.name,
            ingest: async () => [signal],
          };

          await this.ingestionService.ingestSignal(
            {
              tenant_id: signal.tenant_id,
              source: signal.source,
              content: signal.content,
              metadata: signal.metadata,
              compliance: signal.compliance,
            },
            connectorWrapper
          );
          itemsCreated++;
        } catch (error) {
          console.error(`Failed to ingest signal from connector ${connectorId}:`, error);
          itemsFailed++;
        }
      }

      // Update connector and run
      await db.connector.update({
        where: { id: connectorId },
        data: {
          status: "ACTIVE",
          lastSync: new Date(),
          cursor: result.cursor || undefined,
          errorCount: 0,
          lastError: null,
        },
      });

      await db.connectorRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          itemsProcessed: result.signals.length,
          itemsCreated,
          itemsFailed,
          cursor: result.cursor || undefined,
          metadata: result.metadata as any,
        },
      });

      return run.id;
    } catch (error) {
      // Update connector and run with error
      await db.connector.update({
        where: { id: connectorId },
        data: {
          status: "ERROR",
          lastError: error instanceof Error ? error.message : String(error),
          errorCount: { increment: 1 },
        },
      });

      await db.connectorRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  }

  /**
   * Test connector configuration
   */
  async test(connectorId: string): Promise<{ success: boolean; error?: string }> {
    const connector = await db.connector.findUnique({
      where: { id: connectorId },
    });

    if (!connector) {
      return { success: false, error: "Connector not found" };
    }

    const executor = connectorRegistry.getExecutor(connector.type);
    if (!executor) {
      return { success: false, error: `Unknown connector type: ${connector.type}` };
    }

    const config = {
      ...(connector.config as Record<string, unknown>),
      tenantId: connector.tenantId,
    };

    return await executor.test(config);
  }
}
