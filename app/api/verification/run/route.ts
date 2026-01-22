/**
 * Verification API
 * Run end-to-end flow verifications
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { EndToEndVerifier } from "@/lib/verification/end-to-end-verifier";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const verifier = new EndToEndVerifier();

const verifySchema = z.object({
  tenantId: z.string().optional(),
  flow: z.enum(["all", "signal", "claim", "artifact"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";
    const body = await request.json();
    const validated = verifySchema.parse(body);

    const targetTenantId = validated.tenantId || tenantId;
    const flow = validated.flow || "all";

    let results: any[] = [];

    if (flow === "all") {
      results = await verifier.verifyAllFlows(targetTenantId);
    } else if (flow === "signal") {
      results = [await verifier.verifySignalIngestionFlow(targetTenantId)];
    } else if (flow === "claim") {
      // Need evidence ID for claim verification
      const evidenceVault = new (await import("@/lib/evidence/vault-db")).DatabaseEvidenceVault();
      const testEvidence = await evidenceVault.query({
        tenant_id: targetTenantId,
        type: "signal",
      });
      
      if (testEvidence.length > 0) {
        results = [await verifier.verifyClaimExtractionFlow(targetTenantId, testEvidence[0].evidence_id)];
      } else {
        return NextResponse.json({
          error: "No evidence found for claim verification",
          message: "Please ingest at least one signal before verifying claim extraction flow",
        }, { status: 400 });
      }
    } else if (flow === "artifact") {
      // Need evidence IDs for artifact verification
      const evidenceVault = new (await import("@/lib/evidence/vault-db")).DatabaseEvidenceVault();
      const testEvidence = await evidenceVault.query({
        tenant_id: targetTenantId,
        type: "signal",
      });
      
      if (testEvidence.length > 0) {
        results = [await verifier.verifyArtifactCreationFlow(
          targetTenantId,
          testEvidence.slice(0, 3).map(e => e.evidence_id)
        )];
      } else {
        return NextResponse.json({
          error: "No evidence found for artifact verification",
          message: "Please ingest at least one signal before verifying artifact creation flow",
        }, { status: 400 });
      }
    }

    const report = verifier.generateReport(results);

    return NextResponse.json({
      success: true,
      results,
      report,
      summary: {
        total: results.length,
        passed: results.filter(r => r.overallStatus === "pass").length,
        failed: results.filter(r => r.overallStatus === "fail").length,
        warnings: results.filter(r => r.overallStatus === "warning").length,
      },
    });
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
    logger.error("Error running verification", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    return NextResponse.json({
      availableFlows: [
        {
          id: "all",
          name: "All Flows",
          description: "Verify all critical business flows",
        },
        {
          id: "signal",
          name: "Signal Ingestion Flow",
          description: "Verify signal ingestion with validation, idempotency, and error recovery",
        },
        {
          id: "claim",
          name: "Claim Extraction Flow",
          description: "Verify claim extraction from evidence",
        },
        {
          id: "artifact",
          name: "Artifact Creation Flow",
          description: "Verify artifact creation with evidence references and transaction management",
        },
      ],
      usage: {
        method: "POST",
        endpoint: "/api/verification/run",
        body: {
          flow: "all | signal | claim | artifact",
          tenantId: "optional - defaults to authenticated user's tenant",
        },
      },
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
