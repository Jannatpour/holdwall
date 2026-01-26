/**
 * POS: Trust Substitution Mechanism API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { TrustSubstitutionMechanism } from "@/lib/pos/trust-substitution";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const trustService = new TrustSubstitutionMechanism();

const trustPostSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("validator"),
    name: z.string().min(1),
    validatorType: z.enum([
      "INDEPENDENT_AUDIT",
      "CERTIFICATION_BODY",
      "EXPERT_PANEL",
      "RESEARCH_INSTITUTION",
      "STANDARDS_ORGANIZATION",
    ]),
    description: z.string().optional(),
    url: z.string().url().optional(),
    publicKey: z.string().optional(),
    trustLevel: z.number().min(0).max(1).optional(),
  }),
  z.object({
    type: z.literal("audit"),
    auditType: z.enum(["SECURITY", "COMPLIANCE", "OPERATIONAL", "FINANCIAL", "QUALITY"]),
    title: z.string().min(1),
    description: z.string().optional(),
    auditorId: z.string().min(1).optional(),
    findings: z.record(z.string(), z.unknown()).optional(),
    recommendations: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("complete-audit"),
    auditId: z.string().min(1),
    findings: z.record(z.string(), z.unknown()),
    recommendations: z.record(z.string(), z.unknown()),
    publicUrl: z.string().url().optional(),
  }),
  z.object({
    type: z.literal("sla"),
    name: z.string().min(1),
    description: z.string().optional(),
    metric: z.string().min(1),
    target: z.number(),
    unit: z.string().min(1),
    period: z.enum(["HOURLY", "DAILY", "WEEKLY", "MONTHLY", "QUARTERLY"]),
  }),
  z.object({
    type: z.literal("update-sla"),
    slaId: z.string().min(1),
    actual: z.number(),
  }),
  z.object({
    type: z.literal("publish-sla"),
    slaId: z.string().min(1),
    publicUrl: z.string().url().optional(),
  }),
]);

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
    const validated = trustPostSchema.parse(body);

    if (validated.type === "validator") {
      const validatorId = await trustService.registerValidator({
        tenantId,
        name: validated.name,
        type: validated.validatorType,
        description: validated.description,
        url: validated.url,
        publicKey: validated.publicKey,
        trustLevel: validated.trustLevel,
      });
      return NextResponse.json({ success: true, validatorId });
    }

    if (validated.type === "audit") {
      const auditId = await trustService.createAudit({
        tenantId,
        type: validated.auditType,
        title: validated.title,
        description: validated.description,
        auditorId: validated.auditorId,
        findings: validated.findings as any,
        recommendations: validated.recommendations as any,
      });
      return NextResponse.json({ success: true, auditId });
    }

    if (validated.type === "complete-audit") {
      const url = await trustService.completeAudit(
        validated.auditId,
        validated.findings as any,
        validated.recommendations as any,
        validated.publicUrl
      );
      return NextResponse.json({ success: true, publicUrl: url });
    }

    if (validated.type === "sla") {
      const slaId = await trustService.createSLA({
        tenantId,
        name: validated.name,
        description: validated.description,
        metric: validated.metric,
        target: validated.target,
        unit: validated.unit,
        period: validated.period,
      });
      return NextResponse.json({ success: true, slaId });
    }

    if (validated.type === "update-sla") {
      await trustService.updateSLAMetric(validated.slaId, validated.actual);
      return NextResponse.json({ success: true });
    }

    if (validated.type === "publish-sla") {
      const url = await trustService.publishSLA(validated.slaId, validated.publicUrl);
      return NextResponse.json({ success: true, publicUrl: url });
    }

    return NextResponse.json(
      { error: "Invalid type" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
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
