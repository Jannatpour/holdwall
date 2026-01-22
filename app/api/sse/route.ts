/**
 * Server-Sent Events (SSE) API
 * Real-time updates via SSE
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connection message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`)
        );

        // Send periodic heartbeat
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "heartbeat", timestamp: Date.now() })}\n\n`)
            );
          } catch (error) {
            clearInterval(heartbeatInterval);
          }
        }, 30000); // Every 30 seconds

        // Cleanup on close
        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeatInterval);
          controller.close();
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

    logger.error("SSE connection error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response("Internal server error", { status: 500 });
  }
}
