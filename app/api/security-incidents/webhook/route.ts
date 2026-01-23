/**
 * Security Tools Webhook Endpoint
 * 
 * Receives webhooks from security tools (SIEM, SOAR, etc.) and automatically
 * creates security incidents with narrative risk assessment.
 */

import { NextRequest, NextResponse } from "next/server";
import { SecurityIncidentWebhookHandler } from "@/lib/security-incidents/webhook";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const webhookHandler = new SecurityIncidentWebhookHandler();

const webhookSchema = z.object({
  source: z.string(),
  eventType: z.string(),
  payload: z.record(z.string(), z.unknown()),
  signature: z.string().optional(),
  timestamp: z.string().refine((val) => val ? !isNaN(Date.parse(val)) : true, {
    message: "Invalid datetime format",
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Get tenant ID from header or query param
    const tenantId = request.headers.get("X-Tenant-ID") || 
                     new URL(request.url).searchParams.get("tenant_id");

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant ID required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = webhookSchema.parse(body);

    // Handle webhook
    const result = await webhookHandler.handleWebhook(tenantId, {
      source: validated.source,
      eventType: validated.eventType,
      payload: validated.payload,
      signature: validated.signature,
      timestamp: validated.timestamp ? new Date(validated.timestamp) : new Date(),
    });

    return NextResponse.json({
      success: true,
      incident_id: result.incidentId,
      narrative_risk_assessed: result.narrativeRiskAssessed,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Error processing security incident webhook", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}
