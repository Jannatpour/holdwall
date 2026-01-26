"use strict";
/**
 * Metering & Entitlements
 *
 * Per-tenant usage counters, soft/hard limits, enforcement
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILTIN_METRICS = exports.InMemoryMeteringService = void 0;
class InMemoryMeteringService {
    constructor() {
        this.counters = new Map();
        this.entitlements = new Map();
    }
    getCounterKey(tenant_id, metric, period) {
        return `${tenant_id}:${metric}:${period}`;
    }
    getEntitlementKey(tenant_id, metric) {
        return `${tenant_id}:${metric}`;
    }
    async increment(tenant_id, metric, amount = 1) {
        // Get or create counter (daily by default)
        const period = "day";
        const key = this.getCounterKey(tenant_id, metric, period);
        let counter = this.counters.get(key);
        const now = new Date();
        if (!counter || new Date(counter.next_reset) <= now) {
            // Reset counter
            counter = {
                counter_id: `counter-${Date.now()}`,
                tenant_id,
                metric,
                value: 0,
                period,
                last_reset: now.toISOString(),
                next_reset: this.getNextReset(period, now).toISOString(),
            };
        }
        // Get entitlement
        const entitlement = await this.getEntitlement(tenant_id, metric);
        // Check limits
        const new_value = counter.value + amount;
        const limit = entitlement?.hard_limit || Infinity;
        if (entitlement) {
            if (new_value > entitlement.hard_limit && entitlement.enforcement === "hard") {
                return {
                    allowed: false,
                    current_usage: counter.value,
                    limit: entitlement.hard_limit,
                    warning: "Hard limit exceeded",
                };
            }
            if (new_value > entitlement.soft_limit && new_value <= entitlement.hard_limit) {
                return {
                    allowed: true,
                    current_usage: new_value,
                    limit: entitlement.hard_limit,
                    warning: "Soft limit exceeded",
                };
            }
        }
        // Increment
        counter.value = new_value;
        this.counters.set(key, counter);
        if (entitlement) {
            entitlement.current_usage = new_value;
            entitlement.updated_at = now.toISOString();
            this.entitlements.set(this.getEntitlementKey(tenant_id, metric), entitlement);
        }
        return {
            allowed: true,
            current_usage: new_value,
            limit,
        };
    }
    async getUsage(tenant_id, metric) {
        const period = "day";
        const key = this.getCounterKey(tenant_id, metric, period);
        const counter = this.counters.get(key);
        return counter?.value || 0;
    }
    async getEntitlement(tenant_id, metric) {
        const key = this.getEntitlementKey(tenant_id, metric);
        return this.entitlements.get(key) || null;
    }
    async setEntitlement(tenant_id, metric, soft_limit, hard_limit, enforcement = "hard") {
        const entitlement_id = `entitlement-${Date.now()}`;
        const key = this.getEntitlementKey(tenant_id, metric);
        const current_usage = await this.getUsage(tenant_id, metric);
        const entitlement = {
            entitlement_id,
            tenant_id,
            metric,
            soft_limit,
            hard_limit,
            current_usage,
            enforcement,
            created_at: new Date().toISOString(),
        };
        this.entitlements.set(key, entitlement);
        return entitlement_id;
    }
    getNextReset(period, from) {
        const next = new Date(from);
        switch (period) {
            case "day":
                next.setDate(next.getDate() + 1);
                next.setHours(0, 0, 0, 0);
                break;
            case "month":
                next.setMonth(next.getMonth() + 1);
                next.setDate(1);
                next.setHours(0, 0, 0, 0);
                break;
            case "year":
                next.setFullYear(next.getFullYear() + 1);
                next.setMonth(0, 1);
                next.setHours(0, 0, 0, 0);
                break;
        }
        return next;
    }
}
exports.InMemoryMeteringService = InMemoryMeteringService;
/**
 * Built-in metrics
 */
exports.BUILTIN_METRICS = [
    "events_ingested_per_day",
    "agent_runs_per_day",
    "artifacts_published_per_month",
    "alerts_sent_per_month",
    "retention_window_size",
];
