/**
 * Trust Assets API
 * 
 * Manage trust assets (audits, SLAs, dashboards, certifications)
 * Trust Asset Library
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const createAssetSchema = z.object({
  type: z.enum(["SOC2", "SLA", "AUDIT", "CERTIFICATION", "DASHBOARD", "INCIDENT_TRACKER", "OTHER"]),
  name: z.string().min(1),
  description: z.string().optional(),
  url: z.string().url().optional(),
  verified: z.boolean().default(false),
  expires_at: z.string().optional(), // ISO date string
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    // Use published AAAL artifacts as trust assets
    // In production, would have dedicated TrustAsset model
    const artifacts = await db.aAALArtifact.findMany({
      where: {
        tenantId: tenant_id,
        status: "PUBLISHED",
      },
      include: {
        evidenceRefs: {
          include: {
            evidence: true,
          },
        },
      },
      orderBy: { publishedAt: "desc" },
    });

    // Also check for any trust-related metadata in artifacts
    const assets = artifacts.map(artifact => {
      const metadata = ((artifact.policyChecks as any) || {}) as Record<string, unknown>;
      const trustType = typeof (metadata as any).trust_type === "string" ? (metadata as any).trust_type : "OTHER";
      const verified = Boolean((metadata as any).verified) || artifact.padlPublished;
      const expiresAt = typeof (metadata as any).expires_at === "string" ? (metadata as any).expires_at : undefined;

      return {
        asset_id: artifact.id,
        type: trustType,
        name: artifact.title,
        description: (artifact.content as string || "").substring(0, 200),
        url: artifact.padlUrl || undefined,
        verified,
        expires_at: expiresAt || undefined,
        created_at: artifact.createdAt.toISOString(),
        updated_at: artifact.updatedAt.toISOString(),
        metadata: {
          ...metadata,
          citations_count: artifact.evidenceRefs.length,
        },
      };
    });

    return NextResponse.json({
      assets,
      total: assets.length,
      verified_count: assets.filter(a => a.verified).length,
      expired_count: assets.filter(a => {
        if (!a.expires_at) return false;
        return new Date(a.expires_at).getTime() < Date.now();
      }).length,
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching trust assets", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();
    const validated = createAssetSchema.parse(body);

    // Create trust asset as AAAL artifact with trust metadata
    // In production, would have dedicated TrustAsset model
    const artifact = await db.aAALArtifact.create({
      data: {
        tenantId: tenant_id,
        title: validated.name,
        content: validated.description || "",
        version: "1.0",
        status: "DRAFT",
        approvers: [],
        requiredApprovals: 0,
        policyChecks: {
          trust_type: validated.type,
          trust_asset: true,
          verified: validated.verified,
          expires_at: validated.expires_at,
          url: validated.url,
          ...validated.metadata,
        },
      },
    });

    return NextResponse.json({
      asset_id: artifact.id,
      type: validated.type,
      name: validated.name,
      created_at: artifact.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error creating trust asset", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
