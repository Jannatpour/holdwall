/**
 * Push Notification Manager
 * Client-side utility for managing push notification subscriptions
 */

import { logger } from "@/lib/logging/logger";

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null;

  /**
   * Initialize push notification manager
   */
  async init(): Promise<void> {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      throw new Error("Service workers not supported");
    }

    if (!("PushManager" in window)) {
      throw new Error("Push notifications not supported");
    }

    // Get service worker registration
    this.registration = await navigator.serviceWorker.ready;
  }

  /**
   * Request push notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) {
      throw new Error("Notifications not supported");
    }

    return await Notification.requestPermission();
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<PushSubscriptionData | null> {
    if (!this.registration) {
      await this.init();
    }

    const permission = await this.requestPermission();
    if (permission !== "granted") {
      logger.warn("Push notification permission denied");
      return null;
    }

    try {
      const keyArray = this.urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""
      );
      const subscription = await this.registration!.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: new Uint8Array(keyArray.buffer as ArrayBuffer, keyArray.byteOffset, keyArray.byteLength),
      });

      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(
            subscription.getKey("p256dh") || new ArrayBuffer(0)
          ),
          auth: this.arrayBufferToBase64(
            subscription.getKey("auth") || new ArrayBuffer(0)
          ),
        },
      };

      // Send to server
      await this.sendSubscriptionToServer(subscriptionData);

      return subscriptionData;
    } catch (error) {
      logger.error("Push subscription failed", { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<void> {
    if (!this.registration) {
      await this.init();
    }

    try {
      const subscription = await this.registration!.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await this.removeSubscriptionFromServer(subscription.endpoint);
      }
    } catch (error) {
      logger.error("Push unsubscription failed", { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Check if user is subscribed
   */
  async isSubscribed(): Promise<boolean> {
    if (!this.registration) {
      await this.init();
    }

    const subscription = await this.registration!.pushManager.getSubscription();
    return subscription !== null;
  }

  /**
   * Send subscription to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscriptionData): Promise<void> {
    try {
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      if (!response.ok) {
        throw new Error(`Failed to save subscription: ${response.statusText}`);
      }
    } catch (error) {
      logger.error("Failed to send subscription to server", { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Remove subscription from server
   */
  private async removeSubscriptionFromServer(endpoint: string): Promise<void> {
    try {
      const response = await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });

      if (!response.ok) {
        throw new Error(`Failed to remove subscription: ${response.statusText}`);
      }
    } catch (error) {
      logger.error("Failed to remove subscription from server", { error: (error as Error).message });
    }
  }

  /**
   * Convert VAPID key from URL-safe base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

export const pushManager = new PushNotificationManager();
