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
import { logger } from "@/lib/logging/logger";
import { getProtocolSecurity } from "@/lib/security/protocol-security";

export class HTTPACPTransport implements ACPTransport {
  constructor(private baseUrl: string) {}

  async send(envelope: ACPMessageEnvelope): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/acp/messages`, {
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
      const eventSource = new EventSource(`${this.baseUrl}/api/acp/messages/stream`);

      const onEnvelope = async (raw: string) => {
        try {
          const envelope: ACPMessageEnvelope = JSON.parse(raw);
          // Basic shape guard
          if (
            envelope &&
            typeof envelope === "object" &&
            typeof (envelope as any).message_id === "string" &&
            typeof (envelope as any).tenant_id === "string" &&
            typeof (envelope as any).actor_id === "string"
          ) {
            await handler(envelope);
          }
        } catch (error) {
          logger.warn("Failed to process ACP SSE message", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      };

      eventSource.addEventListener("acp.message", async (event: MessageEvent) => {
        await onEnvelope(event.data);
      });
      // Some environments may not send an explicit event name; accept default messages too.
      eventSource.onmessage = async (event) => {
        await onEnvelope(event.data);
      };

      eventSource.onerror = (error) => {
        logger.error("ACP SSE connection error", {
          error: error instanceof Error ? error.message : String(error),
        });
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
      const response = await fetch(`${this.baseUrl}/api/acp/messages/stream`, {
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
      let currentEvent: string | undefined;
      let currentData: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.slice("event:".length).trim();
            continue;
          }
          if (line.startsWith("data:")) {
            currentData.push(line.slice("data:".length).trimStart());
            continue;
          }
          // Blank line = dispatch SSE event
          if (line.trim() === "") {
            const data = currentData.join("\n").trim();
            const eventName = currentEvent;
            currentEvent = undefined;
            currentData = [];
            if (!data) continue;
            if (eventName && eventName !== "acp.message") {
              continue;
            }
            try {
              const envelope: ACPMessageEnvelope = JSON.parse(data);
              if (
                envelope &&
                typeof envelope === "object" &&
                typeof (envelope as any).message_id === "string" &&
                typeof (envelope as any).tenant_id === "string" &&
                typeof (envelope as any).actor_id === "string"
              ) {
                await handler(envelope);
              }
            } catch (error) {
              logger.warn("Failed to process ACP SSE frame", {
                error: error instanceof Error ? error.message : String(error),
              });
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
      tenant_id?: string;
      actor_id?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<string> {
    const message_id = crypto.randomUUID();
    const correlation_id = options?.correlation_id || crypto.randomUUID();
    const tenant_id = options?.tenant_id;
    const actor_id = options?.actor_id;

    if (!tenant_id || !actor_id) {
      throw new Error("ACPClient.send requires tenant_id and actor_id in options");
    }

    const envelope: ACPMessageEnvelope = {
      message_id,
      tenant_id,
      actor_id,
      type,
      timestamp: new Date().toISOString(),
      correlation_id,
      causation_id: options?.causation_id,
      schema_version: "1.0",
      payload,
      signatures: [],
      metadata: options?.metadata,
    };

    // Sign the envelope with the server/system signing identity for integrity.
    // Agents can additionally attach their own signatures at the payload layer if desired.
    try {
      const protocolSecurity = getProtocolSecurity();
      const signingInput =
        `${envelope.message_id}|${envelope.tenant_id}|${envelope.actor_id}|${envelope.type}|` +
        `${envelope.timestamp}|${envelope.correlation_id}|${envelope.causation_id || ""}|` +
        `${envelope.schema_version}|${JSON.stringify(envelope.payload)}`;
      const signature = await protocolSecurity.signMessage("system", signingInput);
      envelope.signatures = [
        {
          signer_id: "system",
          algorithm: "RSA-SHA256",
          signature,
          timestamp: new Date().toISOString(),
        },
      ];
    } catch (error) {
      logger.error("Failed to sign ACP envelope", {
        error: error instanceof Error ? error.message : String(error),
        message_id,
        tenant_id,
        actor_id,
      });
      throw error;
    }

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
