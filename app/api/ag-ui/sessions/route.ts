/**
 * AG-UI Conversation Session API
 */

import { NextRequest, NextResponse } from "next/server";
import { getAGUIProtocol } from "@/lib/ag-ui/protocol";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { SSESender } from "@/lib/streaming/events";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, agentId, sessionId, input } = body;

    const aguiProtocol = getAGUIProtocol();

    if (action === "start") {
      if (!agentId) {
        return NextResponse.json(
          { error: "Missing required field: agentId" },
          { status: 400 }
        );
      }

      const conversationSession = await aguiProtocol.startSession(
        (user as any).id,
        agentId
      );

      return NextResponse.json({
        success: true,
        session: conversationSession,
      });
    }

    if (action === "end") {
      if (!sessionId) {
        return NextResponse.json(
          { error: "Missing required field: sessionId" },
          { status: 400 }
        );
      }

      await aguiProtocol.endSession(sessionId);

      return NextResponse.json({
        success: true,
      });
    }

    if (action === "input") {
      if (!sessionId || !input) {
        return NextResponse.json(
          { error: "Missing required fields: sessionId, input" },
          { status: 400 }
        );
      }

      const isSse =
        (request.headers.get("accept") || "").includes("text/event-stream") ||
        request.nextUrl.searchParams.get("stream") === "1";

      const userInput = {
        inputId: crypto.randomUUID(),
        userId: (user as any).id,
        sessionId,
        mode: input.mode || "text",
        content: input.content,
        intent: input.intent,
        context: input.context,
        metadata: input.metadata,
      };

      if (isSse) {
        const sse = new SSESender();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (data: unknown, options?: { event?: string; retry?: number }) =>
              sse.send(controller, data, options);

            // Initial connected event
            send({ type: "connected", timestamp: new Date().toISOString() });

            const heartbeatInterval = setInterval(() => {
              try {
                send({ type: "HEARTBEAT", timestamp: new Date().toISOString() });
              } catch {
                clearInterval(heartbeatInterval);
              }
            }, 30000);

            request.signal.addEventListener(
              "abort",
              () => {
                clearInterval(heartbeatInterval);
                try {
                  controller.close();
                } catch {
                  // ignore
                }
              },
              { once: true }
            );

            try {
              await aguiProtocol.processInputStream({
                input: userInput,
                signal: request.signal,
                send: (event) => send(event, { event: "ag-ui" }),
              });
            } catch (error) {
              send(
                {
                  type: "RUN_ERROR",
                  timestamp: new Date().toISOString(),
                  error: error instanceof Error ? error.message : String(error),
                },
                { event: "error" }
              );
            } finally {
              clearInterval(heartbeatInterval);
              try {
                controller.close();
              } catch {
                // ignore
              }
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      }

      const output = await aguiProtocol.processInput(userInput);

      return NextResponse.json({
        success: true,
        output,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'start' or 'input'" },
      { status: 400 }
    );
  } catch (error) {
    logger.error("AG-UI session operation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Operation failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required parameter: sessionId" },
        { status: 400 }
      );
    }

    const aguiProtocol = getAGUIProtocol();
    const conversationSession = aguiProtocol.getSession(sessionId);

    if (!conversationSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      session: conversationSession,
    });
  } catch (error) {
    logger.error("AG-UI session retrieval failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Retrieval failed" },
      { status: 500 }
    );
  }
}
