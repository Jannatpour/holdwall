"use strict";
/**
 * Alerting System
 *
 * Threshold-based alerts and anomaly detection
 * Supports escalation and notification channels
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.alerting = exports.AlertingSystem = void 0;
const metrics_1 = require("./metrics");
const logger_1 = require("@/lib/logging/logger");
const service_1 = require("@/lib/email/service");
const send_push_1 = require("@/lib/pwa/send-push");
class AlertingSystem {
    constructor() {
        this.rules = new Map();
        this.activeAlerts = new Map();
        this.alertHistory = [];
        this.alertRecipients = [];
        this.emailService = new service_1.EmailService();
        // Load alert recipients from environment
        if (process.env.ALERT_EMAIL_RECIPIENTS) {
            this.alertRecipients = process.env.ALERT_EMAIL_RECIPIENTS.split(",").map((e) => e.trim());
        }
    }
    /**
     * Add alert rule
     */
    addRule(rule) {
        this.rules.set(rule.id, rule);
    }
    /**
     * Remove alert rule
     */
    removeRule(ruleId) {
        this.rules.delete(ruleId);
        // Resolve any active alerts for this rule
        for (const [alertId, alert] of this.activeAlerts.entries()) {
            if (alert.rule_id === ruleId) {
                this.resolveAlert(alertId);
            }
        }
    }
    /**
     * Evaluate all rules against current metrics
     */
    async evaluateRules() {
        const summary = metrics_1.metrics.getSummary();
        const newAlerts = [];
        for (const rule of this.rules.values()) {
            const metricValue = this.getMetricValue(rule.metric, summary);
            if (metricValue === null) {
                continue; // Metric not found
            }
            const shouldAlert = this.evaluateThreshold(metricValue, rule.threshold.operator, rule.threshold.value);
            if (shouldAlert) {
                const existingAlert = Array.from(this.activeAlerts.values())
                    .find(a => a.rule_id === rule.id && a.status === "active");
                if (!existingAlert) {
                    // Create new alert
                    const alert = await this.createAlert(rule, metricValue);
                    newAlerts.push(alert);
                }
            }
            else {
                // Resolve alert if threshold no longer exceeded
                const existingAlert = Array.from(this.activeAlerts.values())
                    .find(a => a.rule_id === rule.id && a.status === "active");
                if (existingAlert) {
                    this.resolveAlert(existingAlert.id);
                }
            }
        }
        return newAlerts;
    }
    /**
     * Get metric value from summary
     */
    getMetricValue(metricName, summary) {
        // Check counters
        if (summary.counters[metricName] !== undefined) {
            return summary.counters[metricName];
        }
        // Check gauges
        if (summary.gauges[metricName] !== undefined) {
            return summary.gauges[metricName];
        }
        // Check histograms (return average)
        if (summary.histograms[metricName]) {
            return summary.histograms[metricName].avg;
        }
        return null;
    }
    /**
     * Evaluate threshold
     */
    evaluateThreshold(value, operator, threshold) {
        switch (operator) {
            case "gt":
                return value > threshold;
            case "lt":
                return value < threshold;
            case "eq":
                return value === threshold;
            case "gte":
                return value >= threshold;
            case "lte":
                return value <= threshold;
            default:
                return false;
        }
    }
    /**
     * Create alert
     */
    async createAlert(rule, value) {
        const alert = {
            id: `alert-${Date.now()}-${rule.id}`,
            rule_id: rule.id,
            metric: rule.metric,
            value,
            threshold: rule.threshold.value,
            severity: rule.severity,
            triggered_at: new Date().toISOString(),
            status: "active",
            tenantId: rule.tenantId,
        };
        this.activeAlerts.set(alert.id, alert);
        this.alertHistory.push(alert);
        // Log alert
        logger_1.logger.warn("Alert triggered", {
            alert_id: alert.id,
            rule_name: rule.name,
            metric: rule.metric,
            value,
            threshold: rule.threshold.value,
            severity: rule.severity,
        });
        // Send notifications (email, push, etc.)
        await this.sendNotifications(alert, rule);
        return alert;
    }
    /**
     * Resolve alert
     */
    resolveAlert(alertId) {
        const alert = this.activeAlerts.get(alertId);
        if (!alert) {
            return;
        }
        alert.status = "resolved";
        alert.resolved_at = new Date().toISOString();
        this.activeAlerts.delete(alertId);
        logger_1.logger.info("Alert resolved", {
            alert_id: alertId,
            metric: alert.metric,
            duration_ms: new Date(alert.resolved_at).getTime() - new Date(alert.triggered_at).getTime(),
        });
    }
    /**
     * Acknowledge alert
     */
    acknowledgeAlert(alertId) {
        const alert = this.activeAlerts.get(alertId);
        if (alert) {
            alert.status = "acknowledged";
        }
    }
    /**
     * Send notifications
     */
    async sendNotifications(alert, rule) {
        const channels = rule.channels || ["log"];
        for (const channel of channels) {
            try {
                switch (channel) {
                    case "log":
                        logger_1.logger.error(`[ALERT] ${rule.name}: ${alert.metric} = ${alert.value} (threshold: ${alert.threshold})`);
                        break;
                    case "email":
                        await this.sendEmailNotification(alert, rule);
                        break;
                    case "push":
                        await this.sendPushNotification(alert, rule);
                        break;
                    case "slack":
                        await this.sendSlackNotification(alert, rule);
                        break;
                    case "pagerduty":
                        await this.sendPagerDutyNotification(alert, rule);
                        break;
                }
            }
            catch (error) {
                logger_1.logger.error("Failed to send alert notification", {
                    channel,
                    alertId: alert.id,
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        }
    }
    /**
     * Send email notification
     */
    async sendEmailNotification(alert, rule) {
        const recipients = this.alertRecipients.length > 0 ? this.alertRecipients : [process.env.ALERT_EMAIL || "alerts@holdwall.com"];
        if (recipients.length === 0) {
            logger_1.logger.warn("No email recipients configured for alerts");
            return;
        }
        const severityEmoji = {
            critical: "🔴",
            warning: "⚠️",
            info: "ℹ️",
        };
        const subject = `${severityEmoji[alert.severity]} Alert: ${rule.name}`;
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${alert.severity === "critical" ? "#d32f2f" : alert.severity === "warning" ? "#f57c00" : "#1976d2"};">
          ${severityEmoji[alert.severity]} ${rule.name}
        </h2>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Metric:</strong> ${alert.metric}</p>
          <p><strong>Current Value:</strong> ${alert.value}</p>
          <p><strong>Threshold:</strong> ${rule.threshold.operator} ${alert.threshold}</p>
          <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
          <p><strong>Triggered At:</strong> ${new Date(alert.triggered_at).toLocaleString()}</p>
        </div>
        <p style="color: #666; font-size: 12px;">
          Alert ID: ${alert.id}<br>
          Rule ID: ${rule.id}
        </p>
      </div>
    `;
        const text = `
${rule.name}

Metric: ${alert.metric}
Current Value: ${alert.value}
Threshold: ${rule.threshold.operator} ${alert.threshold}
Severity: ${alert.severity.toUpperCase()}
Triggered At: ${new Date(alert.triggered_at).toLocaleString()}

Alert ID: ${alert.id}
Rule ID: ${rule.id}
    `.trim();
        const result = await this.emailService.send(recipients, { subject, html, text });
        if (result.success) {
            logger_1.logger.info("Alert email sent", {
                alertId: alert.id,
                recipients: recipients.length,
                messageId: result.messageId,
            });
        }
        else {
            logger_1.logger.error("Failed to send alert email", {
                alertId: alert.id,
                error: result.error,
            });
        }
    }
    /**
     * Send push notification
     */
    async sendPushNotification(alert, rule) {
        try {
            // Get tenant ID from rule or alert
            const tenantId = rule.tenantId || alert.tenantId;
            if (!tenantId) {
                logger_1.logger.warn("No tenant ID for push notification", {
                    alertId: alert.id,
                    ruleId: rule.id,
                });
                return;
            }
            const severityEmoji = {
                critical: "🔴",
                warning: "⚠️",
                info: "ℹ️",
            };
            const result = await send_push_1.pushService.sendToTenant(tenantId, {
                title: `${severityEmoji[alert.severity]} Alert: ${rule.name}`,
                body: `${alert.metric} = ${alert.value} (threshold: ${rule.threshold.operator} ${alert.threshold})`,
                icon: "/icon-192x192.png",
                badge: "/badge-72x72.png",
                data: {
                    alert_id: alert.id,
                    rule_id: rule.id,
                    metric: alert.metric,
                    value: alert.value,
                    severity: alert.severity,
                    url: `/alerts/${alert.id}`,
                },
            });
            if (result.sent > 0) {
                logger_1.logger.info("Push notification sent", {
                    alertId: alert.id,
                    sent: result.sent,
                    failed: result.failed,
                });
            }
        }
        catch (error) {
            logger_1.logger.error("Failed to send push notification", {
                alertId: alert.id,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    /**
     * Send Slack notification
     */
    async sendSlackNotification(alert, rule) {
        const webhookUrl = process.env.SLACK_WEBHOOK_URL;
        if (!webhookUrl) {
            logger_1.logger.warn("Slack webhook URL not configured");
            return;
        }
        const severityColor = {
            critical: "#d32f2f",
            warning: "#f57c00",
            info: "#1976d2",
        };
        const payload = {
            text: `Alert: ${rule.name}`,
            attachments: [
                {
                    color: severityColor[alert.severity],
                    title: rule.name,
                    fields: [
                        {
                            title: "Metric",
                            value: alert.metric,
                            short: true,
                        },
                        {
                            title: "Current Value",
                            value: alert.value.toString(),
                            short: true,
                        },
                        {
                            title: "Threshold",
                            value: `${rule.threshold.operator} ${alert.threshold}`,
                            short: true,
                        },
                        {
                            title: "Severity",
                            value: alert.severity.toUpperCase(),
                            short: true,
                        },
                        {
                            title: "Triggered At",
                            value: new Date(alert.triggered_at).toLocaleString(),
                            short: false,
                        },
                    ],
                    footer: `Alert ID: ${alert.id}`,
                    ts: Math.floor(new Date(alert.triggered_at).getTime() / 1000),
                },
            ],
        };
        try {
            const response = await fetch(webhookUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            if (response.ok) {
                logger_1.logger.info("Slack alert notification sent", { alertId: alert.id });
            }
            else {
                const errorText = await response.text();
                throw new Error(`Slack API error: ${response.status} ${errorText}`);
            }
        }
        catch (error) {
            logger_1.logger.error("Failed to send Slack notification", {
                alertId: alert.id,
                error: error instanceof Error ? error.message : "Unknown error",
            });
            throw error;
        }
    }
    /**
     * Send PagerDuty notification
     */
    async sendPagerDutyNotification(alert, rule) {
        const integrationKey = process.env.PAGERDUTY_INTEGRATION_KEY;
        if (!integrationKey) {
            logger_1.logger.warn("PagerDuty integration key not configured");
            return;
        }
        const severityMap = {
            critical: "critical",
            warning: "warning",
            info: "info",
        };
        const payload = {
            routing_key: integrationKey,
            event_action: alert.severity === "critical" ? "trigger" : "acknowledge",
            dedup_key: alert.id,
            payload: {
                summary: `${rule.name}: ${alert.metric} = ${alert.value}`,
                severity: severityMap[alert.severity],
                source: "holdwall-alerting",
                custom_details: {
                    alert_id: alert.id,
                    rule_id: rule.id,
                    rule_name: rule.name,
                    metric: alert.metric,
                    value: alert.value,
                    threshold: `${rule.threshold.operator} ${alert.threshold}`,
                    triggered_at: alert.triggered_at,
                },
            },
        };
        try {
            const response = await fetch("https://events.pagerduty.com/v2/enqueue", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            if (response.ok) {
                const result = await response.json();
                logger_1.logger.info("PagerDuty alert notification sent", {
                    alertId: alert.id,
                    status: result.status,
                    dedupKey: result.dedup_key,
                });
            }
            else {
                const errorText = await response.text();
                throw new Error(`PagerDuty API error: ${response.status} ${errorText}`);
            }
        }
        catch (error) {
            logger_1.logger.error("Failed to send PagerDuty notification", {
                alertId: alert.id,
                error: error instanceof Error ? error.message : "Unknown error",
            });
            throw error;
        }
    }
    /**
     * Get active alerts
     */
    getActiveAlerts() {
        return Array.from(this.activeAlerts.values());
    }
    /**
     * Get alert history
     */
    getAlertHistory(limit = 100) {
        return this.alertHistory.slice(-limit);
    }
}
exports.AlertingSystem = AlertingSystem;
exports.alerting = new AlertingSystem();
// Default alert rules
exports.alerting.addRule({
    id: "high-error-rate",
    name: "High Error Rate",
    metric: "api_errors_total",
    threshold: { operator: "gt", value: 10 },
    severity: "critical",
    channels: ["log", "email"],
});
exports.alerting.addRule({
    id: "high-latency",
    name: "High Request Latency",
    metric: "request_duration_ms",
    threshold: { operator: "gt", value: 1000 }, // 1 second
    severity: "warning",
    channels: ["log"],
});
exports.alerting.addRule({
    id: "low-cache-hit-rate",
    name: "Low Cache Hit Rate",
    metric: "cache_hit_rate",
    threshold: { operator: "lt", value: 0.5 }, // 50%
    severity: "warning",
    channels: ["log"],
});
