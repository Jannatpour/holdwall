"use strict";
/**
 * Email Templates
 * Notification email system with templating
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailTemplates = void 0;
class EmailTemplates {
    static approvalRequest(data) {
        return {
            subject: `Approval Request: ${data.resourceType}`,
            html: `
        <h2>Approval Request</h2>
        <p>${data.requesterName} has requested approval for ${data.resourceType} (${data.resourceId}).</p>
        <p><a href="${data.approvalUrl}">Review and Approve</a></p>
      `,
            text: `Approval Request: ${data.requesterName} has requested approval for ${data.resourceType} (${data.resourceId}). Review at ${data.approvalUrl}`,
        };
    }
    static alert(data) {
        return {
            subject: `[${data.severity.toUpperCase()}] ${data.title}`,
            html: `
        <h2>${data.title}</h2>
        <p><strong>Type:</strong> ${data.type}</p>
        <p><strong>Severity:</strong> ${data.severity}</p>
        <p>${data.message}</p>
        ${data.actionUrl ? `<p><a href="${data.actionUrl}">Take Action</a></p>` : ""}
      `,
            text: `${data.title}\n\nType: ${data.type}\nSeverity: ${data.severity}\n\n${data.message}${data.actionUrl ? `\n\nTake action: ${data.actionUrl}` : ""}`,
        };
    }
    static welcome(data) {
        return {
            subject: "Welcome to Holdwall POS",
            html: `
        <h2>Welcome to Holdwall POS</h2>
        <p>Hi ${data.userName},</p>
        <p>Welcome to Holdwall POS! Your account has been created.</p>
        <p><a href="${data.loginUrl}">Get Started</a></p>
        <p>If you have any questions, please don't hesitate to reach out.</p>
      `,
            text: `Welcome to Holdwall POS\n\nHi ${data.userName},\n\nWelcome to Holdwall POS! Your account has been created.\n\nGet started: ${data.loginUrl}\n\nIf you have any questions, please don't hesitate to reach out.`,
        };
    }
    static notification(data) {
        return {
            subject: data.title,
            html: `
        <h2>${data.title}</h2>
        <p>${data.message}</p>
        ${data.actionUrl ? `<p><a href="${data.actionUrl}">${data.actionLabel || "View Details"}</a></p>` : ""}
      `,
            text: `${data.title}\n\n${data.message}${data.actionUrl ? `\n\n${data.actionLabel || "View Details"}: ${data.actionUrl}` : ""}`,
        };
    }
}
exports.EmailTemplates = EmailTemplates;
