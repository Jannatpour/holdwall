/**
 * Security Incidents API Routes
 * 
 * Handles CRUD operations for security incidents and narrative management
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { SecurityIncidentService } from "@/lib/security-incidents/service";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import { validateBusinessRules } from "@/lib/validation/business-rules";
import { IdempotencyService, withIdempotency, generateIdempotencyKey } from "@/lib/operations/idempotency";
import { TransactionManager } from "@/lib/operations/transaction-manager";
import { ErrorRecoveryService } from "@/lib/operations/error-recovery";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";
import { randomUUID } from "crypto";

const idempotencyService = new IdempotencyService();
const transactionManager = new TransactionManager();
const errorRecovery = new ErrorRecoveryService();
const incidentService = new SecurityIncidentService();
const auditLog = new DatabaseAuditLog();

const createIncidentSchema = z.object({
  externalId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.enum([
    "DATA_BREACH",
    "RANSOMWARE",
    "DDOS",
    "PHISHING",
    "MALWARE",
    "UNAUTHORIZED_ACCESS",
    "INSIDER_THREAT",
    "VULNERABILITY_EXPLOIT",
    "ACCOUNT_COMPROMISE",
    "SYSTEM_COMPROMISE",
    "OTHER",
  ]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  detectedAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid datetime format",
  }),
  source: z.string().optional(),
  sourceMetadata: z.record(z.string(), z.unknown()).optional(),
  evidenceRefs: z.array(z.string()).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"]),
  resolvedAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid datetime format",
  }).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const severity = searchParams.get("severity");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const incidents = await incidentService.getIncidents(tenantId, {
      type: type as any,
      severity: severity as any,
      status: status as any,
      limit,
      offset,
    });

    await auditLog.append({
      audit_id: randomUUID(),
      tenant_id: tenantId,
      actor_id: user.id || "",
      type: "event",
      timestamp: new Date().toISOString(),
      correlation_id: `security-incidents-list-${Date.now()}`,
      causation_id: undefined,
      data: {
        action: "security_incidents_listed",
        resourceType: "SecurityIncident",
        count: incidents.length,
        filters: { type, severity, status },
      } as any,
      evidence_refs: [],
    });

    return NextResponse.json({ incidents });
  } catch (error) {
    logger.error("Error listing security incidents", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to list security incidents" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const body = await request.json();
    const validated = createIncidentSchema.parse(body);

    // Validate business rules
    await validateBusinessRules("SecurityIncident", validated, tenantId);

    // Create incident with idempotency (use externalId if available, otherwise use title+detectedAt)
    const idempotencyParams = validated.externalId 
      ? { externalId: validated.externalId }
      : { title: validated.title, detectedAt: validated.detectedAt };

    const incident = await withIdempotency(
      idempotencyService,
      tenantId,
      "create_security_incident",
      idempotencyParams,
      async () => {
        return await incidentService.createIncident(tenantId, {
          externalId: validated.externalId,
          title: validated.title,
          description: validated.description,
          type: validated.type,
          severity: validated.severity,
          detectedAt: new Date(validated.detectedAt),
          source: validated.source,
          sourceMetadata: validated.sourceMetadata,
          evidenceRefs: validated.evidenceRefs,
        });
      }
    );

    await auditLog.append({
      audit_id: randomUUID(),
      tenant_id: tenantId,
      actor_id: user.id || "",
      type: "event",
      timestamp: new Date().toISOString(),
      correlation_id: `incident-${incident.id}`,
      causation_id: undefined,
      data: {
        action: "security_incident_created",
        resourceType: "SecurityIncident",
        resourceId: incident.id,
        type: incident.type,
        severity: incident.severity,
        narrative_risk_score: incident.narrativeRiskScore,
      } as any,
      evidence_refs: [],
    });

    return NextResponse.json({ incident }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error creating security incident", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
