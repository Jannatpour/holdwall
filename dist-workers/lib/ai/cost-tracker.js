"use strict";
/**
 * AI Cost Tracker
 *
 * Tracks AI API costs per tenant, model, and task type with budget enforcement.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostTracker = void 0;
exports.getCostTracker = getCostTracker;
const logger_1 = require("@/lib/logging/logger");
const metrics_1 = require("@/lib/observability/metrics");
const client_1 = require("@/lib/db/client");
const METRIC_DAILY = "ai_cost_micro_usd_day";
const METRIC_MONTHLY = "ai_cost_micro_usd_month";
const MICRO_USD = 1000000;
function usdToMicro(usd) {
    if (!Number.isFinite(usd) || usd < 0)
        return 0;
    // Ceil to avoid undercounting.
    return Math.ceil(usd * MICRO_USD);
}
function microToUsd(micro) {
    if (!Number.isFinite(micro) || micro <= 0)
        return 0;
    return micro / MICRO_USD;
}
/**
 * AI Cost Tracker
 */
class CostTracker {
    constructor(meteringService) {
        this.meteringService = meteringService;
    }
    /**
     * Record AI API cost
     */
    async recordCost(record) {
        try {
            // Update metrics
            metrics_1.metrics.histogram("ai_cost_usd", record.cost * 1000, {
                tenant_id: record.tenantId,
                model: record.model,
                provider: record.provider,
                task_type: record.taskType,
            });
            metrics_1.metrics.increment("ai_cost_total", {
                tenant_id: record.tenantId,
                model: record.model,
                provider: record.provider,
                task_type: record.taskType,
            });
            // Log cost
            logger_1.logger.info("AI cost recorded", {
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
                }
                else {
                    // Direct DB increment (daily)
                    await client_1.db.meteringCounter.upsert({
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
                await client_1.db.meteringCounter.upsert({
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
        }
        catch (error) {
            logger_1.logger.error("Failed to record AI cost", {
                error: error instanceof Error ? error.message : String(error),
                record,
            });
        }
    }
    /**
     * Set budget for tenant
     */
    setBudget(tenantId, dailyBudget, monthlyBudget) {
        // Persist budgets as entitlements (micro-USD) so enforcement survives restarts.
        const dailyMicro = usdToMicro(dailyBudget);
        const monthlyMicro = usdToMicro(monthlyBudget);
        void client_1.db.entitlement.upsert({
            where: { tenantId_metric: { tenantId, metric: METRIC_DAILY } },
            update: { softLimit: Math.floor(dailyMicro * 0.8), hardLimit: dailyMicro, enforcement: "HARD" },
            create: { tenantId, metric: METRIC_DAILY, softLimit: Math.floor(dailyMicro * 0.8), hardLimit: dailyMicro, enforcement: "HARD", currentUsage: 0 },
        });
        void client_1.db.entitlement.upsert({
            where: { tenantId_metric: { tenantId, metric: METRIC_MONTHLY } },
            update: { softLimit: Math.floor(monthlyMicro * 0.8), hardLimit: monthlyMicro, enforcement: "HARD" },
            create: { tenantId, metric: METRIC_MONTHLY, softLimit: Math.floor(monthlyMicro * 0.8), hardLimit: monthlyMicro, enforcement: "HARD", currentUsage: 0 },
        });
        logger_1.logger.info("AI cost budgets persisted (micro-USD)", {
            tenantId,
            dailyBudgetUsd: dailyBudget,
            monthlyBudgetUsd: monthlyBudget,
        });
    }
    /**
     * Get budget for tenant
     */
    async getBudget(tenantId) {
        const [dailyEnt, monthlyEnt] = await Promise.all([
            client_1.db.entitlement.findUnique({ where: { tenantId_metric: { tenantId, metric: METRIC_DAILY } } }),
            client_1.db.entitlement.findUnique({ where: { tenantId_metric: { tenantId, metric: METRIC_MONTHLY } } }),
        ]);
        if (!dailyEnt && !monthlyEnt) {
            return null;
        }
        const [dailyUsage, monthlyUsage] = await Promise.all([
            client_1.db.meteringCounter.findUnique({
                where: { tenantId_metric_period: { tenantId, metric: METRIC_DAILY, period: "DAY" } },
            }),
            client_1.db.meteringCounter.findUnique({
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
    async checkBudget(tenantId, estimatedCost) {
        const microEstimate = usdToMicro(estimatedCost);
        const [dailyEnt, monthlyEnt] = await Promise.all([
            client_1.db.entitlement.findUnique({ where: { tenantId_metric: { tenantId, metric: METRIC_DAILY } } }),
            client_1.db.entitlement.findUnique({ where: { tenantId_metric: { tenantId, metric: METRIC_MONTHLY } } }),
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
            client_1.db.meteringCounter.findUnique({
                where: { tenantId_metric_period: { tenantId, metric: METRIC_DAILY, period: "DAY" } },
            }),
            client_1.db.meteringCounter.findUnique({
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
    async getCostSummary(tenantId, period = "day") {
        const now = new Date();
        const periodStart = period === "day"
            ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
            : new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = period === "day"
            ? new Date(periodStart.getTime() + 24 * 60 * 60 * 1000)
            : new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1);
        const metric = period === "day" ? METRIC_DAILY : METRIC_MONTHLY;
        const dbPeriod = period === "day" ? "DAY" : "MONTH";
        const counter = await client_1.db.meteringCounter.findUnique({
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
exports.CostTracker = CostTracker;
// Singleton instance
let costTrackerInstance = null;
function getCostTracker(meteringService) {
    if (!costTrackerInstance) {
        costTrackerInstance = new CostTracker(meteringService);
    }
    return costTrackerInstance;
}
