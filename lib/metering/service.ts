/**
 * Metering & Entitlements
 * 
 * Per-tenant usage counters, soft/hard limits, enforcement
 */

export interface MeteringCounter {
  counter_id: string;
  tenant_id: string;
  /** Metric name */
  metric: string;
  /** Current value */
  value: number;
  /** Reset period */
  period: "day" | "month" | "year";
  /** Last reset timestamp */
  last_reset: string;
  /** Next reset timestamp */
  next_reset: string;
}

export interface Entitlement {
  entitlement_id: string;
  tenant_id: string;
  /** Metric name */
  metric: string;
  /** Soft limit (warning threshold) */
  soft_limit: number;
  /** Hard limit (block threshold) */
  hard_limit: number;
  /** Current usage */
  current_usage: number;
  /** Enforcement mode */
  enforcement: "soft" | "hard" | "none";
  created_at: string;
  updated_at?: string;
}

export interface MeteringService {
  increment(
    tenant_id: string,
    metric: string,
    amount?: number
  ): Promise<{
    allowed: boolean;
    current_usage: number;
    limit: number;
    warning?: string;
  }>;

  getUsage(tenant_id: string, metric: string): Promise<number>;
  getEntitlement(tenant_id: string, metric: string): Promise<Entitlement | null>;
  setEntitlement(
    tenant_id: string,
    metric: string,
    soft_limit: number,
    hard_limit: number,
    enforcement?: "soft" | "hard" | "none"
  ): Promise<string>;
}

export class InMemoryMeteringService implements MeteringService {
  private counters = new Map<string, MeteringCounter>();
  private entitlements = new Map<string, Entitlement>();

  private getCounterKey(tenant_id: string, metric: string, period: "day" | "month" | "year"): string {
    return `${tenant_id}:${metric}:${period}`;
  }

  private getEntitlementKey(tenant_id: string, metric: string): string {
    return `${tenant_id}:${metric}`;
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
    // Get or create counter (daily by default)
    const period: "day" = "day";
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

  async getUsage(tenant_id: string, metric: string): Promise<number> {
    const period: "day" = "day";
    const key = this.getCounterKey(tenant_id, metric, period);
    const counter = this.counters.get(key);
    return counter?.value || 0;
  }

  async getEntitlement(tenant_id: string, metric: string): Promise<Entitlement | null> {
    const key = this.getEntitlementKey(tenant_id, metric);
    return this.entitlements.get(key) || null;
  }

  async setEntitlement(
    tenant_id: string,
    metric: string,
    soft_limit: number,
    hard_limit: number,
    enforcement: "soft" | "hard" | "none" = "hard"
  ): Promise<string> {
    const entitlement_id = `entitlement-${Date.now()}`;
    const key = this.getEntitlementKey(tenant_id, metric);

    const current_usage = await this.getUsage(tenant_id, metric);

    const entitlement: Entitlement = {
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

  private getNextReset(period: "day" | "month" | "year", from: Date): Date {
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

/**
 * Built-in metrics
 */
export const BUILTIN_METRICS = [
  "events_ingested_per_day",
  "agent_runs_per_day",
  "artifacts_published_per_month",
  "alerts_sent_per_month",
  "retention_window_size",
] as const;

export type BuiltinMetric = (typeof BUILTIN_METRICS)[number];
