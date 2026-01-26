/**
 * Notification Service
 *
 * Unified notifications across channels (email, push, sms).
 * Keeps transport selection environment-driven and safe-by-default.
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { EmailService } from "@/lib/email/service";
import { PushNotificationService } from "@/lib/pwa/send-push";

export type NotificationChannel = "email" | "push" | "sms";

export interface SendNotificationInput {
  type: NotificationChannel;
  recipients: string[];
  subject?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export class NotificationService {
  private email = new EmailService();
  private push = new PushNotificationService();

  async send(input: SendNotificationInput): Promise<{ delivered: number; failed: number }> {
    const start = Date.now();
    const channel = input.type;
    const recipients = input.recipients || [];

    if (recipients.length === 0) {
      return { delivered: 0, failed: 0 };
    }

    try {
      let result: { delivered: number; failed: number };

      switch (channel) {
        case "email":
          result = await this.sendEmail(recipients, input.subject || "Notification", input.message);
          break;
        case "push":
          result = await this.sendPush(recipients, input.subject || "Notification", input.message, input.metadata);
          break;
        case "sms":
          result = await this.sendSms(recipients, input.message);
          break;
        default:
          result = { delivered: 0, failed: recipients.length };
      }

      metrics.increment("notifications_sent_total", { channel });
      metrics.observe("notifications_send_duration_ms", Date.now() - start, { channel });

      logger.info("Notification sent", {
        channel,
        delivered: result.delivered,
        failed: result.failed,
      });

      return result;
    } catch (error) {
      metrics.increment("notifications_errors_total", { channel });
      metrics.observe("notifications_send_duration_ms", Date.now() - start, { channel });

      logger.error("Notification send failed", {
        channel,
        error: error instanceof Error ? error.message : String(error),
      });

      return { delivered: 0, failed: recipients.length };
    }
  }

  private async sendEmail(to: string[], subject: string, message: string): Promise<{ delivered: number; failed: number }> {
    let delivered = 0;
    let failed = 0;

    const html = `<p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`;
    const text = message;

    for (const recipient of to) {
      const res = await this.email.send(recipient, { subject, html, text });
      if (res.success) delivered++;
      else failed++;
    }

    return { delivered, failed };
  }

  /**
   * `recipients` are userIds (not emails).
   */
  private async sendPush(
    userIds: string[],
    title: string,
    body: string,
    metadata?: Record<string, unknown>
  ): Promise<{ delivered: number; failed: number }> {
    let delivered = 0;
    let failed = 0;

    for (const userId of userIds) {
      const res = await this.push.sendToUser(userId, {
        title,
        body,
        url: typeof metadata?.url === "string" ? (metadata.url as string) : undefined,
        data: metadata,
      });
      delivered += res.sent;
      failed += res.failed;
    }

    return { delivered, failed };
  }

  private async sendSms(phoneNumbers: string[], message: string): Promise<{ delivered: number; failed: number }> {
    // Requires Twilio env vars; if not set, fail fast (no silent simulation).
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (!sid || !token || !from) {
      throw new Error("SMS requested but TWILIO_* environment variables are not configured");
    }

    // Dynamic import to avoid bundling issues in Next.js edge/server builds.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const twilio = (await import("twilio")).default as unknown as (
      accountSid: string,
      authToken: string
    ) => { messages: { create: (args: { to: string; from: string; body: string }) => Promise<unknown> } };

    const client = twilio(sid, token);

    let delivered = 0;
    let failed = 0;

    for (const to of phoneNumbers) {
      try {
        await client.messages.create({ to, from, body: message });
        delivered++;
      } catch (error) {
        failed++;
        logger.error("SMS send failed", {
          to,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { delivered, failed };
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

