/**
 * usePushNotifications Hook
 * React hook for managing push notification subscriptions
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { pushManager } from "@/lib/pwa/push-manager";
import { logger } from "@/lib/logging/logger";

export interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  requestPermission: () => Promise<NotificationPermission>;
  loading: boolean;
  error: string | null;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check support
    const supported = 
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    
    setIsSupported(supported);

    if (supported) {
      // Check current permission
      setPermission(Notification.permission);

      // Check subscription status
      checkSubscriptionStatus();
    }
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      const subscribed = await pushManager.isSubscribed();
      setIsSubscribed(subscribed);
    } catch (error) {
      logger.error("Failed to check subscription status", { error: (error as Error).message });
    }
  };

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      throw new Error("Push notifications not supported");
    }

    setLoading(true);
    setError(null);

    try {
      const perm = await pushManager.requestPermission();
      setPermission(perm);
      return perm;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to request permission";
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<void> => {
    if (!isSupported) {
      throw new Error("Push notifications not supported");
    }

    setLoading(true);
    setError(null);

    try {
      await pushManager.subscribe();
      await checkSubscriptionStatus();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to subscribe";
      setError(errorMessage);
      logger.error("Push subscription failed", { error: errorMessage });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported) {
      throw new Error("Push notifications not supported");
    }

    setLoading(true);
    setError(null);

    try {
      await pushManager.unsubscribe();
      await checkSubscriptionStatus();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to unsubscribe";
      setError(errorMessage);
      logger.error("Push unsubscription failed", { error: errorMessage });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    requestPermission,
    loading,
    error,
  };
}
