"use strict";
/**
 * Send Push Notification
 * Server-side utility for sending push notifications to subscribed users
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushService = exports.PushNotificationService = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
// Dynamic import for web-push (optional dependency)
// @ts-ignore - web-push types may not be available
let webpush = null;
async function getWebPush() {
    if (!webpush) {
        try {
            // @ts-ignore - web-push types may not be available
            webpush = await Promise.resolve().then(() => __importStar(require("web-push")));
        }
        catch (error) {
            throw new Error("web-push package not installed. Run: npm install web-push");
        }
    }
    return webpush;
}
// Initialize web-push with VAPID keys (async)
async function initializeWebPush() {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        const wp = await getWebPush();
        wp.default.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:notifications@holdwall.com", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    }
}
class PushNotificationService {
    /**
     * Send push notification to user
     */
    async sendToUser(userId, payload) {
        // Note: Requires PushSubscription model in Prisma schema
        const subscriptions = await client_1.db.pushSubscription.findMany({
            where: {
                userId,
                enabled: true,
            },
        });
        if (subscriptions.length === 0) {
            return { sent: 0, failed: 0 };
        }
        let sent = 0;
        let failed = 0;
        // Initialize web-push if not already done
        await initializeWebPush();
        const wp = await getWebPush();
        for (const subscription of subscriptions) {
            try {
                await wp.default.sendNotification({
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: subscription.p256dhKey,
                        auth: subscription.authKey,
                    },
                }, JSON.stringify({
                    title: payload.title,
                    body: payload.body,
                    icon: payload.icon || "/icon-192x192.png",
                    badge: payload.badge || "/badge-72x72.png",
                    data: {
                        url: payload.url || "/",
                        ...payload.data,
                    },
                }));
                sent++;
            }
            catch (error) {
                failed++;
                logger_1.logger.error("Push notification failed", {
                    userId,
                    endpoint: subscription.endpoint,
                    error: error.message,
                });
                // If subscription is invalid, disable it
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await client_1.db.pushSubscription.update({
                        where: { id: subscription.id },
                        data: { enabled: false },
                    });
                }
            }
        }
        return { sent, failed };
    }
    /**
     * Send push notification to tenant
     */
    async sendToTenant(tenantId, payload) {
        // Note: Requires PushSubscription model in Prisma schema
        const subscriptions = await client_1.db.pushSubscription.findMany({
            where: {
                tenantId,
                enabled: true,
            },
        });
        if (subscriptions.length === 0) {
            return { sent: 0, failed: 0 };
        }
        let sent = 0;
        let failed = 0;
        // Initialize web-push if not already done
        await initializeWebPush();
        const wp = await getWebPush();
        for (const subscription of subscriptions) {
            try {
                await wp.default.sendNotification({
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: subscription.p256dhKey,
                        auth: subscription.authKey,
                    },
                }, JSON.stringify({
                    title: payload.title,
                    body: payload.body,
                    icon: payload.icon || "/icon-192x192.png",
                    badge: payload.badge || "/badge-72x72.png",
                    data: {
                        url: payload.url || "/",
                        ...payload.data,
                    },
                }));
                sent++;
            }
            catch (error) {
                failed++;
                logger_1.logger.error("Push notification failed", {
                    tenantId,
                    endpoint: subscription.endpoint,
                    error: error.message,
                });
                // If subscription is invalid, disable it
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await client_1.db.pushSubscription.update({
                        where: { id: subscription.id },
                        data: { enabled: false },
                    });
                }
            }
        }
        return { sent, failed };
    }
}
exports.PushNotificationService = PushNotificationService;
// Note: web-push package is required for server-side push notifications
// Install with: npm install web-push
// VAPID keys can be generated with: npx web-push generate-vapid-keys
exports.pushService = new PushNotificationService();
