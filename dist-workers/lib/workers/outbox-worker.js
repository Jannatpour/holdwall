"use strict";
/**
 * Outbox Worker
 * Processes event outbox and publishes to Kafka
 *
 * Production-ready worker with comprehensive error handling and logging
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxWorker = void 0;
exports.startOutboxWorker = startOutboxWorker;
const outbox_publisher_1 = require("@/lib/events/outbox-publisher");
const logger_1 = require("@/lib/logging/logger");
class OutboxWorker {
    constructor(intervalMs = 5000) {
        this.isRunning = false;
        this.intervalId = null;
        this.publisher = new outbox_publisher_1.EventOutboxPublisher();
        this.intervalMs = intervalMs;
    }
    /**
     * Start processing outbox
     */
    async start() {
        if (this.isRunning) {
            logger_1.logger.warn("Outbox worker already running");
            return;
        }
        try {
            this.isRunning = true;
            logger_1.logger.info("Starting outbox worker", {
                intervalMs: this.intervalMs,
            });
            await this.publisher.startBackgroundProcessing(this.intervalMs);
            logger_1.logger.info("Outbox worker started successfully");
        }
        catch (error) {
            this.isRunning = false;
            logger_1.logger.error("Failed to start outbox worker", {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }
    /**
     * Stop processing
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        try {
            logger_1.logger.info("Stopping outbox worker");
            this.isRunning = false;
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            // Stop background processing in publisher
            await this.publisher.stopBackgroundProcessing();
            logger_1.logger.info("Outbox worker stopped successfully");
        }
        catch (error) {
            logger_1.logger.error("Error stopping outbox worker", {
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
    async processOnce() {
        try {
            logger_1.logger.debug("Processing outbox once");
            const result = await this.publisher.processOutbox();
            logger_1.logger.info("Outbox processing completed", {
                published: result.published,
                failed: result.failed,
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error("Error processing outbox", {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            // Return failed result instead of throwing
            return { published: 0, failed: 1 };
        }
    }
}
exports.OutboxWorker = OutboxWorker;
/**
 * Convenience entrypoint for container/K8s execution.
 * Reads configuration from environment variables.
 */
async function startOutboxWorker() {
    const intervalMsRaw = process.env.OUTBOX_INTERVAL_MS || "5000";
    const intervalMs = Number.parseInt(intervalMsRaw, 10);
    const worker = new OutboxWorker(Number.isFinite(intervalMs) ? intervalMs : 5000);
    await worker.start();
}
