/**
 * Event Stream API
 * Server-Sent Events for real-time event streaming
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { SSESender } from "@/lib/streaming/events";
import { logger } from "@/lib/logging/logger";

const eventStore = new DatabaseEventStore();
const sseSender = new SSESender();

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const searchParams = request.nextUrl.searchParams;
    const eventType = searchParams.get("type");

    return sseSender.createStream(
      async (send) => {
        // Send initial connection message
        send({ type: "connected", tenant_id }, { event: "connection" });

        // Stream events (runs indefinitely)
        await eventStore.stream(
          {
            tenant_id,
            type: eventType || undefined,
          },
          async (eventEnvelope) => {
            // Transform EventEnvelope to OpsEvent format for client compatibility
            const opsEvent = {
              id: eventEnvelope.event_id,
              type: eventEnvelope.type,
              occurred_at: eventEnvelope.occurred_at,
              actor_id: eventEnvelope.actor_id,
              correlation_id: eventEnvelope.correlation_id,
              data: eventEnvelope.payload,
            };
            send(opsEvent, { event: "event" });
          },
          {
            signal: request.signal, // Pass abort signal for cancellation
          }
        );
      },
      {
        heartbeatInterval: 30000,
        request,
      }
    );
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return new Response("Unauthorized", { status: 401 });
    }
    logger.error("Error streaming events", { error: error instanceof Error ? error.message : String(error) });
    return new Response("Internal server error", { status: 500 });
  }
}
