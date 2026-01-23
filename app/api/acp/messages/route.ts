/**
 * ACP Messages API
 *
 * POST /api/acp/messages
 * Stores ACP envelopes as durable events (type: "acp.message") for streaming/audit.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import type { ACPMessageEnvelope } from "@/lib/acp/types";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { logger } from "@/lib/logging/logger";

const eventStore = new DatabaseEventStore();

function isEnvelope(value: unknown): value is ACPMessageEnvelope {
  if (!value || typeof value !== "object") return false;
  const v = value as any;
  return (
    typeof v.message_id === "string" &&
    typeof v.tenant_id === "string" &&
    typeof v.actor_id === "string" &&
    typeof v.type === "string" &&
    typeof v.timestamp === "string" &&
    typeof v.correlation_id === "string" &&
    typeof v.schema_version === "string" &&
    typeof v.payload === "object" &&
    Array.isArray(v.signatures)
  );
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "default";
    const userId = (user as any).id;

    const body = await request.json();
    const envelope: ACPMessageEnvelope = isEnvelope(body)
      ? body
      : isEnvelope(body?.envelope)
        ? body.envelope
        : null as any;

    if (!envelope) {
      return NextResponse.json(
        { error: "Invalid ACP envelope" },
        { status: 400 }
      );
    }

    // Enforce tenant scoping. Actor is attributed to the authenticated user.
    if (envelope.tenant_id !== tenantId) {
      return NextResponse.json(
        { error: "tenant_id does not match authenticated tenant" },
        { status: 403 }
      );
    }
    if (envelope.actor_id !== userId) {
      envelope.metadata = {
        ...(envelope.metadata || {}),
        original_actor_id: envelope.actor_id,
      };
      envelope.actor_id = userId;
    }

    await eventStore.append({
      event_id: envelope.message_id,
      tenant_id: envelope.tenant_id,
      actor_id: envelope.actor_id,
      type: "acp.message",
      occurred_at: envelope.timestamp,
      correlation_id: envelope.correlation_id,
      causation_id: envelope.causation_id,
      schema_version: envelope.schema_version,
      payload: envelope as any,
      signatures: (envelope.signatures || []) as any,
      metadata: (envelope.metadata || {}) as any,
      evidence_refs: [],
    });

    return NextResponse.json({ success: true, message_id: envelope.message_id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Failed to store ACP message", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

