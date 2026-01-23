/**
 * Security Incident Narrative Risk Assessment API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { SecurityIncidentService } from "@/lib/security-incidents/service";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { logger } from "@/lib/logging/logger";
import { randomUUID } from "crypto";

const incidentService = new SecurityIncidentService();
const auditLog = new DatabaseAuditLog();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";
    const { id } = await params;

    const assessment = await incidentService.assessNarrativeRisk(tenantId, id);

    await auditLog.append({
      audit_id: randomUUID(),
      tenant_id: tenantId,
        actor_id: user.id || "",
      type: "event",
      timestamp: new Date().toISOString(),
      correlation_id: `incident-${id}`,
      causation_id: undefined,
      data: {
        action: "narrative_risk_assessed",
        resourceType: "SecurityIncident",
        resourceId: id,
        narrative_risk_score: assessment.narrativeRiskScore,
        outbreak_probability: assessment.outbreakProbability,
        urgency: assessment.urgencyLevel,
      } as any,
      evidence_refs: [],
    });

    return NextResponse.json({ assessment });
  } catch (error) {
    logger.error("Error assessing narrative risk", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to assess narrative risk" },
      { status: 500 }
    );
  }
}
