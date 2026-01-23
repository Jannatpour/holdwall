/**
 * Security Incident Detail API Routes
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

const updateStatusSchema = z.object({
  status: z.enum(["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"]),
  resolvedAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid datetime format",
  }).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";
    const { id } = await params;

    const incident = await incidentService.getIncident(tenantId, id);

    if (!incident) {
      return NextResponse.json(
        { error: "Security incident not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ incident });
  } catch (error) {
    logger.error("Error getting security incident", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to get security incident" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";
    const { id } = await params;

    const body = await request.json();
    const validated = updateStatusSchema.parse(body);

    const incident = await incidentService.updateStatus(
      tenantId,
      id,
      validated.status,
      validated.resolvedAt ? new Date(validated.resolvedAt) : undefined
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
        action: "security_incident_updated",
        resourceType: "SecurityIncident",
        resourceId: id,
        status: validated.status,
      } as any,
      evidence_refs: [],
    });

    return NextResponse.json({ incident });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Error updating security incident", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to update security incident" },
      { status: 500 }
    );
  }
}
