/**
 * Security Incident Explanation API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { SecurityIncidentService } from "@/lib/security-incidents/service";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";
import { randomUUID } from "crypto";

const incidentService = new SecurityIncidentService();
const auditLog = new DatabaseAuditLog();

const generateExplanationSchema = z.object({
  includeRootCause: z.boolean().optional(),
  includeResolution: z.boolean().optional(),
  includePrevention: z.boolean().optional(),
});

const createExplanationSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  explanation: z.string().min(1),
  rootCause: z.string().optional(),
  resolution: z.string().optional(),
  prevention: z.string().optional(),
  evidenceRefs: z.array(z.string()),
  autopilotMode: z.enum(["RECOMMEND_ONLY", "AUTO_DRAFT", "AUTO_ROUTE", "AUTO_PUBLISH"]).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";
    const { id } = await params;

    const body = await request.json();
    const action = body.action;

    if (action === "generate") {
      // Generate explanation draft
      const validated = generateExplanationSchema.parse(body);
      const draft = await incidentService.generateIncidentExplanation(tenantId, id, {
        includeRootCause: validated.includeRootCause,
        includeResolution: validated.includeResolution,
        includePrevention: validated.includePrevention,
      });

      await auditLog.append({
        audit_id: randomUUID(),
        tenant_id: tenantId,
        actor_id: user.id || "",
        type: "event",
        timestamp: new Date().toISOString(),
        correlation_id: `incident-${id}`,
        causation_id: undefined,
        data: {
          action: "incident_explanation_generated",
          resourceType: "SecurityIncident",
          resourceId: id,
        } as any,
        evidence_refs: [],
      });

      return NextResponse.json({ draft });
    } else if (action === "create") {
      // Create and publish explanation
      const validated = createExplanationSchema.parse(body);
      const result = await incidentService.createAndPublishExplanation(
        tenantId,
        id,
        {
          title: validated.title,
          summary: validated.summary,
          explanation: validated.explanation,
          rootCause: validated.rootCause,
          resolution: validated.resolution,
          prevention: validated.prevention,
          evidenceRefs: validated.evidenceRefs,
        },
        validated.autopilotMode || "AUTO_ROUTE"
      );

      await auditLog.append({
        audit_id: randomUUID(),
        tenant_id: tenantId,
        actor_id: user.id || "",
        type: "event",
        timestamp: new Date().toISOString(),
        correlation_id: `incident-${id}`,
        causation_id: undefined,
        data: {
          action: "incident_explanation_created",
          resourceType: "SecurityIncident",
          resourceId: id,
          explanation_id: result.explanationId,
          published: result.published,
        } as any,
        evidence_refs: [],
      });

      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'generate' or 'create'" },
        { status: 400 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Error handling incident explanation", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to handle incident explanation" },
      { status: 500 }
    );
  }
}
