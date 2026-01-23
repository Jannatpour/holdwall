/**
 * Case Webhooks Service
 * 
 * Handles inbound and outbound webhooks for case events.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { DatabaseEventStore } from "@/lib/events/store-db";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import type { Case, CaseWebhook } from "@prisma/client";

const eventStore = new DatabaseEventStore();

export interface WebhookPayload {
  event: string;
  case: {
    id: string;
    caseNumber: string;
    type: string;
    status: string;
    severity: string;
    createdAt: string;
    updatedAt: string;
  };
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  response?: string;
  error?: string;
  retryAfter?: number;
}

/**
 * Case Webhooks Service
 */
export class CaseWebhooksService {
  /**
   * Ensure an arbitrary payload is safe to store in a Prisma Json field.
   * Converts to a JSON-compatible value (no undefined, functions, bigint, or cycles).
   */
  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    try {
      return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
    } catch {
      return { error: "non_json_payload", value: String(value) } as Prisma.InputJsonValue;
    }
  }

  /**
   * Send outbound webhook for case event
   */
  async sendWebhook(
    tenantId: string,
    event: string,
    case_: Case,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    // Get enabled webhooks for tenant that subscribe to this event
    const webhooks = await db.caseWebhook.findMany({
      where: {
        tenantId,
        enabled: true,
        events: {
          has: event,
        },
      },
    });

    if (webhooks.length === 0) {
      return;
    }

    const payload: WebhookPayload = {
      event,
      case: {
        id: case_.id,
        caseNumber: case_.caseNumber,
        type: case_.type,
        status: case_.status,
        severity: case_.severity,
        createdAt: case_.createdAt.toISOString(),
        updatedAt: case_.updatedAt.toISOString(),
      },
      timestamp: new Date().toISOString(),
      metadata,
    };

    // Send to all matching webhooks
    const promises = webhooks.map((webhook) => this.deliverWebhook(webhook, payload));
    await Promise.allSettled(promises);

    logger.info("Case webhooks sent", {
      tenant_id: tenantId,
      case_id: case_.id,
      event,
      webhooks_sent: webhooks.length,
    });

    metrics.increment("case_webhooks_sent_total", {
      tenant_id: tenantId,
      event,
    });
  }

  /**
   * Deliver webhook to endpoint
   */
  private async deliverWebhook(
    webhook: CaseWebhook,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    const signature = this.signPayload(payload, webhook.secret || "");

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Holdwall-Event": payload.event,
          "X-Holdwall-Signature": signature,
          "X-Holdwall-Timestamp": payload.timestamp,
          "User-Agent": "Holdwall-Webhook/1.0",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const responseText = await response.text();

      if (response.ok) {
        logger.info("Webhook delivered successfully", {
          webhook_id: webhook.id,
          url: webhook.url,
          event: payload.event,
          status_code: response.status,
        });

        metrics.increment("case_webhooks_delivered_total", {
          webhook_id: webhook.id,
          status_code: response.status.toString(),
        });

        return {
          success: true,
          statusCode: response.status,
          response: responseText,
        };
      } else {
        logger.warn("Webhook delivery failed", {
          webhook_id: webhook.id,
          url: webhook.url,
          event: payload.event,
          status_code: response.status,
          response: responseText.substring(0, 200),
        });

        metrics.increment("case_webhooks_failed_total", {
          webhook_id: webhook.id,
          status_code: response.status.toString(),
        });

        // Determine retry strategy based on status code
        const retryAfter = this.getRetryAfter(response.status);

        return {
          success: false,
          statusCode: response.status,
          response: responseText,
          retryAfter,
        };
      }
    } catch (error) {
      logger.error("Webhook delivery error", {
        webhook_id: webhook.id,
        url: webhook.url,
        event: payload.event,
        error: error instanceof Error ? error.message : String(error),
      });

      metrics.increment("case_webhooks_errors_total", {
        webhook_id: webhook.id,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        retryAfter: 60, // Retry after 60 seconds for network errors
      };
    }
  }

  /**
   * Sign webhook payload
   */
  private signPayload(payload: WebhookPayload, secret: string): string {
    if (!secret) {
      return "";
    }

    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payloadString)
      .digest("hex");

    return `sha256=${signature}`;
  }

  /**
   * Verify webhook signature
   */
  verifySignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    if (!secret || !signature) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const providedSignature = signature.replace("sha256=", "");

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature)
    );
  }

  /**
   * Get retry delay based on HTTP status code
   */
  private getRetryAfter(statusCode: number): number | undefined {
    // 429 Too Many Requests - respect Retry-After header
    if (statusCode === 429) {
      return 300; // 5 minutes
    }

    // 5xx Server Errors - retry with exponential backoff
    if (statusCode >= 500) {
      return 60; // 1 minute
    }

    // 4xx Client Errors - don't retry (except 429)
    if (statusCode >= 400) {
      return undefined; // Don't retry
    }

    return undefined;
  }

  /**
   * Handle inbound webhook
   */
  async handleInboundWebhook(
    tenantId: string,
    source: string,
    event: string,
    payload: Record<string, unknown>,
    signature?: string,
    secret?: string
  ): Promise<{ success: boolean; caseId?: string; error?: string }> {
    try {
      // Verify signature if provided
      if (signature && secret) {
        const payloadString = JSON.stringify(payload);
        const isValid = this.verifySignature(payloadString, signature, secret);

        if (!isValid) {
          return {
            success: false,
            error: "Invalid webhook signature",
          };
        }
      }

      // Map webhook event to case action
      const result = await this.mapWebhookToCaseAction(tenantId, source, event, payload);

      // Emit event
      await eventStore.append({
        event_id: crypto.randomUUID(),
        tenant_id: tenantId,
        actor_id: "webhook",
        type: "case.webhook.received",
        occurred_at: new Date().toISOString(),
        correlation_id: result.caseId,
        schema_version: "1.0",
        evidence_refs: [],
        payload: {
          source,
          event,
          case_id: result.caseId,
        },
        signatures: [],
      });

      logger.info("Inbound webhook processed", {
        tenant_id: tenantId,
        source,
        event,
        case_id: result.caseId,
      });

      metrics.increment("case_webhooks_received_total", {
        tenant_id: tenantId,
        source,
        event,
      });

      return {
        success: true,
        caseId: result.caseId,
      };
    } catch (error) {
      logger.error("Failed to process inbound webhook", {
        tenant_id: tenantId,
        source,
        event,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Map webhook event to case action
   */
  private async mapWebhookToCaseAction(
    tenantId: string,
    source: string,
    event: string,
    payload: Record<string, unknown>
  ): Promise<{ caseId: string }> {
    // Common webhook patterns:
    // - Payment processors: transaction.dispute.created, transaction.refund.processed
    // - Support systems: ticket.created, ticket.updated
    // - Status pages: incident.created, incident.resolved

    const caseNumber = payload.caseNumber as string | undefined;
    const caseId = payload.caseId as string | undefined;
    const transactionId = payload.transactionId as string | undefined;
    const ticketId = payload.ticketId as string | undefined;

    // Try to find existing case
    let case_: Case | null = null;

    if (caseId) {
      case_ = await db.case.findFirst({
        where: { id: caseId, tenantId },
      });
    } else if (caseNumber) {
      case_ = await db.case.findUnique({
        where: { caseNumber },
      });
    } else if (transactionId) {
      // Find case by transaction ID in metadata
      case_ = await db.case.findFirst({
        where: {
          tenantId,
          metadata: {
            path: ["transactionId"],
            equals: transactionId,
          },
        },
      });
    } else if (ticketId) {
      // Find case by ticket ID in metadata
      case_ = await db.case.findFirst({
        where: {
          tenantId,
          metadata: {
            path: ["ticketId"],
            equals: ticketId,
          },
        },
      });
    }

    // If case not found and this is a create event, create new case
    if (!case_ && (event.includes("created") || event.includes("new"))) {
      // Extract case details from payload
      const type = this.mapEventToCaseType(source, event);
      const description = (payload.description || payload.message || JSON.stringify(payload)) as string;
      const submittedBy = (payload.email || payload.customerEmail || payload.userEmail || "webhook") as string;
      const webhookPayload = this.toJsonValue(payload);

      case_ = await db.case.create({
        data: {
          tenantId,
          caseNumber: `CASE-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
          type,
          status: "SUBMITTED",
          severity: "MEDIUM",
          submittedBy,
          submittedByEmail: submittedBy.includes("@") ? submittedBy : undefined,
          description,
          metadata: {
            source,
            event,
            webhookPayload,
          } as Prisma.InputJsonValue,
        },
      });

      // Emit case created event
      await eventStore.append({
        event_id: crypto.randomUUID(),
        tenant_id: tenantId,
        actor_id: "webhook",
        type: "case.created",
        occurred_at: new Date().toISOString(),
        correlation_id: case_.id,
        schema_version: "1.0",
        evidence_refs: [],
        payload: {
          case_id: case_.id,
          case_number: case_.caseNumber,
          type,
          source: "webhook",
        },
        signatures: [],
      });
    } else if (case_) {
      // Update existing case based on event
      await this.updateCaseFromWebhook(case_, event, payload);
    } else {
      throw new Error("Case not found and cannot be created from webhook");
    }

    return { caseId: case_.id };
  }

  /**
   * Map webhook event to case type
   */
  private mapEventToCaseType(source: string, event: string): "DISPUTE" | "FRAUD_ATO" | "OUTAGE_DELAY" | "COMPLAINT" {
    const eventLower = event.toLowerCase();
    const sourceLower = source.toLowerCase();

    if (eventLower.includes("dispute") || eventLower.includes("chargeback")) {
      return "DISPUTE";
    }

    if (eventLower.includes("fraud") || eventLower.includes("ato") || eventLower.includes("unauthorized")) {
      return "FRAUD_ATO";
    }

    if (eventLower.includes("outage") || eventLower.includes("delay") || eventLower.includes("incident")) {
      return "OUTAGE_DELAY";
    }

    return "COMPLAINT";
  }

  /**
   * Update case from webhook event
   */
  private async updateCaseFromWebhook(
    case_: Case,
    event: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const updates: Prisma.CaseUpdateInput = {};

    // Update status based on event
    if (event.includes("resolved") || event.includes("closed")) {
      updates.status = "RESOLVED";
      updates.resolvedAt = new Date();
    } else if (event.includes("in_progress") || event.includes("processing")) {
      updates.status = "IN_PROGRESS";
    } else if (event.includes("triaged")) {
      updates.status = "TRIAGED";
    }

    // Update severity if provided
    if (payload.severity) {
      const severity = (payload.severity as string).toUpperCase();
      if (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(severity)) {
        updates.severity = severity as any;
      }
    }

    // Update metadata
    if (Object.keys(payload).length > 0) {
      const base =
        (case_.metadata && typeof case_.metadata === "object"
          ? (case_.metadata as Record<string, unknown>)
          : {}) ?? {};
      const lastWebhookPayload = this.toJsonValue(payload);

      updates.metadata = {
        ...base,
        lastWebhookEvent: event,
        lastWebhookPayload,
        lastWebhookUpdate: new Date().toISOString(),
      } as Prisma.InputJsonValue;
    }

    if (Object.keys(updates).length > 0) {
      await db.case.update({
        where: { id: case_.id },
        data: updates,
      });
    }
  }

  /**
   * Create webhook configuration
   */
  async createWebhook(
    tenantId: string,
    name: string,
    url: string,
    events: string[],
    secret?: string
  ): Promise<CaseWebhook> {
    const webhook = await db.caseWebhook.create({
      data: {
        tenantId,
        name,
        url,
        events,
        secret: secret || this.generateSecret(),
        enabled: true,
      },
    });

    logger.info("Webhook created", {
      tenant_id: tenantId,
      webhook_id: webhook.id,
      name,
      url,
    });

    return webhook;
  }

  /**
   * Generate webhook secret
   */
  private generateSecret(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(webhookId: string): Promise<WebhookDeliveryResult> {
    const webhook = await db.caseWebhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      throw new Error("Webhook not found");
    }

    const testPayload: WebhookPayload = {
      event: "test",
      case: {
        id: "test-case-id",
        caseNumber: "TEST-CASE-001",
        type: "COMPLAINT",
        status: "SUBMITTED",
        severity: "MEDIUM",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      metadata: {
        test: true,
      },
    };

    return await this.deliverWebhook(webhook, testPayload);
  }
}

export const caseWebhooksService = new CaseWebhooksService();
