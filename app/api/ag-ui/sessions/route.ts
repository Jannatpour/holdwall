/**
 * AG-UI Conversation Session API
 */

import { NextRequest, NextResponse } from "next/server";
import { getAGUIProtocol, type UserIntent } from "@/lib/ag-ui/protocol";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { SSESender } from "@/lib/streaming/events";
import { z } from "zod";
import crypto from "crypto";

const aguiSessionRequestSchema = z.object({
  action: z.enum(["start", "end", "input"]),
  agentId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  input: z.object({
    mode: z.enum(["text", "voice", "multimodal"]).optional(),
    content: z.string().min(1),
    intent: z.enum(["question", "command", "clarification", "feedback", "correction", "navigation"]).optional(),
    context: z.record(z.string(), z.unknown()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
}).refine(
  (data) => {
    if (data.action === "start") return !!data.agentId;
    if (data.action === "end" || data.action === "input") return !!data.sessionId;
    if (data.action === "input") return !!data.input;
    return true;
  },
  {
    message: "Missing required fields for action",
  }
);

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = aguiSessionRequestSchema.parse(body);
    const { action, agentId, sessionId, input } = validated;

    const aguiProtocol = getAGUIProtocol();

    if (action === "start") {

      const conversationSession = await aguiProtocol.startSession(
        (user as any).id,
        agentId!
      );

      return NextResponse.json({
        success: true,
        session: conversationSession,
      });
    }

    if (action === "end") {
      await aguiProtocol.endSession(sessionId!);

      return NextResponse.json({
        success: true,
      });
    }

    if (action === "input") {

      const isSse =
        (request.headers.get("accept") || "").includes("text/event-stream") ||
        request.nextUrl.searchParams.get("stream") === "1";

      const userInput = {
        inputId: crypto.randomUUID(),
        userId: (user as any).id,
        sessionId: sessionId!,
        mode: (input!.mode || "text") as "text" | "voice" | "multimodal",
        content: input!.content,
        intent: input!.intent as UserIntent | undefined,
        context: input!.context,
        metadata: input!.metadata,
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
