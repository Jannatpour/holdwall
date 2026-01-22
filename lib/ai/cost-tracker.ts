/**
 * AI Cost Tracker
 * 
 * Tracks AI API costs per tenant, model, and task type with budget enforcement.
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import type { MeteringService } from "@/lib/metering/service";
import { db } from "@/lib/db/client";

export interface CostRecord {
  tenantId: string;
  model: string;
  provider: string;
  taskType: string;
  cost: number;
  tokens: number;
  timestamp: Date;
}

export interface CostBudget {
  tenantId: string;
  dailyBudget: number;
  monthlyBudget: number;
  currentDaily: number;
  currentMonthly: number;
  lastReset: Date;
}

export interface CostSummary {
  tenantId: string;
  totalCost: number;
  costByModel: Record<string, number>;
  costByTaskType: Record<string, number>;
  costByProvider: Record<string, number>;
  period: "day" | "month";
  periodStart: Date;
  periodEnd: Date;
}

const METRIC_DAILY = "ai_cost_micro_usd_day";
const METRIC_MONTHLY = "ai_cost_micro_usd_month";
const MICRO_USD = 1_000_000;

function usdToMicro(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) return 0;
  // Ceil to avoid undercounting.
  return Math.ceil(usd * MICRO_USD);
}

function microToUsd(micro: number): number {
  if (!Number.isFinite(micro) || micro <= 0) return 0;
  return micro / MICRO_USD;
}

/**
 * AI Cost Tracker
 */
export class CostTracker {
  private meteringService?: MeteringService;

  constructor(meteringService?: MeteringService) {
    this.meteringService = meteringService;
  }

  /**
   * Record AI API cost
   */
  async recordCost(record: CostRecord): Promise<void> {
    try {
      // Update metrics
      metrics.histogram("ai_cost_usd", record.cost * 1000, {
        tenant_id: record.tenantId,
        model: record.model,
        provider: record.provider,
        task_type: record.taskType,
      });

      metrics.increment("ai_cost_total", {
        tenant_id: record.tenantId,
        model: record.model,
        provider: record.provider,
        task_type: record.taskType,
      });

      // Log cost
      logger.info("AI cost recorded", {
        tenantId: record.tenantId,
        model: record.model,
        provider: record.provider,
        taskType: record.taskType,
        cost: record.cost,
        tokens: record.tokens,
      });

      const micro = usdToMicro(record.cost);

      // Persist cost usage via metering counters (daily + monthly).
      // This is the canonical enforcement mechanism (survives restarts).
      if (micro > 0) {
        if (this.meteringService) {
          await this.meteringService.increment(record.tenantId, METRIC_DAILY, micro);
        } else {
          // Direct DB increment (daily)
          await db.meteringCounter.upsert({
            where: {
              tenantId_metric_period: {
                tenantId: record.tenantId,
                metric: METRIC_DAILY,
                period: "DAY",
              },
            },
            update: { value: { increment: micro } },
            create: {
              tenantId: record.tenantId,
              metric: METRIC_DAILY,
              period: "DAY",
              value: micro,
              lastReset: new Date(),
              nextReset: new Date(new Date().setHours(24, 0, 0, 0)),
            },
          });
        }

        // Monthly counter (separate metric to allow distinct entitlement).
        await db.meteringCounter.upsert({
          where: {
            tenantId_metric_period: {
              tenantId: record.tenantId,
              metric: METRIC_MONTHLY,
              period: "MONTH",
            },
          },
          update: { value: { increment: micro } },
          create: {
            tenantId: record.tenantId,
            metric: METRIC_MONTHLY,
            period: "MONTH",
            value: micro,
            lastReset: new Date(),
            nextReset: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
          },
        });
      }
    } catch (error) {
      logger.error("Failed to record AI cost", {
        error: error instanceof Error ? error.message : String(error),
        record,
      });
    }
  }

  /**
   * Set budget for tenant
   */
  setBudget(
    tenantId: string,
    dailyBudget: number,
    monthlyBudget: number
  ): void {
    // Persist budgets as entitlements (micro-USD) so enforcement survives restarts.
    const dailyMicro = usdToMicro(dailyBudget);
    const monthlyMicro = usdToMicro(monthlyBudget);

    void db.entitlement.upsert({
      where: { tenantId_metric: { tenantId, metric: METRIC_DAILY } },
      update: { softLimit: Math.floor(dailyMicro * 0.8), hardLimit: dailyMicro, enforcement: "HARD" },
      create: { tenantId, metric: METRIC_DAILY, softLimit: Math.floor(dailyMicro * 0.8), hardLimit: dailyMicro, enforcement: "HARD", currentUsage: 0 },
    });

    void db.entitlement.upsert({
      where: { tenantId_metric: { tenantId, metric: METRIC_MONTHLY } },
      update: { softLimit: Math.floor(monthlyMicro * 0.8), hardLimit: monthlyMicro, enforcement: "HARD" },
      create: { tenantId, metric: METRIC_MONTHLY, softLimit: Math.floor(monthlyMicro * 0.8), hardLimit: monthlyMicro, enforcement: "HARD", currentUsage: 0 },
    });

    logger.info("AI cost budgets persisted (micro-USD)", {
      tenantId,
      dailyBudgetUsd: dailyBudget,
      monthlyBudgetUsd: monthlyBudget,
    });
  }

