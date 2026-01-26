"use strict";
/**
 * Case Notifications Service
 *
 * Handles email, push, and SMS notifications for case events.
 * Integrates with existing email and push services.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.caseNotificationsService = exports.CaseNotificationsService = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
const metrics_1 = require("@/lib/observability/metrics");
const service_1 = require("@/lib/email/service");
const send_push_1 = require("@/lib/pwa/send-push");
const store_db_1 = require("@/lib/events/store-db");
const crypto_1 = __importDefault(require("crypto"));
const emailService = new service_1.EmailService();
const eventStore = new store_db_1.DatabaseEventStore();
/**
 * SMS Service
 * Supports Twilio, AWS SNS, or console logging
 */
class SMSService {
    constructor() {
        if (process.env.TWILIO_ACCOUNT_SID) {
            this.provider = "twilio";
        }
        else if (process.env.AWS_SNS_REGION) {
            this.provider = "aws-sns";
        }
        else {
            this.provider = "console";
        }
    }
    async send(to, message, options = {}) {
        const provider = options.provider || this.provider;
        const from = options.from || process.env.SMS_FROM || "Holdwall";
        try {
            switch (provider) {
                case "twilio":
                    return await this.sendViaTwilio(to, message, from);
                case "aws-sns":
                    return await this.sendViaSNS(to, message, from);
                default:
                    return await this.sendViaConsole(to, message, from);
            }
        }
        catch (error) {
            logger_1.logger.error("SMS send error", {
                to,
                provider,
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }
    async sendViaTwilio(to, message, from) {
        try {
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || from;
            if (!accountSid || !authToken) {
                throw new Error("Twilio credentials not configured");
            }
            // Dynamic import of twilio (optional dependency)
            let twilio;
            try {
                twilio = await Promise.resolve().then(() => __importStar(require("twilio")));
            }
            catch (importError) {
                throw new Error("Twilio package not installed. Install with: npm install twilio");
            }
            const client = twilio.default(accountSid, authToken);
            const result = await client.messages.create({
                body: message,
                from: twilioPhoneNumber,
                to,
            });
            metrics_1.metrics.increment("sms_sent_total", { provider: "twilio" });
            logger_1.logger.info("SMS sent via Twilio", {
                to,
                messageId: result.sid,
            });
            return {
                success: true,
                messageId: result.sid,
            };
        }
        catch (error) {
            metrics_1.metrics.increment("sms_errors_total", { provider: "twilio" });
            return {
                success: false,
                error: error instanceof Error ? error.message : "Twilio error",
            };
        }
    }
    async sendViaSNS(to, message, from) {
        try {
            const { SNSClient, PublishCommand } = await Promise.resolve().then(() => __importStar(require("@aws-sdk/client-sns")));
            const client = new SNSClient({
                region: process.env.AWS_SNS_REGION || "us-east-1",
            });
            const command = new PublishCommand({
                PhoneNumber: to,
                Message: message,
                MessageAttributes: {
                    "AWS.SNS.SMS.SenderID": {
                        DataType: "String",
                        StringValue: from,
                    },
                },
            });
            const result = await client.send(command);
            metrics_1.metrics.increment("sms_sent_total", { provider: "aws-sns" });
            logger_1.logger.info("SMS sent via AWS SNS", {
                to,
                messageId: result.MessageId,
            });
            return {
                success: true,
                messageId: result.MessageId,
            };
        }
        catch (error) {
            metrics_1.metrics.increment("sms_errors_total", { provider: "aws-sns" });
            return {
                success: false,
                error: error instanceof Error ? error.message : "AWS SNS error",
            };
        }
    }
    async sendViaConsole(to, message, from) {
        logger_1.logger.info("SMS (console)", {
            to,
            from,
            message,
        });
        return {
            success: true,
            messageId: `console-${Date.now()}`,
        };
    }
}
const smsService = new SMSService();
/**
 * Case Notifications Service
 */
class CaseNotificationsService {
    /**
     * Send notification for case event
     */
    async sendNotification(input) {
        const { caseId, recipient, type, subject, message, actionUrl, actionLabel, metadata } = input;
        // Create notification record
        const notification = await client_1.db.caseNotification.create({
            data: {
                caseId,
                recipient,
                type,
                status: "PENDING",
            },
        });
        try {
            let result = null;
            switch (type) {
                case "EMAIL":
                    result = await this.sendEmail(recipient, subject || "Case Update", message, actionUrl, actionLabel);
                    break;
                case "PUSH":
                    result = await this.sendPush(caseId, recipient, message, actionUrl);
                    break;
                case "SMS":
                    result = await this.sendSMS(recipient, message);
                    break;
            }
            // Update notification status
            const status = result && ("success" in result ? result.success : result.sent > 0)
                ? "SENT"
                : "FAILED";
            const updated = await client_1.db.caseNotification.update({
                where: { id: notification.id },
                data: {
                    status,
                    sentAt: status === "SENT" ? new Date() : null,
                    ...(result && "messageId" in result && result.messageId ? { metadata: { messageId: result.messageId, ...metadata } } : {}),
                },
            });
            // Emit event
            await eventStore.append({
                event_id: crypto_1.default.randomUUID(),
                tenant_id: (await client_1.db.case.findUnique({ where: { id: caseId }, select: { tenantId: true } }))?.tenantId || "",
                actor_id: "system",
                type: "case.notification.sent",
                occurred_at: new Date().toISOString(),
                correlation_id: caseId,
                schema_version: "1.0",
                evidence_refs: [],
                payload: {
                    notification_id: notification.id,
                    type,
                    recipient,
                    status,
                },
                signatures: [],
            });
            metrics_1.metrics.increment("case_notifications_sent_total", { type, status });
            return updated;
        }
        catch (error) {
            await client_1.db.caseNotification.update({
                where: { id: notification.id },
                data: {
                    status: "FAILED",
                },
            });
            logger_1.logger.error("Failed to send case notification", {
                case_id: caseId,
                recipient,
                type,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    /**
     * Send email notification
     */
    async sendEmail(recipient, subject, message, actionUrl, actionLabel) {
        const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
            <h2 style="margin-top: 0; color: #1976d2;">${subject}</h2>
            <p style="white-space: pre-wrap;">${message}</p>
            ${actionUrl ? `
              <div style="margin-top: 20px;">
                <a href="${actionUrl}" style="display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                  ${actionLabel || "View Details"}
                </a>
              </div>
            ` : ""}
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This is an automated notification from Holdwall Case Management System.
          </p>
        </body>
      </html>
    `;
        const text = `${subject}\n\n${message}${actionUrl ? `\n\n${actionLabel || "View Details"}: ${actionUrl}` : ""}`;
        return await emailService.send(recipient, { subject, html, text });
    }
    /**
     * Send push notification
     */
    async sendPush(caseId, recipient, message, actionUrl) {
        // Try to find user by email
        const user = await client_1.db.user.findFirst({
            where: { email: recipient },
            select: { id: true },
        });
        if (!user) {
            logger_1.logger.warn("User not found for push notification", { recipient });
            return { sent: 0, failed: 1 };
        }
        return await send_push_1.pushService.sendToUser(user.id, {
            title: "Case Update",
            body: message,
            url: actionUrl || `/cases/${caseId}`,
            icon: "/icon-192x192.png",
            badge: "/badge-72x72.png",
            data: {
                caseId,
                type: "case_update",
            },
        });
    }
    /**
     * Send SMS notification
     */
    async sendSMS(recipient, message) {
        // Truncate message to SMS limit (160 chars for standard, 1600 for concatenated)
        const truncatedMessage = message.length > 160 ? message.substring(0, 157) + "..." : message;
        return await smsService.send(recipient, truncatedMessage);
    }
    /**
     * Send case created notification
     */
    async sendCaseCreated(case_) {
        if (!case_.submittedByEmail) {
            return;
        }
        await this.sendNotification({
            caseId: case_.id,
            recipient: case_.submittedByEmail,
            type: "EMAIL",
            subject: `Case ${case_.caseNumber} Submitted`,
            message: `Your case ${case_.caseNumber} has been submitted successfully. Our team will review it and get back to you shortly.`,
            actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://holdwall.com"}/cases/track/${case_.caseNumber}`,
            actionLabel: "Track Your Case",
        });
    }
    /**
     * Send case triaged notification
     */
    async sendCaseTriaged(case_) {
        if (!case_.submittedByEmail) {
            return;
        }
        await this.sendNotification({
            caseId: case_.id,
            recipient: case_.submittedByEmail,
            type: "EMAIL",
            subject: `Case ${case_.caseNumber} Status Update`,
            message: `Your case ${case_.caseNumber} has been triaged and assigned a ${case_.severity} severity level. Status: ${case_.status}.`,
            actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://holdwall.com"}/cases/track/${case_.caseNumber}`,
            actionLabel: "View Case",
        });
    }
    /**
     * Send case status update notification
     */
    async sendStatusUpdate(case_, oldStatus, newStatus) {
        if (!case_.submittedByEmail) {
            return;
        }
        await this.sendNotification({
            caseId: case_.id,
            recipient: case_.submittedByEmail,
            type: "EMAIL",
            subject: `Case ${case_.caseNumber} Status Changed`,
            message: `Your case ${case_.caseNumber} status has been updated from ${oldStatus} to ${newStatus}.`,
            actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://holdwall.com"}/cases/track/${case_.caseNumber}`,
            actionLabel: "View Case",
        });
    }
    /**
     * Send resolution plan ready notification
     */
    async sendResolutionReady(case_) {
        if (!case_.submittedByEmail) {
            return;
        }
        await this.sendNotification({
            caseId: case_.id,
            recipient: case_.submittedByEmail,
            type: "EMAIL",
            subject: `Resolution Plan Ready for Case ${case_.caseNumber}`,
            message: `A resolution plan has been prepared for your case ${case_.caseNumber}. Please review the plan and follow the steps outlined.`,
            actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://holdwall.com"}/cases/track/${case_.caseNumber}`,
            actionLabel: "View Resolution Plan",
        });
    }
    /**
     * Send critical case notification (SMS + Email)
     */
    async sendCriticalCaseNotification(case_, message) {
        if (!case_.submittedByEmail) {
            return;
        }
        // Send both email and SMS for critical cases
        await Promise.all([
            this.sendNotification({
                caseId: case_.id,
                recipient: case_.submittedByEmail,
                type: "EMAIL",
                subject: `URGENT: Case ${case_.caseNumber} Update`,
                message,
                actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://holdwall.com"}/cases/track/${case_.caseNumber}`,
                actionLabel: "View Case",
            }),
            this.sendNotification({
                caseId: case_.id,
                recipient: case_.submittedByEmail,
                type: "SMS",
                message: `URGENT: ${message.substring(0, 140)}`,
            }),
        ]);
    }
    /**
     * Send internal team notification (push)
     */
    async sendInternalNotification(caseId, tenantId, message, assignedTo) {
        if (assignedTo) {
            const user = await client_1.db.user.findUnique({
                where: { id: assignedTo },
                select: { email: true },
            });
            if (user) {
                await this.sendNotification({
                    caseId,
                    recipient: user.email,
                    type: "PUSH",
                    message,
                    actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://holdwall.com"}/cases/${caseId}`,
                });
            }
        }
        else {
            // Send to all tenant users
            await send_push_1.pushService.sendToTenant(tenantId, {
                title: "New Case Update",
                body: message,
                url: `/cases/${caseId}`,
                icon: "/icon-192x192.png",
                badge: "/badge-72x72.png",
                data: {
                    caseId,
                    type: "case_update",
                },
            });
        }
    }
    /**
     * Mark notification as delivered
     */
    async markDelivered(notificationId) {
        await client_1.db.caseNotification.update({
            where: { id: notificationId },
            data: {
                status: "DELIVERED",
                deliveredAt: new Date(),
            },
        });
    }
    /**
     * Mark notification as opened
     */
    async markOpened(notificationId) {
        await client_1.db.caseNotification.update({
            where: { id: notificationId },
            data: {
                status: "OPENED",
                openedAt: new Date(),
            },
        });
    }
}
exports.CaseNotificationsService = CaseNotificationsService;
exports.caseNotificationsService = new CaseNotificationsService();
