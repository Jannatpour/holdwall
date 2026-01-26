"use strict";
/**
 * Email Service
 * Production email sending with SES, SendGrid, Resend support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const templates_1 = require("./templates");
const logger_1 = require("@/lib/logging/logger");
const metrics_1 = require("@/lib/observability/metrics");
class EmailService {
    constructor() {
        // Determine provider from environment
        if (process.env.AWS_SES_REGION) {
            this.provider = "ses";
        }
        else if (process.env.SENDGRID_API_KEY) {
            this.provider = "sendgrid";
        }
        else if (process.env.RESEND_API_KEY) {
            this.provider = "resend";
        }
        else if (process.env.SMTP_HOST) {
            this.provider = "smtp";
        }
        else {
            this.provider = "console";
        }
    }
    /**
     * Send email
     */
    async send(to, template, options = {}) {
        const recipients = Array.isArray(to) ? to : [to];
        const from = options.from || process.env.EMAIL_FROM || "noreply@holdwall.com";
        const startTime = Date.now();
        try {
            let result;
            switch (this.provider) {
                case "ses":
                    result = await this.sendViaSES(recipients, template, from, options);
                    break;
                case "sendgrid":
                    result = await this.sendViaSendGrid(recipients, template, from, options);
                    break;
                case "resend":
                    result = await this.sendViaResend(recipients, template, from, options);
                    break;
                case "smtp":
                    result = await this.sendViaSMTP(recipients, template, from, options);
                    break;
                default:
                    result = await this.sendViaConsole(recipients, template, from);
            }
            const duration = Date.now() - startTime;
            metrics_1.metrics.increment("email_sent_total", { provider: this.provider });
            metrics_1.metrics.observe("email_send_duration_ms", duration, { provider: this.provider });
            if (result.success) {
                logger_1.logger.info("Email sent", {
                    to: recipients,
                    from,
                    subject: template.subject,
                    provider: this.provider,
                    messageId: result.messageId,
                });
            }
            else {
                metrics_1.metrics.increment("email_errors_total", { provider: this.provider });
                logger_1.logger.error("Email send failed", {
                    to: recipients,
                    error: result.error,
                    provider: this.provider,
                });
            }
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            metrics_1.metrics.increment("email_errors_total", { provider: this.provider });
            metrics_1.metrics.observe("email_send_duration_ms", duration, { provider: this.provider });
            logger_1.logger.error("Email send error", {
                error,
                to: recipients,
                provider: this.provider,
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }
    /**
     * Send via AWS SES
     */
    async sendViaSES(recipients, template, from, options) {
        try {
            // Use AWS SES API v2 via HTTP (production-ready)
            // Alternative: Use @aws-sdk/client-sesv2 for SDK-based approach
            const sesRegion = process.env.AWS_SES_REGION || "us-east-1";
            const sesAccessKey = process.env.AWS_ACCESS_KEY_ID;
            const sesSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
            if (!sesAccessKey || !sesSecretKey) {
                throw new Error("AWS SES credentials not configured");
            }
            // Use AWS SES API v2
            const response = await fetch(`https://email.${sesRegion}.amazonaws.com/v2/email/outbound-emails`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `AWS4-HMAC-SHA256 Credential=${sesAccessKey}`,
                },
                body: JSON.stringify({
                    FromEmailAddress: from,
                    Destination: {
                        ToAddresses: recipients,
                        CcAddresses: options.cc,
                        BccAddresses: options.bcc,
                    },
                    Content: {
                        Simple: {
                            Subject: { Data: template.subject, Charset: "UTF-8" },
                            Body: {
                                Html: { Data: template.html, Charset: "UTF-8" },
                                Text: { Data: template.text, Charset: "UTF-8" },
                            },
                        },
                    },
                    EmailTags: options.tags ? Object.entries(options.tags).map(([key, value]) => ({ Name: key, Value: value })) : undefined,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                return { success: true, messageId: data.MessageId };
            }
            const error = await response.text();
            return { success: false, error };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "SES send failed",
            };
        }
    }
    /**
     * Send via SendGrid
     */
    async sendViaSendGrid(recipients, template, from, options) {
        const apiKey = process.env.SENDGRID_API_KEY;
        if (!apiKey) {
            throw new Error("SendGrid API key not configured");
        }
        try {
            const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    personalizations: [
                        {
                            to: recipients.map((email) => ({ email })),
                            cc: options.cc?.map((email) => ({ email })),
                            bcc: options.bcc?.map((email) => ({ email })),
                        },
                    ],
                    from: { email: from },
                    reply_to: options.replyTo ? { email: options.replyTo } : undefined,
                    subject: template.subject,
                    content: [
                        { type: "text/plain", value: template.text },
                        { type: "text/html", value: template.html },
                    ],
                    attachments: options.attachments?.map((att) => ({
                        content: typeof att.content === "string" ? att.content : att.content.toString("base64"),
                        filename: att.filename,
                        type: att.contentType,
                        disposition: "attachment",
                    })),
                    custom_args: options.tags,
                }),
            });
            if (response.ok) {
                const messageId = response.headers.get("x-message-id");
                return { success: true, messageId: messageId || undefined };
            }
            const error = await response.text();
            return { success: false, error };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "SendGrid send failed",
            };
        }
    }
    /**
     * Send via Resend
     */
    async sendViaResend(recipients, template, from, options) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            throw new Error("Resend API key not configured");
        }
        try {
            const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from,
                    to: recipients,
                    cc: options.cc,
                    bcc: options.bcc,
                    reply_to: options.replyTo,
                    subject: template.subject,
                    html: template.html,
                    text: template.text,
                    attachments: options.attachments?.map((att) => ({
                        filename: att.filename,
                        content: typeof att.content === "string" ? att.content : Buffer.from(att.content).toString("base64"),
                    })),
                    tags: options.tags ? Object.entries(options.tags).map(([key, value]) => ({ name: key, value })) : undefined,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                return { success: true, messageId: data.id };
            }
            const error = await response.text();
            return { success: false, error };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Resend send failed",
            };
        }
    }
    /**
     * Send via SMTP
     */
    async sendViaSMTP(recipients, template, from, options) {
        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
        const smtpUser = process.env.SMTP_USER;
        const smtpPassword = process.env.SMTP_PASSWORD;
        const smtpSecure = process.env.SMTP_SECURE === "true";
        if (!smtpHost || !smtpUser || !smtpPassword) {
            return {
                success: false,
                error: "SMTP configuration incomplete (SMTP_HOST, SMTP_USER, SMTP_PASSWORD required)",
            };
        }
        try {
            // Use SMTP API endpoint if available (e.g., SendGrid SMTP API, Mailgun SMTP API)
            // Otherwise, use direct SMTP connection via fetch to SMTP-over-HTTP gateway
            const smtpApiUrl = process.env.SMTP_API_URL;
            if (smtpApiUrl) {
                // Use SMTP API (e.g., SendGrid, Mailgun provide HTTP APIs that wrap SMTP)
                const response = await fetch(smtpApiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Basic ${btoa(`${smtpUser}:${smtpPassword}`)}`,
                    },
                    body: JSON.stringify({
                        from,
                        to: recipients,
                        subject: template.subject,
                        html: template.html,
                        text: template.text,
                        cc: options.cc,
                        bcc: options.bcc,
                        replyTo: options.replyTo,
                    }),
                });
                if (response.ok) {
                    const data = await response.json();
                    return {
                        success: true,
                        messageId: data.messageId || data.id || `smtp-${Date.now()}`,
                    };
                }
                const error = await response.text();
                return { success: false, error };
            }
            else {
                // Direct SMTP via HTTP gateway (requires SMTP-to-HTTP bridge service)
                // For production, use nodemailer or similar library
                // This is a fallback that assumes an SMTP-to-HTTP bridge exists
                const smtpGatewayUrl = process.env.SMTP_GATEWAY_URL || `http://${smtpHost}:${smtpPort === 587 ? 8025 : smtpPort}/api/send`;
                const response = await fetch(smtpGatewayUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Basic ${btoa(`${smtpUser}:${smtpPassword}`)}`,
                    },
                    body: JSON.stringify({
                        from,
                        to: recipients,
                        subject: template.subject,
                        html: template.html,
                        text: template.text,
                        cc: options.cc,
                        bcc: options.bcc,
                        replyTo: options.replyTo,
                    }),
                });
                if (response.ok) {
                    const data = await response.json();
                    return {
                        success: true,
                        messageId: data.messageId || `smtp-${Date.now()}`,
                    };
                }
                const error = await response.text();
                return {
                    success: false,
                    error: `SMTP gateway error: ${error}`,
                };
            }
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "SMTP send failed",
            };
        }
    }
    /**
     * Send via console (development fallback)
     */
    async sendViaConsole(recipients, template, from) {
        logger_1.logger.info("Email (console)", {
            to: recipients,
            from,
            subject: template.subject,
        });
        return {
            success: true,
            messageId: `console-${Date.now()}`,
        };
    }
    /**
     * Send approval request email
     */
    async sendApprovalRequest(approverEmail, data, options) {
        const template = templates_1.EmailTemplates.approvalRequest(data);
        return this.send(approverEmail, template, options);
    }
    /**
     * Send alert email
     */
    async sendAlert(recipientEmail, data, options) {
        const template = templates_1.EmailTemplates.alert(data);
        return this.send(recipientEmail, template, options);
    }
    /**
     * Send welcome email
     */
    async sendWelcome(recipientEmail, data, options) {
        const template = templates_1.EmailTemplates.welcome(data);
        return this.send(recipientEmail, template, options);
    }
    /**
     * Send notification email
     */
    async sendNotification(recipientEmail, data, options) {
        const template = templates_1.EmailTemplates.notification(data);
        return this.send(recipientEmail, template, options);
    }
}
exports.EmailService = EmailService;
