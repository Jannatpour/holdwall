/**
 * Service Worker
 * PWA support with offline caching and background sync
 */

const CACHE_NAME = "holdwall-v1";
const RUNTIME_CACHE = "holdwall-runtime";
const STATIC_ASSETS = [
  "/",
  "/overview",
  "/signals",
  "/claims",
  "/graph",
  "/forecasts",
  "/studio",
  "/governance",
  "/offline",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache assets individually to handle failures gracefully
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`Failed to cache ${url}:`, err);
            return null;
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Listen for skip waiting message
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip API requests (they need to be fresh)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Skip Next.js chunks and static assets - always fetch from network
  // This prevents ChunkLoadError during development when chunks are updated
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/chunks/") ||
    url.pathname.includes("/_next/static/chunks/") ||
    url.pathname.includes("turbopack")
  ) {
    // Always fetch from network, never cache Next.js chunks
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first strategy for static assets
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first strategy for other pages
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          // Don't cache Next.js chunks or static assets
          const shouldCache = !(
            url.pathname.startsWith("/_next/") ||
            url.pathname.includes("turbopack") ||
            url.pathname.includes("/chunks/")
          );
          
          if (shouldCache) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
        }
        return response;
      } catch (error) {
        // Don't serve cached Next.js chunks - they might be stale
        const isNextJsAsset = 
          url.pathname.startsWith("/_next/") ||
          url.pathname.includes("turbopack") ||
          url.pathname.includes("/chunks/");
        
        if (isNextJsAsset) {
          // For Next.js assets, return error instead of stale cache
          throw error;
        }

        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }

        // Return offline page if available
        const offlinePage = await caches.match("/offline");
        if (offlinePage) {
          return offlinePage;
        }

        // Fallback: return a basic offline response
        return new Response("You are offline", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        });
      }
    })()
  );
});

// Background sync for offline actions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-claims") {
    event.waitUntil(syncClaims());
  }
});

async function syncClaims() {
  try {
    // Get pending offline actions from IndexedDB
    const db = await openOfflineActionsDB();
    const pendingActions = await getPendingActions(db);
    
    if (pendingActions.length === 0) {
      return;
    }

    // Sync each pending action
    for (const action of pendingActions) {
      try {
        const response = await fetch(action.url, {
          method: action.method || "POST",
          headers: {
            "Content-Type": "application/json",
            ...action.headers,
          },
          body: JSON.stringify(action.body),
        });

        if (response.ok) {
          // Mark as synced
          await markActionSynced(db, action.id);
        } else {
          // Keep for retry
          await incrementRetryCount(db, action.id);
        }
      } catch (error) {
        console.error(`Failed to sync action ${action.id}:`, error);
        await incrementRetryCount(db, action.id);
      }
    }
  } catch (error) {
    console.error("Background sync failed:", error);
  }
}

// IndexedDB helpers for offline actions
function openOfflineActionsDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("holdwall-offline-actions", 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("actions")) {
        const store = db.createObjectStore("actions", { keyPath: "id" });
        store.createIndex("synced", "synced");
        store.createIndex("retryCount", "retryCount");
      }
    };
  });
}

function getPendingActions(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["actions"], "readonly");
    const store = transaction.objectStore("actions");
    const index = store.index("synced");
    const request = index.getAll(false);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function markActionSynced(db, actionId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["actions"], "readwrite");
    const store = transaction.objectStore("actions");
    const getRequest = store.get(actionId);
    
    getRequest.onsuccess = () => {
      const action = getRequest.result;
      if (action) {
        action.synced = true;
        action.syncedAt = Date.now();
        const putRequest = store.put(action);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

function incrementRetryCount(db, actionId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["actions"], "readwrite");
    const store = transaction.objectStore("actions");
    const getRequest = store.get(actionId);
    
    getRequest.onsuccess = () => {
      const action = getRequest.result;
      if (action) {
        action.retryCount = (action.retryCount || 0) + 1;
        if (action.retryCount > 5) {
          // Too many retries, mark as failed
          action.failed = true;
        }
        const putRequest = store.put(action);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// Push notifications
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Holdwall Notification";
  const options = {
    body: data.body || "",
    icon: "/icon-192x192.png",
    badge: "/badge-72x72.png",
    data: data.url || "/",
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || "/")
  );
});
