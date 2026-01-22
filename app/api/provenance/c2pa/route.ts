/**
 * C2PA Content Credentials API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { C2PABuilder } from "@/lib/provenance/c2pa";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const createCredentialSchema = z.object({
  artifact_id: z.string(),
  author_id: z.string(),
  evidence_refs: z.array(z.string()).optional(),
  policy_ref: z.string().optional(),
  sign: z.boolean().optional(),
});

const verifyCredentialSchema = z.object({
  embedded_artifact: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const action = body.action;

    if (action === "create") {
      const validated = createCredentialSchema.parse(body);

      // Get artifact
      const { db } = await import("@/lib/db/client");
      const artifact = await db.aAALArtifact.findUnique({
        where: { id: validated.artifact_id },
        select: {
          id: true,
          content: true,
          tenantId: true,
          createdAt: true,
        },
      });

      if (!artifact || artifact.tenantId !== tenant_id) {
        return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
      }

      const c2paBuilder = new C2PABuilder();
      const credential = await c2paBuilder.createCredential(
        {
          id: artifact.id,
          content: artifact.content,
          author_id: validated.author_id,
          created_at: artifact.createdAt.toISOString(),
          evidence_refs: validated.evidence_refs,
          policy_ref: validated.policy_ref,
        },
        {
          author_id: validated.author_id,
          policy_ref: validated.policy_ref,
          evidence_refs: validated.evidence_refs,
          sign: validated.sign || false,
        }
      );

      return NextResponse.json({
        credential,
        manifest: c2paBuilder.generateManifest(credential),
      });
    }

    if (action === "verify") {
      const validated = verifyCredentialSchema.parse(body);
      const c2paBuilder = new C2PABuilder();
      const result = await c2paBuilder.verifyCredential(validated.embedded_artifact);

      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'create' or 'verify'" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("C2PA API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
