/**
 * ACP Messages Stream API
 * Server-Sent Events endpoint for ACP message streaming
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
    const tenantId = (user as any).tenantId || "";

    return sseSender.createStream(
      async (send) => {
        // Send initial connection message
        send({ type: "connected", tenant_id: tenantId }, { event: "connection" });

        // Stream ACP messages (runs indefinitely)
        await eventStore.stream(
          {
            tenant_id: tenantId,
            type: "acp.message",
          },
          async (event) => {
            try {
              send(event.payload, { event: "acp.message" });
            } catch (error) {
              logger.warn("Failed to send ACP message", { error: (error as Error).message });
            }
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
    logger.error("Error streaming ACP messages:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
