/**
 * Service Worker Registration
 * Client-side component for automatic service worker registration
 */

"use client";

import { useEffect, useState } from "react";
import { logger } from "@/lib/logging/logger";

export function ServiceWorkerRegistration() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let mounted = true;
    let updateInterval: NodeJS.Timeout | null = null;

    async function registerServiceWorker() {
      try {
        // Check if already registered to prevent duplicates
        const existingRegistration = await navigator.serviceWorker.getRegistration();
        if (existingRegistration && existingRegistration.active) {
          if (mounted) {
            setRegistration(existingRegistration);
          }
          return;
        }

        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        if (!mounted) return;

        setRegistration(registration);

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New service worker available
                if (mounted) {
                  setUpdateAvailable(true);
                }
                logger.info("Service worker update available");
              }
            });
          }
        });

        // Listen for controller change (new service worker activated)
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          window.location.reload();
        });

        logger.info("Service worker registered", {
          scope: registration.scope,
          active: registration.active?.scriptURL,
        });

        // Periodic update check (every hour)
        updateInterval = setInterval(() => {
          if (mounted && registration) {
            registration.update();
          }
        }, 60 * 60 * 1000);
      } catch (error) {
        const errorDetails =
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : typeof error === "object" && error !== null
              ? error
              : { error };

        logger.error("Service worker registration failed", {
          ...errorDetails,
          swUrl: "/sw.js",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          isSecureContext: typeof window !== "undefined" ? window.isSecureContext : undefined,
        });
      }
    }

    registerServiceWorker();

    return () => {
      mounted = false;
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  }, []); // Empty deps - only run once

  // Handle update installation
  const handleUpdate = async () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 p-4 bg-background border rounded-lg shadow-lg max-w-sm">
      <p className="text-sm font-medium mb-2">Update Available</p>
      <p className="text-xs text-muted-foreground mb-3">
        A new version of the app is available. Click to update.
      </p>
      <button
        onClick={handleUpdate}
        className="w-full px-3 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90"
      >
        Update Now
      </button>
    </div>
  );
}