  /**
   * Get budget for tenant
   */
  async getBudget(tenantId: string): Promise<CostBudget | null> {
    const [dailyEnt, monthlyEnt] = await Promise.all([
      db.entitlement.findUnique({ where: { tenantId_metric: { tenantId, metric: METRIC_DAILY } } }),
      db.entitlement.findUnique({ where: { tenantId_metric: { tenantId, metric: METRIC_MONTHLY } } }),
    ]);

    if (!dailyEnt && !monthlyEnt) {
      return null;
    }

    const [dailyUsage, monthlyUsage] = await Promise.all([
      db.meteringCounter.findUnique({
        where: { tenantId_metric_period: { tenantId, metric: METRIC_DAILY, period: "DAY" } },
      }),
      db.meteringCounter.findUnique({
        where: { tenantId_metric_period: { tenantId, metric: METRIC_MONTHLY, period: "MONTH" } },
      }),
    ]);

    return {
      tenantId,
      dailyBudget: microToUsd(dailyEnt?.hardLimit ?? 0),
      monthlyBudget: microToUsd(monthlyEnt?.hardLimit ?? 0),
      currentDaily: microToUsd(dailyUsage?.value ?? 0),
      currentMonthly: microToUsd(monthlyUsage?.value ?? 0),
      lastReset: dailyUsage?.lastReset ?? new Date(),
    };
  }

  /**
   * Check if tenant has budget remaining
   */
  async checkBudget(tenantId: string, estimatedCost: number): Promise<{
    allowed: boolean;
    reason?: string;
    currentDaily: number;
    currentMonthly: number;
    dailyBudget: number;
    monthlyBudget: number;
  }> {
    const microEstimate = usdToMicro(estimatedCost);

    const [dailyEnt, monthlyEnt] = await Promise.all([
      db.entitlement.findUnique({ where: { tenantId_metric: { tenantId, metric: METRIC_DAILY } } }),
      db.entitlement.findUnique({ where: { tenantId_metric: { tenantId, metric: METRIC_MONTHLY } } }),
    ]);

    // No budgets set = unlimited
    if (!dailyEnt && !monthlyEnt) {
      return {
        allowed: true,
        currentDaily: 0,
        currentMonthly: 0,
        dailyBudget: Infinity,
        monthlyBudget: Infinity,
      };
    }

    const [dailyCounter, monthlyCounter] = await Promise.all([
      db.meteringCounter.findUnique({
        where: { tenantId_metric_period: { tenantId, metric: METRIC_DAILY, period: "DAY" } },
      }),
      db.meteringCounter.findUnique({
        where: { tenantId_metric_period: { tenantId, metric: METRIC_MONTHLY, period: "MONTH" } },
      }),
    ]);

    const currentDailyMicro = dailyCounter?.value ?? 0;
    const currentMonthlyMicro = monthlyCounter?.value ?? 0;

    const dailyBudgetMicro = dailyEnt?.hardLimit ?? Number.POSITIVE_INFINITY;
    const monthlyBudgetMicro = monthlyEnt?.hardLimit ?? Number.POSITIVE_INFINITY;

    if (currentDailyMicro + microEstimate > dailyBudgetMicro) {
      return {
        allowed: false,
        reason: "Daily budget exceeded",
        currentDaily: microToUsd(currentDailyMicro),
        currentMonthly: microToUsd(currentMonthlyMicro),
        dailyBudget: microToUsd(dailyBudgetMicro),
        monthlyBudget: microToUsd(monthlyBudgetMicro),
      };
    }

    if (currentMonthlyMicro + microEstimate > monthlyBudgetMicro) {
      return {
        allowed: false,
        reason: "Monthly budget exceeded",
        currentDaily: microToUsd(currentDailyMicro),
        currentMonthly: microToUsd(currentMonthlyMicro),
        dailyBudget: microToUsd(dailyBudgetMicro),
        monthlyBudget: microToUsd(monthlyBudgetMicro),
      };
    }

    return {
      allowed: true,
      currentDaily: microToUsd(currentDailyMicro),
      currentMonthly: microToUsd(currentMonthlyMicro),
      dailyBudget: microToUsd(dailyBudgetMicro),
      monthlyBudget: microToUsd(monthlyBudgetMicro),
    };
  }

  /**
   * Get cost summary for tenant
   */
  async getCostSummary(
    tenantId: string,
    period: "day" | "month" = "day"
  ): Promise<CostSummary | null> {
    const now = new Date();
    const periodStart =
      period === "day"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd =
      period === "day"
        ? new Date(periodStart.getTime() + 24 * 60 * 60 * 1000)
        : new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1);

    const metric = period === "day" ? METRIC_DAILY : METRIC_MONTHLY;
    const dbPeriod = period === "day" ? "DAY" : "MONTH";

    const counter = await db.meteringCounter.findUnique({
      where: {
        tenantId_metric_period: {
          tenantId,
          metric,
          period: dbPeriod,
        },
      },
    });

    return {
      tenantId,
      totalCost: microToUsd(counter?.value ?? 0),
      costByModel: {},
      costByTaskType: {},
      costByProvider: {},
      period,
      periodStart,
      periodEnd,
    };
  }
}

// Singleton instance
let costTrackerInstance: CostTracker | null = null;

export function getCostTracker(meteringService?: MeteringService): CostTracker {
  if (!costTrackerInstance) {
    costTrackerInstance = new CostTracker(meteringService);
  }
  return costTrackerInstance;
}
