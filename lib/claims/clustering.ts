/**
 * Claim Clustering Implementation
 * Production clustering with embeddings
 */

import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import type { Claim, ClaimCluster } from "./extraction";

const eventStore = new DatabaseEventStore();

export class DatabaseClaimClusteringService {
  /**
   * Cluster claims using embeddings + hierarchical clustering
   */
  async clusterClaims(
    tenant_id: string,
    claims: Claim[],
    options?: {
      similarity_threshold?: number;
      method?: "hierarchical" | "online";
    }
  ): Promise<ClaimCluster[]> {
    if (claims.length === 0) {
      return [];
    }

    // In production, use embeddings + clustering algorithm
    // For MVP, create single cluster from all claims
    const primaryClaim = claims[0];

    const cluster = await db.claimCluster.create({
      data: {
        tenantId: tenant_id,
        primaryClaimId: primaryClaim.claim_id,
        size: claims.length,
        decisiveness:
          claims.reduce((sum, c) => sum + c.decisiveness, 0) / claims.length,
      },
      include: {
        primaryClaim: true,
      },
    });

    // Update claims with cluster_id
    await db.claim.updateMany({
      where: {
        id: { in: claims.map((c) => c.claim_id) },
      },
      data: {
        clusterId: cluster.id,
      },
    });

    // Emit event
    await eventStore.append({
      event_id: crypto.randomUUID(),
      tenant_id,
      actor_id: "claim-clusterer",
      type: "claim.clustered",
      occurred_at: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      schema_version: "1.0",
      evidence_refs: claims.flatMap((c) => c.evidence_refs),
      payload: {
        cluster_id: cluster.id,
        claim_ids: claims.map((c) => c.claim_id),
      },
      signatures: [],
    });

    return [
      {
        cluster_id: cluster.id,
        tenant_id: cluster.tenantId,
        primary_claim: {
          claim_id: cluster.primaryClaim.id,
          tenant_id: cluster.primaryClaim.tenantId,
          canonical_text: cluster.primaryClaim.canonicalText,
          variants: cluster.primaryClaim.variants,
          evidence_refs: [],
          decisiveness: cluster.primaryClaim.decisiveness,
          cluster_id: cluster.id,
          created_at: cluster.primaryClaim.createdAt.toISOString(),
        },
        related_claims: [],
        size: cluster.size,
        decisiveness: cluster.decisiveness,
        created_at: cluster.createdAt.toISOString(),
      },
    ];
  }
}
