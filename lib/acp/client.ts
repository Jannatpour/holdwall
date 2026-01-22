/**
 * ACP Client Implementation
 * 
 * Transport strategy: HTTP(S)/WebSocket for online; optional mesh fallback
 */

import type {
  ACPClient,
  ACPMessageEnvelope,
  ACPMessagePayload,
  ACPMessageType,
  ACPTransport,
} from "@/lib/acp/types";

export class HTTPACPTransport implements ACPTransport {
  constructor(private baseUrl: string) {}

  async send(envelope: ACPMessageEnvelope): Promise<void> {
    const response = await fetch(`${this.baseUrl}/acp/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
    });

    if (!response.ok) {
      throw new Error(`Failed to send ACP message: ${response.statusText}`);
    }
  }

  async receive(
    handler: (envelope: ACPMessageEnvelope) => Promise<void>
  ): Promise<void> {
    // Use Server-Sent Events for HTTP transport receive
    // For browser environments, use EventSource
    if (typeof window !== "undefined" && typeof EventSource !== "undefined") {
      const eventSource = new EventSource(`${this.baseUrl}/acp/messages/stream`);
      
      eventSource.onmessage = async (event) => {
        try {
          const envelope: ACPMessageEnvelope = JSON.parse(event.data);
          await handler(envelope);
        } catch (error) {
          console.error("Failed to process ACP message:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.error("SSE connection error:", error);
        eventSource.close();
      };

      // Keep connection alive
      return new Promise((resolve) => {
        eventSource.addEventListener("close", () => {
          resolve();
        });
      });
    } else {
      // For server-side, use fetch with streaming
      const response = await fetch(`${this.baseUrl}/acp/messages/stream`, {
        headers: {
          "Accept": "text/event-stream",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to connect to ACP stream: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Response body is not readable");
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const envelope: ACPMessageEnvelope = JSON.parse(line.slice(6));
              await handler(envelope);
            } catch (error) {
              console.error("Failed to process ACP message:", error);
            }
          }
        }
      }
    }
  }

  async close(): Promise<void> {
    // No-op for HTTP
  }
}

export class ACPClientImpl implements ACPClient {
  private handlers = new Map<ACPMessageType, Set<(envelope: ACPMessageEnvelope) => Promise<void>>>();
  private transport: ACPTransport;

  constructor(transport: ACPTransport) {
    this.transport = transport;
  }

  async send(
    type: ACPMessageType,
    payload: ACPMessagePayload,
    options?: {
      correlation_id?: string;
      causation_id?: string;
    }
  ): Promise<string> {
    const message_id = crypto.randomUUID();
    const correlation_id = options?.correlation_id || crypto.randomUUID();

    const envelope: ACPMessageEnvelope = {
      message_id,
      tenant_id: "default", // In production, get from context
      actor_id: "system", // In production, get from auth context
      type,
      timestamp: new Date().toISOString(),
      correlation_id,
      causation_id: options?.causation_id,
      schema_version: "1.0",
      payload,
      signatures: [], // In production, sign the message
    };

    await this.transport.send(envelope);
    return message_id;
  }

  on(
    type: ACPMessageType,
    handler: (envelope: ACPMessageEnvelope) => Promise<void>
  ): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  off(
    type: ACPMessageType,
    handler: (envelope: ACPMessageEnvelope) => Promise<void>
  ): void {
    this.handlers.get(type)?.delete(handler);
  }
}
