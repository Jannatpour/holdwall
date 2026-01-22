/**
 * POS: Trust Substitution Mechanism API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { TrustSubstitutionMechanism } from "@/lib/pos/trust-substitution";
import { logger } from "@/lib/logging/logger";

const trustService = new TrustSubstitutionMechanism();

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "score") {
      const score = await trustService.getTrustSubstitutionScore(tenantId);
      return NextResponse.json({ score });
    }

    if (action === "recommendation") {
      const recommendation =
        await trustService.generateRecommendation(tenantId);
      return NextResponse.json({ recommendation });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Trust API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const body = await request.json();
    const { type, ...data } = body;

    if (type === "validator") {
      const validatorId = await trustService.registerValidator({
        tenantId,
        ...data,
      });
      return NextResponse.json({ success: true, validatorId });
    }

    if (type === "audit") {
      const auditId = await trustService.createAudit({
        tenantId,
        ...data,
      });
      return NextResponse.json({ success: true, auditId });
    }

    if (type === "complete-audit") {
      const { auditId, findings, recommendations, publicUrl } = data;
      const url = await trustService.completeAudit(
        auditId,
        findings,
        recommendations,
        publicUrl
      );
      return NextResponse.json({ success: true, publicUrl: url });
    }

    if (type === "sla") {
      const slaId = await trustService.createSLA({
        tenantId,
        ...data,
      });
      return NextResponse.json({ success: true, slaId });
    }

    if (type === "update-sla") {
      const { slaId, actual } = data;
      await trustService.updateSLAMetric(slaId, actual);
      return NextResponse.json({ success: true });
    }

    if (type === "publish-sla") {
      const { slaId, publicUrl } = data;
      const url = await trustService.publishSLA(slaId, publicUrl);
      return NextResponse.json({ success: true, publicUrl: url });
    }

    return NextResponse.json(
      { error: "Invalid type" },
      { status: 400 }
    );
  } catch (error) {
    const { logger } = await import("@/lib/logging/logger");
    logger.error("Trust API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
