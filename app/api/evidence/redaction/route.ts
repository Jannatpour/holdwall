/**
 * Evidence Redaction API
 * 
 * Endpoints for evidence redaction with approval workflow
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { EvidenceRedactionService } from "@/lib/evidence/redaction";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const redactionService = new EvidenceRedactionService();

const requestRedactionSchema = z.object({
  evidence_id: z.string(),
  redaction_map: z.record(z.string(), z.string()),
  reason: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const approveRedactionSchema = z.object({
  redaction_id: z.string(),
});

const rejectRedactionSchema = z.object({
  redaction_id: z.string(),
  reason: z.string().optional(),
});

const getRedactionSchema = z.object({
  redaction_id: z.string(),
});

const getRedactionHistorySchema = z.object({
  evidence_id: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const actor_id = (user as any).id || "";

    const body = await request.json();
    const action = body.action;

    if (action === "request") {
      const validated = requestRedactionSchema.parse(body);

      const redaction = await redactionService.requestRedaction({
        evidence_id: validated.evidence_id,
        tenant_id,
        redacted_by: actor_id,
        redaction_map: validated.redaction_map,
        reason: validated.reason,
        metadata: validated.metadata,
      });

      return NextResponse.json({
        redaction,
      });
    }

    if (action === "approve") {
      const validated = approveRedactionSchema.parse(body);

      const redaction = await redactionService.approveRedaction(
        validated.redaction_id,
        actor_id,
        tenant_id
      );

      return NextResponse.json({
        redaction,
      });
    }

    if (action === "reject") {
      const validated = rejectRedactionSchema.parse(body);

      const redaction = await redactionService.rejectRedaction(
        validated.redaction_id,
        actor_id,
        tenant_id,
        validated.reason
      );

      return NextResponse.json({
        redaction,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'request', 'approve', or 'reject'" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Redaction API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "get";

    if (action === "get") {
      const redaction_id = searchParams.get("redaction_id");
      if (!redaction_id) {
        return NextResponse.json(
          { error: "redaction_id is required" },
          { status: 400 }
        );
      }

      const validated = getRedactionSchema.parse({ redaction_id });

      const redaction = await redactionService.getRedaction(validated.redaction_id);

      if (!redaction) {
        return NextResponse.json(
          { error: "Redaction not found" },
          { status: 404 }
        );
      }

      if (redaction.tenant_id !== tenant_id) {
        return NextResponse.json(
          { error: "Tenant mismatch" },
          { status: 403 }
        );
      }

      return NextResponse.json({
        redaction,
      });
    }

    if (action === "history") {
      const evidence_id = searchParams.get("evidence_id");
      if (!evidence_id) {
        return NextResponse.json(
          { error: "evidence_id is required" },
          { status: 400 }
        );
      }

      const validated = getRedactionHistorySchema.parse({ evidence_id });

      const history = await redactionService.getRedactionHistory(validated.evidence_id);

      return NextResponse.json({
        history,
        count: history.length,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'get' or 'history'" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Redaction API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
