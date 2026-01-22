/**
 * Merkle Evidence Bundle API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { MerkleTreeBuilder } from "@/lib/evidence/merkle-bundle";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const createBundleSchema = z.object({
  evidence_ids: z.array(z.string()),
  bundle_id: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const verifyBundleSchema = z.object({
  bundle: z.object({
    bundle_id: z.string(),
    root_hash: z.string(),
    items: z.array(z.object({
      index: z.number(),
      data: z.string(),
      hash: z.string(),
    })),
  }),
});

const proveInclusionSchema = z.object({
  bundle: z.object({
    bundle_id: z.string(),
    root_hash: z.string(),
    tree: z.any(), // MerkleNode structure
    items: z.array(z.object({
      index: z.number(),
      data: z.string(),
      hash: z.string(),
    })),
  }),
  item_index: z.number(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const action = body.action;

    const evidenceVault = new DatabaseEvidenceVault();
    const merkleBuilder = new MerkleTreeBuilder();

    if (action === "create") {
      const validated = createBundleSchema.parse(body);

      // Get evidence items
      const evidence = await Promise.all(
        validated.evidence_ids.map((id) => evidenceVault.get(id))
      );
      const validEvidence = evidence.filter((e): e is NonNullable<typeof e> => e !== null && e.tenant_id === tenant_id);

      if (validEvidence.length === 0) {
        return NextResponse.json(
          { error: "No valid evidence found" },
          { status: 400 }
        );
      }

      const bundle = merkleBuilder.createBundle(
        validated.bundle_id || `bundle-${Date.now()}`,
        validEvidence as any,
        validated.metadata
      );

      return NextResponse.json({ bundle });
    }

    if (action === "verify") {
      const validated = verifyBundleSchema.parse(body);
      const isValid = merkleBuilder.verifyBundle(validated.bundle as any);

      return NextResponse.json({ valid: isValid });
    }

    if (action === "prove-inclusion") {
      const validated = proveInclusionSchema.parse(body);
      const proof = merkleBuilder.proveInclusion(validated.bundle as any, validated.item_index);

      if (!proof) {
        return NextResponse.json(
          { error: "Item not found in bundle" },
          { status: 404 }
        );
      }

      const isValid = merkleBuilder.verifyProof(proof);

      return NextResponse.json({
        proof,
        valid: isValid,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'create', 'verify', or 'prove-inclusion'" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Merkle bundle API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
