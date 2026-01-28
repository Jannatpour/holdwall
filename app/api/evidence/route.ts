/**
 * Evidence API Routes
 * CRUD operations for evidence vault
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { db, enforceTenantId } from "@/lib/db/client";
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

export const GET = createApiHandler(
  async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
    const tenantId = context?.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant ID required" },
        { status: 400 }
      );
    }

    const enforcedTenantId = enforceTenantId(tenantId, "get evidence");
    const searchParams = request.nextUrl.searchParams;
    const evidence_id = searchParams.get("id");
    const include = searchParams.get("include");

    if (evidence_id) {
      if (include === "links") {
        const record = await db.evidence.findFirst({
          where: {
            id: evidence_id,
            tenantId: enforcedTenantId, // Enforce tenant isolation
          },
          include: {
            claimRefs: { include: { claim: true } },
            artifactRefs: { include: { artifact: true } },
            eventRefs: { include: { event: true } },
          },
        });

        if (!record) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
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

      const evidence = await evidenceVault.get(evidence_id, undefined, enforcedTenantId);
      if (!evidence) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      // Double-check tenant ownership (defense in depth)
      if (evidence.tenant_id !== enforcedTenantId) {
        logger.warn("Tenant isolation violation detected in evidence get", {
          evidence_id,
          requested_tenant_id: enforcedTenantId,
          actual_tenant_id: evidence.tenant_id,
        });
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json(evidence);
    }

    const filters = {
      tenant_id: enforcedTenantId, // Required for tenant isolation
      type: searchParams.get("type") || undefined,
      source_type: searchParams.get("source_type") || undefined,
      created_after: searchParams.get("created_after") || undefined,
      created_before: searchParams.get("created_before") || undefined,
    };

    const results = await evidenceVault.query(filters);
    return NextResponse.json(results);
  },
  {
    requireAuth: true,
    rateLimit: {
      windowMs: 60 * 1000,
      maxRequests: 100,
    },
  }
);

export const POST = createApiHandler(
  async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
    const tenantId = context?.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant ID required" },
        { status: 400 }
      );
    }

    const enforcedTenantId = enforceTenantId(tenantId, "store evidence");
    const body = await request.json();
    const validated = createEvidenceSchema.parse(body);

    // Ensure tenant_id matches authenticated tenant
    if (validated.tenant_id !== enforcedTenantId) {
      return NextResponse.json(
        { error: "Tenant ID mismatch" },
        { status: 403 }
      );
    }

    const evidence_id = await evidenceVault.store(validated);
    return NextResponse.json({ evidence_id }, { status: 201 });
  },
  {
    requireAuth: true,
    rateLimit: {
      windowMs: 60 * 1000,
      maxRequests: 50, // Lower limit for write operations
    },
  }
);

export const DELETE = createApiHandler(
  async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
    const tenantId = context?.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant ID required" },
        { status: 400 }
      );
    }

    const enforcedTenantId = enforceTenantId(tenantId, "delete evidence");
    const searchParams = request.nextUrl.searchParams;
    const evidence_id = searchParams.get("id");

    if (!evidence_id) {
      return NextResponse.json(
        { error: "evidence_id required" },
        { status: 400 }
      );
    }

    // Get evidence with tenant isolation enforcement
    const evidence = await evidenceVault.get(evidence_id, undefined, enforcedTenantId);
    if (!evidence) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Double-check tenant ownership (defense in depth)
    if (evidence.tenant_id !== enforcedTenantId) {
      logger.warn("Tenant isolation violation detected in evidence delete", {
        evidence_id,
        requested_tenant_id: enforcedTenantId,
        actual_tenant_id: evidence.tenant_id,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await evidenceVault.delete(evidence_id, enforcedTenantId);
    return NextResponse.json({ success: true });
  },
  {
    requireAuth: true,
    requireRole: "ADMIN", // Deletion requires admin role
    rateLimit: {
      windowMs: 60 * 1000,
      maxRequests: 20, // Lower limit for destructive operations
    },
  }
);
