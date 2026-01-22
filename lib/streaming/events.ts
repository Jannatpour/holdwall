/**
 * Server-Sent Events (SSE)
 * Real-time event streaming
 */

export interface SSEOptions {
  retry?: number;
  event?: string;
}

export class SSESender {
  private encoder = new TextEncoder();

  /**
   * Send SSE message
   */
  send(
    stream: ReadableStreamDefaultController,
    data: unknown,
    options?: SSEOptions
  ): void {
    if (options?.event) {
      stream.enqueue(this.encoder.encode(`event: ${options.event}\n`));
    }

    if (options?.retry) {
      stream.enqueue(this.encoder.encode(`retry: ${options.retry}\n`));
    }

    stream.enqueue(
      this.encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
    );
  }

  /**
   * Create SSE response
   * Supports both short-lived and long-running streams
   */
  createStream(
    handler: (send: (data: unknown, options?: SSEOptions) => void) => Promise<void>,
    options?: {
      heartbeatInterval?: number; // ms, default 30000
      request?: Request; // For abort signal handling
    }
  ): Response {
    const sender = this;
    const heartbeatInterval = options?.heartbeatInterval || 30000;
    const stream = new ReadableStream({
      async start(controller) {
        let streamClosed = false;
        let heartbeatTimer: NodeJS.Timeout | null = null;

        const send = (data: unknown, options?: SSEOptions) => {
          if (streamClosed) return;
          try {
            sender.send(controller, data, options);
          } catch (error) {
            streamClosed = true;
            if (heartbeatTimer) clearInterval(heartbeatTimer);
          }
        };

        const cleanup = () => {
          if (streamClosed) return;
          streamClosed = true;
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        };

        // Setup heartbeat for long-running streams
        heartbeatTimer = setInterval(() => {
          if (!streamClosed) {
            try {
              send({ type: "heartbeat", timestamp: new Date().toISOString() });
            } catch {
              cleanup();
            }
          }
        }, heartbeatInterval);

        // Handle abort signal
        if (options?.request) {
          options.request.signal.addEventListener("abort", cleanup, { once: true });
        }

        try {
          await handler(send);
          // If handler completes (not a long-running stream), cleanup
          if (!streamClosed) {
            cleanup();
          }
        } catch (error) {
          if (!streamClosed) {
            try {
              controller.error(error);
            } catch {
              // Already closed
            }
            cleanup();
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
  }
}
