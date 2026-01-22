/**
 * Outbox Worker
 * Processes event outbox and publishes to Kafka
 */

import { EventOutboxPublisher } from "@/lib/events/outbox-publisher";

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
      return;
    }

    this.isRunning = true;
    await this.publisher.startBackgroundProcessing(this.intervalMs);
  }

  /**
   * Stop processing
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Process outbox once (for manual triggers or cron)
   */
  async processOnce(): Promise<{ published: number; failed: number }> {
    return await this.publisher.processOutbox();
  }
}
