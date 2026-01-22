/**
 * Evidence API Routes
 * CRUD operations for evidence vault
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const evidenceVault = new DatabaseEvidenceVault();

const createEvidenceSchema = z.object({
  tenant_id: z.string(),
  type: z.enum(["signal", "document", "artifact", "metric", "external"]),
  source: z.object({
    type: z.string(),
    id: z.string(),
    url: z.string().optional(),
    collected_at: z.string(),
    collected_by: z.string(),
    method: z.enum(["api", "rss", "export", "manual"]),
  }),
  content: z.object({
    raw: z.string().optional(),
    normalized: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  provenance: z.object({
    collection_method: z.string(),
    retention_policy: z.string(),
    compliance_flags: z.array(z.string()).optional(),
  }),
  signature: z
    .object({
      algorithm: z.string(),
      signature: z.string(),
      signer_id: z.string(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const evidence_id = searchParams.get("id");
    const include = searchParams.get("include");
    const tenant_id = searchParams.get("tenant_id") || ((session.user as any).tenantId || "");

    if (evidence_id) {
      if (include === "links") {
        const record = await db.evidence.findUnique({
          where: { id: evidence_id },
          include: {
            claimRefs: { include: { claim: true } },
            artifactRefs: { include: { artifact: true } },
            eventRefs: { include: { event: true } },
          },
        });

        if (!record) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        if (record.tenantId !== tenant_id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json({
          id: record.id,
          tenant_id: record.tenantId,
          type: record.type,
          source: {
            type: record.sourceType,
            id: record.sourceId,
            url: record.sourceUrl || null,
            collected_at: record.collectedAt.toISOString(),
            collected_by: record.collectedBy,
            method: record.method,
          },
          content: {
            raw: record.contentRaw,
            normalized: record.contentNormalized,
            metadata: record.contentMetadata,
          },
          created_at: record.createdAt.toISOString(),
          updated_at: record.updatedAt.toISOString(),
          links: {
            claims: record.claimRefs.map((r) => r.claim),
            artifacts: record.artifactRefs.map((r) => r.artifact),
            events: record.eventRefs.map((r) => r.event),
          },
        });
      }

      const evidence = await evidenceVault.get(evidence_id);
      if (!evidence) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (evidence.tenant_id !== tenant_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json(evidence);
    }

    const filters = {
      tenant_id,
      type: searchParams.get("type") || undefined,
      source_type: searchParams.get("source_type") || undefined,
      created_after: searchParams.get("created_after") || undefined,
      created_before: searchParams.get("created_before") || undefined,
    };

    const results = await evidenceVault.query(filters);
    return NextResponse.json(results);
  } catch (error) {
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error fetching evidence", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createEvidenceSchema.parse(body);

    // Ensure tenant_id matches session
    const tenant_id = (session.user as any).tenantId || "";
    if (validated.tenant_id !== tenant_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const evidence_id = await evidenceVault.store(validated);
    return NextResponse.json({ evidence_id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    logger.error("Error storing evidence", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const evidence_id = searchParams.get("id");

    if (!evidence_id) {
      return NextResponse.json(
        { error: "evidence_id required" },
        { status: 400 }
      );
    }

    const evidence = await evidenceVault.get(evidence_id);
    if (!evidence) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const tenant_id = (session.user as any).tenantId || "";
    if (evidence.tenant_id !== tenant_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await evidenceVault.delete(evidence_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Error deleting evidence", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
