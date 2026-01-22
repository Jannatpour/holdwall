/**
 * Production Metering Service Implementation
 */

import { InMemoryMeteringService } from "./service";
import { db } from "@/lib/db/client";

export class DatabaseMeteringService extends InMemoryMeteringService {
  private computeNextReset(period: "DAY" | "MONTH" | "YEAR", from: Date): Date {
    const next = new Date(from);
    switch (period) {
      case "DAY":
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
        break;
      case "MONTH":
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        next.setHours(0, 0, 0, 0);
        break;
      case "YEAR":
        next.setFullYear(next.getFullYear() + 1);
        next.setMonth(0, 1);
        next.setHours(0, 0, 0, 0);
        break;
    }
    return next;
  }

  async increment(
    tenant_id: string,
    metric: string,
    amount: number = 1
  ): Promise<{
    allowed: boolean;
    current_usage: number;
    limit: number;
    warning?: string;
  }> {
    if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
      throw new Error("Invalid metering amount (must be an integer)");
    }

    const now = new Date();
    const period = "DAY" as const;

    return await db.$transaction(async (tx) => {
      // Entitlement (if any)
      const entitlement = await tx.entitlement.findUnique({
        where: {
          tenantId_metric: {
            tenantId: tenant_id,
            metric,
          },
        },
      });

      // Get or reset counter
      let counter = await tx.meteringCounter.findUnique({
        where: {
          tenantId_metric_period: {
            tenantId: tenant_id,
            metric,
            period,
          },
        },
      });

      if (!counter || counter.nextReset <= now) {
        const nextReset = this.computeNextReset(period, now);
        counter = await tx.meteringCounter.upsert({
          where: {
            tenantId_metric_period: {
              tenantId: tenant_id,
              metric,
              period,
            },
          },
          update: {
            value: 0,
            lastReset: now,
            nextReset,
          },
          create: {
            tenantId: tenant_id,
            metric,
            period,
            value: 0,
            lastReset: now,
            nextReset,
          },
        });
      }

      const newValue = counter.value + amount;

      const limit =
        entitlement?.hardLimit !== undefined && entitlement?.hardLimit !== null
          ? entitlement.hardLimit
          : Number.POSITIVE_INFINITY;

      if (entitlement && entitlement.enforcement === "HARD" && newValue > entitlement.hardLimit) {
        return {
          allowed: false,
          current_usage: counter.value,
          limit: entitlement.hardLimit,
          warning: "Hard limit exceeded",
        };
      }

      // Persist counter increment
      await tx.meteringCounter.update({
        where: {
          tenantId_metric_period: {
            tenantId: tenant_id,
            metric,
            period,
          },
        },
        data: {
          value: newValue,
        },
      });

      // Keep entitlement currentUsage in sync (best effort)
      if (entitlement) {
        await tx.entitlement.update({
          where: {
            tenantId_metric: {
              tenantId: tenant_id,
              metric,
            },
          },
          data: {
            currentUsage: newValue,
          },
        });
      }

      if (entitlement && entitlement.enforcement !== "NONE" && newValue > entitlement.softLimit) {
        return {
          allowed: true,
          current_usage: newValue,
          limit: entitlement.hardLimit,
          warning: "Soft limit exceeded",
        };
      }

      return {
        allowed: true,
        current_usage: newValue,
        limit,
      };
    });
  }

  async getUsage(tenant_id: string, metric: string): Promise<number> {
    // Try database first
    const counter = await db.meteringCounter.findUnique({
      where: {
        tenantId_metric_period: {
          tenantId: tenant_id,
          metric,
          period: "DAY",
        },
      },
    });

    if (counter) {
      return counter.value;
    }

    // Fallback to in-memory
    return super.getUsage(tenant_id, metric);
  }

  async getEntitlement(tenant_id: string, metric: string) {
    const entitlement = await db.entitlement.findUnique({
      where: {
        tenantId_metric: {
          tenantId: tenant_id,
          metric,
        },
      },
    });

    if (!entitlement) {
      return null;
    }

    return {
      entitlement_id: entitlement.id,
      tenant_id: entitlement.tenantId,
      metric: entitlement.metric,
      soft_limit: entitlement.softLimit,
      hard_limit: entitlement.hardLimit,
      current_usage: entitlement.currentUsage,
      enforcement: (entitlement.enforcement || "HARD").toLowerCase() as any,
      created_at: entitlement.createdAt.toISOString(),
      updated_at: entitlement.updatedAt.toISOString(),
    };
  }

  async setEntitlement(
    tenant_id: string,
    metric: string,
    soft_limit: number,
    hard_limit: number,
    enforcement: "soft" | "hard" | "none" = "hard"
  ): Promise<string> {
    const entitlement = await db.entitlement.upsert({
      where: {
        tenantId_metric: {
          tenantId: tenant_id,
          metric,
        },
      },
      update: {
        softLimit: soft_limit,
        hardLimit: hard_limit,
        enforcement: enforcement.toUpperCase() as any,
      },
      create: {
        tenantId: tenant_id,
        metric,
        softLimit: soft_limit,
        hardLimit: hard_limit,
        enforcement: enforcement.toUpperCase() as any,
        currentUsage: 0,
      },
    });

    return entitlement.id;
  }
}
