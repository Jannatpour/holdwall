/**
 * Server-Sent Events (SSE) Stream for Real-time Signal Updates
 * Production-ready SSE implementation for real-time signal streaming
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const eventStore = new DatabaseEventStore();

        // Send initial connection message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`)
        );

        // Heartbeat to keep intermediaries from closing the stream
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "heartbeat", timestamp: new Date().toISOString() })}\n\n`)
            );
          } catch {
            clearInterval(heartbeatInterval);
          }
        }, 30000);

        // Track if stream is closed
        let streamClosed = false;

        // Cleanup function
        const cleanup = () => {
          if (streamClosed) return;
          streamClosed = true;
          clearInterval(heartbeatInterval);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        };

        // Cleanup on abort
        request.signal.addEventListener("abort", cleanup);

        // Use event store streaming for real-time updates
        // Note: stream() runs indefinitely, so we handle it in a way that allows cleanup
        eventStore
          .stream(
            {
              tenant_id: tenantId,
              type: "signal.ingested",
            },
            async (event) => {
              if (streamClosed) return;
              try {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: "signal",
                    event_id: event.event_id,
                    evidence_id: event.evidence_refs[0],
                    timestamp: event.occurred_at,
                    payload: event.payload,
                  })}\n\n`)
                );
              } catch (error) {
                if (!streamClosed) {
                  logger.warn("Failed to send SSE event", { error: (error as Error).message });
                }
                cleanup();
              }
            },
            {
              signal: request.signal, // Pass abort signal for cancellation
            }
          )
          .catch((error) => {
            if (!streamClosed) {
              logger.error("SSE stream error", { error: (error as Error).message });
              try {
                controller.enqueue(
                  encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "Stream error" })}\n\n`)
                );
              } catch {
                // Stream already closed
              }
            }
            cleanup();
          });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return new Response("Unauthorized", { status: 401 });
    }

    logger.error("SSE stream setup error", { error: (error as Error).message });
    return new Response("Internal server error", { status: 500 });
  }
}
