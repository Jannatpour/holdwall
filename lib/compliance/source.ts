/**
 * Source Compliance Layer
 * 
 * Per-tenant allowlists, collection method, retention, and provenance fields
 */

export interface SourcePolicy {
  policy_id: string;
  tenant_id: string;
  /** Source type */
  source_type: string;
  /** Allowed sources */
  allowed_sources: string[];
  /** Collection method */
  collection_method: "api" | "rss" | "export" | "manual";
  /** Retention rules */
  retention: {
    days: number;
    auto_delete: boolean;
  };
  /** Compliance flags */
  compliance_flags: string[];
  created_at: string;
  updated_at?: string;
}

export interface SourceComplianceService {
  checkSource(
    tenant_id: string,
    source_type: string,
    source_id: string
  ): Promise<{
    allowed: boolean;
    policy?: SourcePolicy;
    reason?: string;
  }>;

  getPolicy(tenant_id: string, source_type: string): Promise<SourcePolicy | null>;
  createPolicy(policy: Omit<SourcePolicy, "policy_id" | "created_at">): Promise<string>;
  updatePolicy(policy_id: string, updates: Partial<SourcePolicy>): Promise<void>;
}

export class InMemorySourceComplianceService implements SourceComplianceService {
  private policies = new Map<string, SourcePolicy>();

  async checkSource(
    tenant_id: string,
    source_type: string,
    source_id: string
  ): Promise<{
    allowed: boolean;
    policy?: SourcePolicy;
    reason?: string;
  }> {
    const policy = await this.getPolicy(tenant_id, source_type);

    if (!policy) {
      return {
        allowed: false,
        reason: "No policy found for source type",
      };
    }

    const allowed = policy.allowed_sources.includes(source_id) || policy.allowed_sources.includes("*");

    return {
      allowed,
      policy,
      reason: allowed ? "Source allowed by policy" : "Source not in allowed list",
    };
  }

  async getPolicy(tenant_id: string, source_type: string): Promise<SourcePolicy | null> {
    const key = `${tenant_id}:${source_type}`;
    return this.policies.get(key) || null;
  }

  async createPolicy(
    policy: Omit<SourcePolicy, "policy_id" | "created_at">
  ): Promise<string> {
    const policy_id = `policy-${Date.now()}`;
    const fullPolicy: SourcePolicy = {
      ...policy,
      policy_id,
      created_at: new Date().toISOString(),
    };
    const key = `${policy.tenant_id}:${policy.source_type}`;
    this.policies.set(key, fullPolicy);
    return policy_id;
  }

  async updatePolicy(
    policy_id: string,
    updates: Partial<SourcePolicy>
  ): Promise<void> {
    const policy = Array.from(this.policies.values()).find((p) => p.policy_id === policy_id);
    if (!policy) {
      throw new Error(`Policy ${policy_id} not found`);
    }

    const updated = { ...policy, ...updates, updated_at: new Date().toISOString() };
    const key = `${policy.tenant_id}:${policy.source_type}`;
    this.policies.set(key, updated);
  }
}
