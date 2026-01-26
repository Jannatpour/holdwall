/**
 * Outbox Worker
 * Processes event outbox and publishes to Kafka
 * 
 * Production-ready worker with comprehensive error handling and logging
 */

import { EventOutboxPublisher } from "@/lib/events/outbox-publisher";
import { logger } from "@/lib/logging/logger";

export class OutboxWorker {
  private publisher: EventOutboxPublisher;
  private intervalMs: number;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(intervalMs: number = 5000) {
    this.publisher = new EventOutboxPublisher();
    this.intervalMs = intervalMs;
  }

  /**
   * Start processing outbox
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Outbox worker already running");
      return;
    }

    try {
      this.isRunning = true;
      logger.info("Starting outbox worker", {
        intervalMs: this.intervalMs,
      });
      await this.publisher.startBackgroundProcessing(this.intervalMs);
      logger.info("Outbox worker started successfully");
    } catch (error) {
      this.isRunning = false;
      logger.error("Failed to start outbox worker", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Stop processing
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info("Stopping outbox worker");
      this.isRunning = false;
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      // Stop background processing in publisher
      await this.publisher.stopBackgroundProcessing();
      logger.info("Outbox worker stopped successfully");
    } catch (error) {
      logger.error("Error stopping outbox worker", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Continue with stop even if there's an error
      this.isRunning = false;
    }
  }

  /**
   * Process outbox once (for manual triggers or cron)
   */
  async processOnce(): Promise<{ published: number; failed: number }> {
    try {
      logger.debug("Processing outbox once");
      const result = await this.publisher.processOutbox();
      logger.info("Outbox processing completed", {
        published: result.published,
        failed: result.failed,
      });
      return result;
    } catch (error) {
      logger.error("Error processing outbox", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return failed result instead of throwing
      return { published: 0, failed: 1 };
    }
  }
}

/**
 * Convenience entrypoint for container/K8s execution.
 * Reads configuration from environment variables.
 */
export async function startOutboxWorker(): Promise<void> {
  const intervalMsRaw = process.env.OUTBOX_INTERVAL_MS || "5000";
  const intervalMs = Number.parseInt(intervalMsRaw, 10);
  const worker = new OutboxWorker(Number.isFinite(intervalMs) ? intervalMs : 5000);
  await worker.start();
}
