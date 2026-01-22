/**
 * POS Cycle Worker
 * 
 * Background worker for executing POS cycles for all tenants
 * Can be run as a cron job or scheduled task
 */

import { db } from "@/lib/db/client";
import { POSOrchestrator } from "./orchestrator";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

const orchestrator = new POSOrchestrator();

/**
 * Execute POS cycle for a specific tenant
 */
export async function executePOSCycleForTenant(tenantId: string): Promise<{
  success: boolean;
  actions: string[];
  posScore: number;
}> {
  try {
    logger.info("Starting POS cycle", { tenantId });

    const result = await orchestrator.executePOSCycle(tenantId);

    logger.info("POS cycle completed", {
      tenantId,
      success: result.success,
      actionsCount: result.actions.length,
      posScore: result.metrics.overall.posScore,
    });

    // Emit metrics
    metrics.setGauge("pos.cycle.success", result.success ? 1 : 0, {
      tenant_id: tenantId,
    });
    metrics.setGauge("pos.cycle.score", result.metrics.overall.posScore, {
      tenant_id: tenantId,
    });
    metrics.increment("pos.cycle.actions", {
      tenant_id: tenantId,
    });

    return {
      success: result.success,
      actions: result.actions,
      posScore: result.metrics.overall.posScore,
    };
  } catch (error) {
    logger.error("POS cycle failed", {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });

    metrics.increment("pos.cycle.errors", {
      tenant_id: tenantId,
    });

    throw error;
  }
}

/**
 * Execute POS cycle for all active tenants
 */
export async function executePOSCycleForAllTenants(): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    tenantId: string;
    success: boolean;
    posScore: number;
  }>;
}> {
  const results: Array<{
    tenantId: string;
    success: boolean;
    posScore: number;
  }> = [];

  try {
    // Get all tenants
    const tenants = await db.tenant.findMany({
      select: { id: true },
    });

    logger.info("Executing POS cycles for all tenants", {
      tenantCount: tenants.length,
    });

    // Execute cycle for each tenant (with concurrency limit)
    const concurrency = 3; // Process 3 tenants at a time
    for (let i = 0; i < tenants.length; i += concurrency) {
      const batch = tenants.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((tenant) =>
          executePOSCycleForTenant(tenant.id).then((result) => ({
            tenantId: tenant.id,
            ...result,
          }))
        )
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          logger.error("POS cycle failed for tenant", {
            error: result.reason,
          });
          results.push({
            tenantId: "unknown",
            success: false,
            posScore: 0,
          });
        }
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;

    logger.info("POS cycles completed for all tenants", {
      total: results.length,
      successful,
      failed,
    });

    return {
      total: results.length,
      successful,
      failed,
      results,
    };
  } catch (error) {
    logger.error("Error executing POS cycles for all tenants", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Allow direct execution via node
if (require.main === module) {
  executePOSCycleForAllTenants()
    .then((result) => {
      logger.info("POS cycles completed for all tenants", result);
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Error executing POS cycles", {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    });
}
