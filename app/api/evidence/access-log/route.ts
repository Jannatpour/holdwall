/**
 * Evidence Access Log API
 * 
 * Endpoints for querying evidence access logs
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { EvidenceAccessControlService } from "@/lib/evidence/access-control";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const accessControlService = new EvidenceAccessControlService();

const getAccessLogSchema = z.object({
  evidence_id: z.string(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
  access_type: z.enum(["READ", "WRITE", "DELETE", "EXPORT", "REDACT"]).optional(),
  actor_id: z.string().optional(),
});

const getTenantAccessLogSchema = z.object({
  tenant_id: z.string(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
  access_type: z.enum(["READ", "WRITE", "DELETE", "EXPORT", "REDACT"]).optional(),
  actor_id: z.string().optional(),
  evidence_id: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "evidence";

    if (scope === "evidence") {
      const evidence_id = searchParams.get("evidence_id");
      if (!evidence_id) {
        return NextResponse.json(
          { error: "evidence_id is required" },
          { status: 400 }
        );
      }

      const validated = getAccessLogSchema.parse({
        evidence_id,
        limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
        offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : undefined,
        access_type: searchParams.get("access_type") as any,
        actor_id: searchParams.get("actor_id") || undefined,
      });

      const logs = await accessControlService.getAccessLog(validated.evidence_id, {
        limit: validated.limit,
        offset: validated.offset,
        access_type: validated.access_type,
        actor_id: validated.actor_id,
      });

      return NextResponse.json({
        logs,
        count: logs.length,
      });
    }

    if (scope === "tenant") {
      const validated = getTenantAccessLogSchema.parse({
        tenant_id,
        limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
        offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : undefined,
        access_type: searchParams.get("access_type") as any,
        actor_id: searchParams.get("actor_id") || undefined,
        evidence_id: searchParams.get("evidence_id") || undefined,
      });

      const logs = await accessControlService.getTenantAccessLog(validated.tenant_id, {
        limit: validated.limit,
        offset: validated.offset,
        access_type: validated.access_type,
        actor_id: validated.actor_id,
        evidence_id: validated.evidence_id,
      });

      return NextResponse.json({
        logs,
        count: logs.length,
      });
    }

    return NextResponse.json(
      { error: "Invalid scope. Use 'evidence' or 'tenant'" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Access log API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
