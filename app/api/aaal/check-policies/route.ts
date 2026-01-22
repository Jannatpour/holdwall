/**
 * AAAL Policy Check API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { AAALStudioService } from "@/lib/aaal/studio";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { z } from "zod";

const eventStore = new DatabaseEventStore();
const evidenceVault = new DatabaseEvidenceVault();
const studioService = new AAALStudioService(evidenceVault, eventStore);

const checkPoliciesSchema = z.object({
  artifact_id: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();
    const validated = checkPoliciesSchema.parse(body);

    // Get artifact
    const artifact = await db.aAALArtifact.findUnique({
      where: { id: validated.artifact_id },
      include: {
        evidenceRefs: {
          include: {
            evidence: true,
          },
        },
      },
    });

    if (!artifact || artifact.tenantId !== tenant_id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Convert to document format
    const document = {
      artifact_id: artifact.id,
      tenant_id: artifact.tenantId,
      title: artifact.title,
      content: artifact.content,
      evidence_refs: artifact.evidenceRefs.map((ref: { evidenceId: string }) => ref.evidenceId),
      version: artifact.version,
      status: artifact.status.toLowerCase() as any,
      approval_routing: artifact.requiredApprovals > 0 ? {
        approvers: artifact.approvers,
        required_approvals: artifact.requiredApprovals,
        policy_checks: artifact.policyChecks as any,
      } : undefined,
      padl: artifact.padlPublished ? {
        published: true,
        public_url: artifact.padlUrl || undefined,
        integrity_hash: artifact.padlHash || undefined,
        robots_directive: artifact.padlRobots || undefined,
      } : undefined,
      created_at: artifact.createdAt.toISOString(),
      updated_at: artifact.updatedAt?.toISOString(),
      published_at: artifact.publishedAt?.toISOString(),
    };

    // Check policies
    const results = await studioService.checkPolicies(document);

    return NextResponse.json({ results });
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
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error checking policies", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
