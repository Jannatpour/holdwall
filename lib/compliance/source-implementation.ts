/**
 * Production Source Compliance Implementation
 */

import { InMemorySourceComplianceService } from "./source";
import { db } from "@/lib/db/client";

export class DatabaseSourceComplianceService extends InMemorySourceComplianceService {
  async getPolicy(tenant_id: string, source_type: string) {
    // Try database first
    const policy = await db.sourcePolicy.findUnique({
      where: {
        tenantId_sourceType: {
          tenantId: tenant_id,
          sourceType: source_type,
        },
      },
    });

    if (policy) {
      return {
        policy_id: policy.id,
        tenant_id: policy.tenantId,
        source_type: policy.sourceType,
        allowed_sources: policy.allowedSources,
        collection_method: policy.collectionMethod.toLowerCase() as any,
        retention: {
          days: policy.retentionDays,
          auto_delete: policy.autoDelete,
        },
        compliance_flags: policy.complianceFlags,
        created_at: policy.createdAt.toISOString(),
        updated_at: policy.updatedAt?.toISOString(),
      };
    }

    // Fallback to in-memory
    return super.getPolicy(tenant_id, source_type);
  }

  async createPolicy(policy: any) {
    const result = await db.sourcePolicy.create({
      data: {
        tenantId: policy.tenant_id,
        sourceType: policy.source_type,
        allowedSources: policy.allowed_sources,
        collectionMethod: policy.collection_method.toUpperCase() as any,
        retentionDays: policy.retention.days,
        autoDelete: policy.retention.auto_delete,
        complianceFlags: policy.compliance_flags || [],
      },
    });

    return result.id;
  }
}
