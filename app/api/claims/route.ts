/**
 * Claims API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { ClaimExtractionService, type Claim } from "@/lib/claims/extraction";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { broadcastClaimUpdate } from "@/lib/events/broadcast-helper";
import { validateBusinessRules } from "@/lib/validation/business-rules";
import { IdempotencyService, withIdempotency } from "@/lib/operations/idempotency";
import { TransactionManager } from "@/lib/operations/transaction-manager";
import { ErrorRecoveryService } from "@/lib/operations/error-recovery";
import { logger } from "@/lib/logging/logger";
import type { EventEnvelope } from "@/lib/events/types";
import { randomUUID } from "crypto";
import { z } from "zod";

const eventStore = new DatabaseEventStore();
const evidenceVault = new DatabaseEvidenceVault();
const claimService = new ClaimExtractionService(evidenceVault, eventStore);
const idempotencyService = new IdempotencyService();
const transactionManager = new TransactionManager();
const errorRecovery = new ErrorRecoveryService();

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const searchParams = request.nextUrl.searchParams;
    const cluster_id = searchParams.get("cluster_id");

    const where: any = { tenantId: tenant_id };
    if (cluster_id) {
      where.clusterId = cluster_id;
    }

    const claims = await db.claim.findMany({
      where,
      include: {
        evidenceRefs: {
          include: {
            evidence: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(claims);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching claims", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const extractClaimsSchema = z.object({
  evidence_id: z.string(),
  use_llm: z.boolean().optional(),
  rules: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const user_id = (user as any).id || "";
    const body = await request.json();
    const validated = extractClaimsSchema.parse(body);

    // Validate evidence exists and belongs to tenant
    const evidenceValidation = await validateBusinessRules("claim", {
      evidenceIds: [validated.evidence_id],
    }, tenant_id);

    if (!evidenceValidation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: evidenceValidation.errors },
        { status: 400 }
      );
    }

    // Execute with idempotency and error recovery
    const claims: Claim[] = await withIdempotency(
      idempotencyService,
      tenant_id,
      "extract_claims",
      {
        evidence_id: validated.evidence_id,
        use_llm: validated.use_llm,
        rules: validated.rules,
      },
      async () => {
        const recoveryResult = await errorRecovery.executeWithRecovery(
          async () => {
            return await claimService.extractClaims(validated.evidence_id, {
              use_llm: validated.use_llm,
              rules: validated.rules,
            });
          },
          {
            retry: {
              maxAttempts: 2,
              backoffMs: 1000,
              exponential: true,
            },
            timeout: 60_000, // 60 seconds for LLM operations
            circuitBreaker: errorRecovery.getCircuitBreaker("claim_extraction"),
          },
          "extract_claims"
        );

        if (!recoveryResult.success) {
          throw recoveryResult.error || new Error("Claim extraction failed");
        }

        return recoveryResult.result as Claim[];
      }
    );

    // Audit logging
    const auditLog = new DatabaseAuditLog();
    const correlationId = `claim-extraction-${validated.evidence_id}-${Date.now()}`;
    const occurredAt = new Date().toISOString();
    const auditEvent: EventEnvelope = {
      event_id: randomUUID(),
      tenant_id,
      actor_id: user_id,
      type: "action.claim_extraction",
      occurred_at: occurredAt,
      correlation_id: correlationId,
      causation_id: undefined,
      schema_version: "1.0",
      evidence_refs: [validated.evidence_id, ...claims.map((c) => c.claim_id)],
      payload: {
        evidence_id: validated.evidence_id,
        claims_count: claims.length,
        use_llm: validated.use_llm || false,
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
      evidence_refs: [validated.evidence_id, ...claims.map((c) => c.claim_id)],
    });

    // Broadcast real-time updates for each created claim
    for (const claim of claims) {
      await broadcastClaimUpdate(claim.claim_id, "created", {
        canonicalText: claim.canonical_text,
        decisiveness: claim.decisiveness,
      }, tenant_id);
    }

    return NextResponse.json(claims, { status: 201 });
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
    logger.error("Error extracting claims", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
