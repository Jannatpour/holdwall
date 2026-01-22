/**
 * Signal Actions API
 * Actions for signals: link to cluster, create cluster, mark high-risk
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { ClaimExtractionService } from "@/lib/claims/extraction";
import { DatabaseClaimClusteringService } from "@/lib/claims/clustering";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { broadcastClusterUpdate } from "@/lib/events/broadcast-helper";
import { logger } from "@/lib/logging/logger";
import type { EventEnvelope } from "@/lib/events/types";
import { randomUUID } from "crypto";
import { z } from "zod";

const eventStore = new DatabaseEventStore();
const evidenceVault = new DatabaseEvidenceVault();
const claimService = new ClaimExtractionService(evidenceVault, eventStore);
const clusteringService = new DatabaseClaimClusteringService();

const linkToClusterSchema = z.object({
  evidence_id: z.string(),
  cluster_id: z.string(),
});

const createClusterSchema = z.object({
  evidence_id: z.string(),
});

const markHighRiskSchema = z.object({
  evidence_id: z.string(),
  is_high_risk: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const user_id = (user as any).id || "";
    const body = await request.json();
    const action = body.action;
    const auditLog = new DatabaseAuditLog();

    if (action === "link_to_cluster") {
      const validated = linkToClusterSchema.parse(body);
      
      // Extract claims from evidence if not already done
      const claims = await claimService.extractClaims(validated.evidence_id, {
        use_llm: true,
      });

      if (claims.length === 0) {
        return NextResponse.json(
          { error: "No claims found in evidence" },
          { status: 400 }
        );
      }

      // Get cluster
      const cluster = await db.claimCluster.findUnique({
        where: { id: validated.cluster_id },
      });

      if (!cluster || cluster.tenantId !== tenant_id) {
        return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
      }

      // Link claims to cluster
      await db.claim.updateMany({
        where: {
          id: { in: claims.map((c) => c.claim_id) },
          tenantId: tenant_id,
        },
        data: {
          clusterId: validated.cluster_id,
        },
      });

      // Audit logging
      const correlationId = `signal-link-cluster-${validated.evidence_id}-${Date.now()}`;
      const occurredAt = new Date().toISOString();
      const auditEvent: EventEnvelope = {
        event_id: randomUUID(),
        tenant_id,
        actor_id: user_id,
        type: "action.signal_link_to_cluster",
        occurred_at: occurredAt,
        correlation_id: correlationId,
        causation_id: undefined,
        schema_version: "1.0",
        evidence_refs: [validated.evidence_id, validated.cluster_id],
        payload: {
          evidence_id: validated.evidence_id,
          cluster_id: validated.cluster_id,
          claims_linked: claims.length,
        },
        signatures: [],
      };
      await auditLog.append({
        audit_id: randomUUID(),
        tenant_id,
        actor_id: user_id,
        type: "event",
        timestamp: occurredAt,
        correlation_id: correlationId,
        causation_id: undefined,
        data: auditEvent,
        evidence_refs: [validated.evidence_id, validated.cluster_id],
      });

      return NextResponse.json({ success: true, cluster_id: validated.cluster_id });
    }

    if (action === "create_cluster") {
      const validated = createClusterSchema.parse(body);
      
      // Extract claims from evidence
      const claims = await claimService.extractClaims(validated.evidence_id, {
        use_llm: true,
      });

      if (claims.length === 0) {
        return NextResponse.json(
          { error: "No claims found in evidence" },
          { status: 400 }
        );
      }

      // Create cluster from claims
      const clusters = await clusteringService.clusterClaims(tenant_id, claims);

      // Broadcast real-time updates for created clusters
      for (const cluster of clusters) {
        await broadcastClusterUpdate(cluster.cluster_id, "created", {
          size: cluster.size,
          decisiveness: cluster.decisiveness,
        }, tenant_id);
      }

      return NextResponse.json({
        success: true,
        cluster_id: clusters[0]?.cluster_id,
      });
    }

    if (action === "mark_high_risk") {
      const validated = markHighRiskSchema.parse(body);
      
      // Update evidence metadata
      const evidence = await db.evidence.findUnique({
        where: { id: validated.evidence_id },
      });

      if (!evidence || evidence.tenantId !== tenant_id) {
        return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
      }

      const metadata = (evidence.metadata as any) || {};
      metadata.high_risk = validated.is_high_risk;
      metadata.risk_marked_at = new Date().toISOString();

      await db.evidence.update({
        where: { id: validated.evidence_id },
        data: { metadata },
      });

      // Audit logging
      const correlationId = `signal-mark-risk-${validated.evidence_id}-${Date.now()}`;
      const occurredAt = new Date().toISOString();
      const auditEvent: EventEnvelope = {
        event_id: randomUUID(),
        tenant_id,
        actor_id: user_id,
        type: "action.signal_mark_high_risk",
        occurred_at: occurredAt,
        correlation_id: correlationId,
        causation_id: undefined,
        schema_version: "1.0",
        evidence_refs: [validated.evidence_id],
        payload: {
          evidence_id: validated.evidence_id,
          is_high_risk: validated.is_high_risk,
        },
        signatures: [],
      };
      await auditLog.append({
        audit_id: randomUUID(),
        tenant_id,
        actor_id: user_id,
        type: "event",
        timestamp: occurredAt,
        correlation_id: correlationId,
        causation_id: undefined,
        data: auditEvent,
        evidence_refs: [validated.evidence_id],
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error processing signal action", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
