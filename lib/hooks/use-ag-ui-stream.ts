/**
 * AG-UI Streaming Hook
 * 
 * React hook for managing AG-UI conversation sessions with true token streaming.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { AGUIStreamEvent } from "@/lib/ag-ui/protocol";

export interface UseAGUIStreamOptions {
  agentId: string;
  onError?: (error: Error) => void;
  onSessionStart?: (sessionId: string) => void;
  onSessionEnd?: () => void;
}

export interface AGUIStreamState {
  sessionId: string | null;
  isConnected: boolean;
  isStreaming: boolean;
  messages: Array<{
    role: "user" | "agent";
    content: string;
    timestamp: Date;
    citations?: string[];
    metadata?: Record<string, unknown>;
  }>;
  currentDelta: string;
  error: Error | null;
}

export function useAGUIStream(options: UseAGUIStreamOptions) {
  const [state, setState] = useState<AGUIStreamState>({
    sessionId: null,
    isConnected: false,
    isStreaming: false,
    messages: [],
    currentDelta: "",
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentRunIdRef = useRef<string | null>(null);
  const accumulatedContentRef = useRef<string>("");

  /**
   * Start a new conversation session
   */
  const startSession = useCallback(async () => {
    try {
      const response = await fetch("/api/ag-ui/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          agentId: options.agentId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start session: ${response.statusText}`);
      }

      const data = await response.json();
      const sessionId = data.session?.sessionId;

      if (!sessionId) {
        throw new Error("No session ID returned");
      }

      setState((prev) => ({
        ...prev,
        sessionId,
        isConnected: true,
        error: null,
      }));

      options.onSessionStart?.(sessionId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState((prev) => ({ ...prev, error: err }));
      options.onError?.(err);
    }
  }, [options]);

  /**
   * Send a message with streaming
   */
  const sendMessage = useCallback(
    async (content: string, mode: "text" | "voice" | "multimodal" | "structured" = "text") => {
      if (!state.sessionId) {
        await startSession();
        // Wait a bit for session to be established
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!state.sessionId) {
        throw new Error("Session not available");
      }

      setState((prev) => ({
        ...prev,
        isStreaming: true,
        currentDelta: "",
        error: null,
      }));

      // Add user message immediately
      setState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "user",
            content,
            timestamp: new Date(),
          },
        ],
      }));

      accumulatedContentRef.current = "";

      // Create abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch("/api/ag-ui/sessions?stream=1", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            action: "input",
            sessionId: state.sessionId,
            input: {
              mode,
              content,
            },
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error("Response body is not readable");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              const eventType = line.slice(7).trim();
              continue;
            }

            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (!data) continue;

              try {
                const event: AGUIStreamEvent = JSON.parse(data);

                switch (event.type) {
                  case "RUN_STARTED":
                    currentRunIdRef.current = event.run_id;
                    break;

                  case "TEXT_MESSAGE_CONTENT":
                    if (event.payload?.delta) {
                      const delta = event.payload.delta as string;
                      accumulatedContentRef.current += delta;
                      setState((prev) => ({
                        ...prev,
                        currentDelta: accumulatedContentRef.current,
                      }));
                    }
                    break;

                  case "TOOL_CALL_START":
                    // Tool call started - could show loading indicator
                    break;

                  case "TOOL_CALL_END":
                    // Tool call completed
                    break;

                  case "RUN_FINISHED":
                    // Finalize the message
                    setState((prev) => ({
                      ...prev,
                      messages: [
                        ...prev.messages,
                        {
                          role: "agent",
                          content: accumulatedContentRef.current,
                          timestamp: new Date(),
                          citations: event.payload?.citations as string[] | undefined,
                          metadata: {
                            model: event.payload?.model,
                            tokens: event.payload?.tokens,
                            cost: event.payload?.cost,
                            latency: event.payload?.latency,
                          },
                        },
                      ],
                      currentDelta: "",
                      isStreaming: false,
                    }));
                    accumulatedContentRef.current = "";
                    break;

                  case "RUN_ERROR":
                    throw new Error(
                      (event.payload?.message as string) || "Stream error occurred"
                    );

                  case "HEARTBEAT":
                    // Keep connection alive
                    break;
                }
              } catch (parseError) {
                console.warn("Failed to parse SSE event:", parseError);
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // User cancelled
          return;
        }

        const err = error instanceof Error ? error : new Error(String(error));
        setState((prev) => ({
          ...prev,
          error: err,
          isStreaming: false,
          currentDelta: "",
        }));
        options.onError?.(err);
      }
    },
    [state.sessionId, startSession, options]
  );

  /**
   * Cancel current streaming request
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isStreaming: false,
      currentDelta: "",
    }));
    accumulatedContentRef.current = "";
  }, []);

  /**
   * End the session
   */
  const endSession = useCallback(async () => {
    if (!state.sessionId) return;

    try {
      await fetch("/api/ag-ui/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "end",
          sessionId: state.sessionId,
        }),
      });
    } catch (error) {
      console.warn("Failed to end session:", error);
    }

    setState({
      sessionId: null,
      isConnected: false,
      isStreaming: false,
      messages: [],
      currentDelta: "",
      error: null,
    });

    options.onSessionEnd?.();
  }, [state.sessionId, options]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      endSession();
    };
  }, [cancel, endSession]);

  return {
    ...state,
    startSession,
    sendMessage,
    cancel,
    endSession,
  };
}
