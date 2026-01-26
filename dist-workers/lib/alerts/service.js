"use strict";
/**
 * Alerts Service
 *
 * SNS/SES integration for notifications
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertsService = void 0;
const service_1 = require("@/lib/email/service");
const send_push_1 = require("@/lib/pwa/send-push");
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
class AlertsService {
    constructor(eventStore) {
        this.eventStore = eventStore;
        this.emailService = new service_1.EmailService();
    }
    async createAlert(tenant_id, type, severity, title, message, evidence_refs, recipients) {
        const alert_id = `alert-${Date.now()}`;
        const alert = {
            alert_id,
            tenant_id,
            type,
            severity,
            title,
            message,
            evidence_refs,
            recipients,
            status: "pending",
            created_at: new Date().toISOString(),
        };
        // In production, send via SNS/SES
        // For MVP, just emit event
        const event = {
            event_id: crypto.randomUUID(),
            tenant_id,
            actor_id: "alerts-service",
            type: "alert.created",
            occurred_at: new Date().toISOString(),
            correlation_id: alert_id, // Use alert_id as correlation_id for easier lookup
            schema_version: "1.0",
            evidence_refs,
            payload: {
                alert_id,
                type,
                severity,
                title,
                message,
                recipients,
            },
            signatures: [],
        };
        await this.eventStore.append(event);
        return alert_id;
    }
    async sendAlert(alert_id) {
        const alert = await this.getAlert(alert_id);
        if (!alert) {
            throw new Error(`Alert ${alert_id} not found`);
        }
        // Get user IDs for recipients
        const users = await client_1.db.user.findMany({
            where: {
                email: { in: alert.recipients },
                tenantId: alert.tenant_id,
            },
            select: { id: true, email: true },
        });
        // Send push notifications to subscribed users
        for (const user of users) {
            try {
                await send_push_1.pushService.sendToUser(user.id, {
                    title: alert.title,
                    body: alert.message,
                    icon: "/icon-192x192.png",
                    badge: "/badge-72x72.png",
                    data: {
                        alert_id,
                        type: alert.type,
                        severity: alert.severity,
                        url: `/alerts/${alert_id}`,
                    },
                });
            }
            catch (error) {
                logger_1.logger.warn("Failed to send push notification", {
                    userId: user.id,
                    error: error.message,
                });
            }
        }
        // Send email to all recipients
        for (const recipient of alert.recipients) {
            try {
                await this.emailService.sendAlert(recipient, {
                    type: alert.type,
                    severity: alert.severity,
                    title: alert.title,
                    message: alert.message,
                });
            }
            catch (error) {
                logger_1.logger.warn("Failed to send email alert", {
                    recipient,
                    error: error.message,
                });
            }
        }
        // Mark as sent
        await this.markAlertSent(alert_id);
        logger_1.logger.info("Alert sent", {
            alert_id,
            recipients: alert.recipients.length,
            push_sent: users.length,
        });
    }
    async getAlert(alert_id) {
        // Try to get from database (if Alert model exists)
        try {
            const alertRecord = await client_1.db.alert.findUnique({
                where: { id: alert_id },
            });
            if (alertRecord) {
                return {
                    alert_id: alertRecord.id,
                    tenant_id: alertRecord.tenantId,
                    type: alertRecord.type,
                    severity: alertRecord.severity,
                    title: alertRecord.title,
                    message: alertRecord.message,
                    evidence_refs: alertRecord.evidenceRefs?.map((ref) => ref.evidenceId) || [],
                    recipients: alertRecord.recipients || [],
                    status: alertRecord.status,
                    created_at: alertRecord.createdAt.toISOString(),
                    sent_at: alertRecord.sentAt?.toISOString(),
                };
            }
        }
        catch (error) {
            // Alert model may not exist yet, fall through to event store
        }
        // Fallback: get from event store
        // Try correlation_id first (now matches alert_id)
        let events = await this.eventStore.query({
            type: "alert.created",
            correlation_id: alert_id,
        });
        // If not found, search all events for payload.alert_id
        if (events.length === 0) {
            const allEvents = await this.eventStore.query({
                type: "alert.created",
            });
            events = allEvents.filter((e) => e.payload?.alert_id === alert_id);
        }
        if (events.length === 0) {
            return null;
        }
        const event = events[0];
        const payload = event.payload;
        return {
            alert_id,
            tenant_id: event.tenant_id,
            type: payload.type,
            severity: payload.severity,
            title: payload.title,
            message: payload.message || "",
            evidence_refs: event.evidence_refs,
            recipients: payload.recipients || [],
            status: "pending",
            created_at: event.occurred_at,
        };
    }
    async markAlertSent(alert_id) {
        try {
            await client_1.db.alert.update({
                where: { id: alert_id },
                data: {
                    status: "sent",
                    sentAt: new Date(),
                },
            });
        }
        catch (error) {
            // Alert model may not exist, just log
            logger_1.logger.debug("Could not update alert status in database", { alert_id });
        }
    }
}
exports.AlertsService = AlertsService;
