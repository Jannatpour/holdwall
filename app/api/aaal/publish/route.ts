/**
 * AAAL Publish API
 * Publish artifacts to PADL
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { AAALStudioService } from "@/lib/aaal/studio";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { financialServicesMode } from "@/lib/financial-services/operating-mode";
import { broadcastArtifactUpdate } from "@/lib/events/broadcast-helper";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const eventStore = new DatabaseEventStore();
const evidenceVault = new DatabaseEvidenceVault();
const studioService = new AAALStudioService(evidenceVault, eventStore);

const publishSchema = z.object({
  artifact_id: z.string(),
  public_url: z.string().url().optional(),
  robots_directive: z.string().optional(),
  include_c2pa: z.boolean().optional(), // Include C2PA credentials
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();
    const validated = publishSchema.parse(body);

    // Get artifact
    const artifact = await db.aAALArtifact.findUnique({
      where: { id: validated.artifact_id },
    });

    if (!artifact || artifact.tenantId !== tenant_id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (artifact.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Artifact must be approved before publishing" },
        { status: 400 }
      );
    }

    // Check Financial Services mode requirements
    try {
      const fsConfig = await financialServicesMode.getConfig(tenant_id);
      if (fsConfig.enabled && fsConfig.legalApprovalRequired) {
        // Verify legal approval exists
        const legalApproval = await db.approval.findFirst({
          where: {
            tenantId: tenant_id,
            resourceId: validated.artifact_id,
            resourceType: "AAAL_ARTIFACT",
            decision: "APPROVED",
            approvers: {
              has: "Legal",
            },
          },
        });

        if (!legalApproval) {
          return NextResponse.json(
            {
              error: "Financial Services mode requires legal approval before publishing",
              requires_legal_approval: true,
            },
            { status: 403 }
          );
        }
      }
    } catch (fsError) {
      // If Financial Services check fails, continue (not all tenants have it enabled)
      logger.warn("Financial Services mode check failed, continuing with publish", {
        error: fsError instanceof Error ? fsError.message : String(fsError),
      });
    }

    // Publish to PADL
    const public_url = await studioService.publishToPADL(validated.artifact_id, {
      public_url: validated.public_url,
      robots_directive: validated.robots_directive,
      include_c2pa: validated.include_c2pa || false,
    });

    // Update artifact
    const updated = await db.aAALArtifact.update({
      where: { id: validated.artifact_id },
      data: {
        status: "PUBLISHED",
        padlPublished: true,
        padlUrl: public_url,
        padlRobots: validated.robots_directive,
        publishedAt: new Date(),
      },
    });

    // Broadcast real-time update
    await broadcastArtifactUpdate(validated.artifact_id, "published", {
      publicUrl: public_url,
      status: "PUBLISHED",
    }, tenant_id);

    return NextResponse.json({ public_url });
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
    logger.error("Error publishing artifact", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
