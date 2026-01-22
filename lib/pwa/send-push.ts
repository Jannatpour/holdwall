/**
 * Send Push Notification
 * Server-side utility for sending push notifications to subscribed users
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

// Dynamic import for web-push (optional dependency)
// @ts-ignore - web-push types may not be available
let webpush: typeof import("web-push") | null = null;

async function getWebPush() {
  if (!webpush) {
    try {
      // @ts-ignore - web-push types may not be available
      webpush = await import("web-push");
    } catch (error) {
      throw new Error("web-push package not installed. Run: npm install web-push");
    }
  }
  return webpush;
}

// Initialize web-push with VAPID keys (async)
async function initializeWebPush() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    const wp = await getWebPush();
    wp.default.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:notifications@holdwall.com",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

export class PushNotificationService {
  /**
   * Send push notification to user
   */
  async sendToUser(
    userId: string,
    payload: PushNotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    // Note: Requires PushSubscription model in Prisma schema
    const subscriptions = await (db as any).pushSubscription.findMany({
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
        await wp.default.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dhKey,
              auth: subscription.authKey,
            },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || "/icon-192x192.png",
            badge: payload.badge || "/badge-72x72.png",
            data: {
              url: payload.url || "/",
              ...payload.data,
            },
          })
        );
        sent++;
      } catch (error) {
        failed++;
        logger.error("Push notification failed", {
          userId,
          endpoint: subscription.endpoint,
          error: (error as Error).message,
        });

        // If subscription is invalid, disable it
        if ((error as any).statusCode === 410 || (error as any).statusCode === 404) {
          await (db as any).pushSubscription.update({
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
  async sendToTenant(
    tenantId: string,
    payload: PushNotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    // Note: Requires PushSubscription model in Prisma schema
    const subscriptions = await (db as any).pushSubscription.findMany({
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
        await wp.default.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dhKey,
              auth: subscription.authKey,
            },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || "/icon-192x192.png",
            badge: payload.badge || "/badge-72x72.png",
            data: {
              url: payload.url || "/",
              ...payload.data,
            },
          })
        );
        sent++;
      } catch (error) {
        failed++;
        logger.error("Push notification failed", {
          tenantId,
          endpoint: subscription.endpoint,
          error: (error as Error).message,
        });

        // If subscription is invalid, disable it
        if ((error as any).statusCode === 410 || (error as any).statusCode === 404) {
          await (db as any).pushSubscription.update({
            where: { id: subscription.id },
            data: { enabled: false },
          });
        }
      }
    }

    return { sent, failed };
  }
}

// Note: web-push package is required for server-side push notifications
// Install with: npm install web-push
// VAPID keys can be generated with: npx web-push generate-vapid-keys

export const pushService = new PushNotificationService();
