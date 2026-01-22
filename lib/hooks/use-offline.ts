/**
 * useOffline Hook
 * React hook for detecting online/offline status and managing offline actions
 */

"use client";

import { useState, useEffect } from "react";
import { offlineStorage, type OfflineAction } from "@/lib/pwa/offline-storage";

export interface UseOfflineReturn {
  isOnline: boolean;
  isOffline: boolean;
  pendingActions: OfflineAction[];
  storeOfflineAction: (action: Omit<OfflineAction, "id" | "synced" | "retryCount" | "failed" | "createdAt">) => Promise<string>;
  retryPendingActions: () => Promise<void>;
}

export function useOffline(): UseOfflineReturn {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });
  const [pendingActions, setPendingActions] = useState<OfflineAction[]>([]);

  async function loadPendingActions() {
    try {
      const actions = await offlineStorage.getPendingActions();
      setPendingActions(actions);
    } catch (error) {
      console.error("Failed to load pending actions:", error);
    }
  }

  useEffect(() => {
    // Initialize offline storage
    offlineStorage.init().catch((error) => {
      console.error("Failed to initialize offline storage:", error);
    });

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Load pending actions asynchronously after mount
    void loadPendingActions();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const storeOfflineAction = async (
    action: Omit<OfflineAction, "id" | "synced" | "retryCount" | "failed" | "createdAt">
  ): Promise<string> => {
    try {
      const id = await offlineStorage.storeAction(action);
      await loadPendingActions(); // Refresh list
      return id;
    } catch (error) {
      console.error("Failed to store offline action:", error);
      throw error;
    }
  };

  const retryPendingActions = async (): Promise<void> => {
    if (!isOnline) {
      throw new Error("Cannot retry actions while offline");
    }

    try {
      const actions = await offlineStorage.getPendingActions();
      
      for (const action of actions) {
        try {
          const response = await fetch(action.url, {
            method: action.method || "POST",
            headers: action.headers,
            body: JSON.stringify(action.body),
          });

          if (response.ok) {
            await offlineStorage.markSynced(action.id);
          }
        } catch (error) {
          console.error(`Failed to retry action ${action.id}:`, error);
        }
      }

      await loadPendingActions(); // Refresh list
    } catch (error) {
      console.error("Failed to retry pending actions:", error);
      throw error;
    }
  };

  return {
    isOnline,
    isOffline: !isOnline,
    pendingActions,
    storeOfflineAction,
    retryPendingActions,
  };
}
