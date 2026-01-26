/**
 * Service Worker
 * PWA support with offline caching and background sync
 */

const CACHE_NAME = "holdwall-v1";
const RUNTIME_CACHE = "holdwall-runtime";
// Only cache truly static/public routes during install
// Protected routes will be cached on-demand during fetch events when authenticated
const STATIC_ASSETS = [
  "/offline",
  "/manifest.json",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/icon-192x192.png",
  "/icon-512x512.png",
];

// IMPORTANT:
// Do NOT cache HTML navigations (Next.js pages). Caching HTML can serve stale chunk references
// after a deploy, causing ChunkLoadError when the old chunk filenames no longer exist.

// Helper function to check if URL scheme is cacheable
function isCacheableScheme(url) {
  const scheme = url.protocol;
  // Only cache http and https URLs
  return scheme === "http:" || scheme === "https:";
}

// Helper to safely cache a URL with error handling
async function safeCacheUrl(cache, url) {
  try {
    const urlObj = new URL(url, self.location.origin);
    // Only cache http/https URLs
    if (!isCacheableScheme(urlObj)) {
      return { success: false, reason: "Unsupported URL scheme" };
    }
    
    // Use fetch + cache.put instead of cache.add to handle errors gracefully
    const response = await fetch(url, {
      method: "GET",
      credentials: "include", // Include cookies for authenticated routes
      cache: "no-store", // Always fetch fresh
    });
    
    // Only cache successful responses (200-299)
    if (response && response.ok && response.status >= 200 && response.status < 300) {
      // Clone response before caching (responses can only be read once)
      const clone = response.clone();
      await cache.put(url, clone);
      return { success: true };
    } else {
      return { 
        success: false, 
        reason: `Response not ok: ${response.status} ${response.statusText}` 
      };
    }
  } catch (err) {
    return { 
      success: false, 
      reason: err instanceof Error ? err.message : String(err) 
    };
  }
}

// Install event - cache only truly static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache only public/static assets during install
      const results = await Promise.allSettled(
        STATIC_ASSETS.map((url) => safeCacheUrl(cache, url))
      );
      
      // Log failures for debugging (but don't fail installation)
      results.forEach((result, index) => {
        if (result.status === "rejected" || (result.status === "fulfilled" && !result.value.success)) {
          const url = STATIC_ASSETS[index];
          const reason = result.status === "rejected" 
            ? result.reason 
            : result.value.reason;
          // Only log if it's not an expected auth failure
          if (!reason?.includes("401") && !reason?.includes("403")) {
            console.warn(`Failed to cache ${url}:`, reason);
          }
        }
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Clear runtime cache to drop any previously cached HTML/pages
      caches.delete(RUNTIME_CACHE).catch(() => {}),
      // Clean up unknown/old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => caches.delete(name))
        );
      }),
    ]).then(() => self.clients.claim())
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
  
  // Early exit for non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Never cache navigations / HTML documents (prevents stale chunk references after deploys)
  const acceptHeader = request.headers.get("accept") || "";
  const isNavigationRequest =
    request.mode === "navigate" ||
    request.destination === "document" ||
    acceptHeader.includes("text/html");
  if (isNavigationRequest) {
    event.respondWith(
      (async () => {
        try {
          // Always fetch fresh for navigations
          const response = await fetch(request, { cache: "no-store" });
          return response;
        } catch (error) {
          // Offline fallback
          const offlinePage = await caches.match("/offline");
          if (offlinePage) {
            return offlinePage;
          }
          return new Response("You are offline", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        }
      })()
    );
    return;
  }
  
  // Early exit for unsupported URL schemes - check request.url string directly
  const requestUrlString = request.url;
  if (!requestUrlString || 
      (!requestUrlString.startsWith('http://') && !requestUrlString.startsWith('https://'))) {
    // Skip chrome-extension://, chrome://, file://, data:, etc.
    return;
  }
  
  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    // Invalid URL, skip
    return;
  }

  // Double-check URL scheme
  if (!isCacheableScheme(url)) {
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

  // Cache-first strategy for static public assets only (icons/manifest/offline page)
  const isStaticAsset = STATIC_ASSETS.includes(url.pathname);
  
  if (isStaticAsset) {
    event.respondWith(
      (async () => {
        // Check cache first
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }
        
        // Not in cache, fetch from network
        try {
          const response = await fetch(request, {
            credentials: "include", // Include cookies for authenticated routes
          });
          
          // Only cache successful responses (200-299)
          if (response && response.ok && response.status >= 200 && response.status < 300 && isCacheableScheme(url)) {
            const requestUrl = new URL(request.url);
            if (isCacheableScheme(requestUrl)) {
              const requestUrlString = request.url;
              if (requestUrlString && (requestUrlString.startsWith('http://') || requestUrlString.startsWith('https://'))) {
                const clone = response.clone();
                caches.open(RUNTIME_CACHE).then((cache) => {
                  try {
                    if (requestUrlString.startsWith('http://') || requestUrlString.startsWith('https://')) {
                      cache.put(request, clone).catch((err) => {
                        // Silently ignore chrome-extension and other unsupported schemes
                        const errorMsg = err?.message || String(err);
                        if (!errorMsg.includes("chrome-extension") && !errorMsg.includes("unsupported")) {
                          // Only log unexpected errors for debugging
                        }
                      });
                    }
                  } catch (err) {
                    // Ignore errors for unsupported schemes
                    const errorMsg = err?.message || String(err);
                    if (!errorMsg.includes("chrome-extension") && !errorMsg.includes("unsupported")) {
                      // Only log unexpected errors
                    }
                  }
                }).catch(() => {
                  // Ignore cache open errors silently
                });
              }
            }
          }
          return response;
        } catch (err) {
          // Return cached version if available (fallback)
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }
          throw err;
        }
      })()
    );
    return;
  }

  // Network-first strategy for other pages
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        // Double-check both URL and request URL before caching
        const requestUrl = new URL(request.url);
        const responseContentType = response.headers.get("content-type") || "";
        const isHtmlResponse = responseContentType.includes("text/html");
        if (response && response.ok && isCacheableScheme(url) && isCacheableScheme(requestUrl) && !isHtmlResponse) {
          // Don't cache Next.js chunks or static assets
          const shouldCache = !(
            url.pathname.startsWith("/_next/") ||
            url.pathname.includes("turbopack") ||
            url.pathname.includes("/chunks/")
          );
          
          if (shouldCache) {
            // Validate request URL before attempting to cache
            const requestUrlString = request.url;
            if (requestUrlString && (requestUrlString.startsWith('http://') || requestUrlString.startsWith('https://'))) {
              const clone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                // Additional safety check before cache.put - validate request URL scheme
                try {
                  // Only attempt to cache if request URL is definitely http/https
                  if (requestUrlString.startsWith('http://') || requestUrlString.startsWith('https://')) {
                    cache.put(request, clone).catch((err) => {
                      // Silently ignore chrome-extension and other unsupported schemes
                      const errorMsg = err?.message || String(err);
                      if (!errorMsg.includes("chrome-extension") && !errorMsg.includes("unsupported")) {
                        console.warn(`Failed to cache ${url.pathname}:`, err);
                      }
                    });
                  }
                } catch (err) {
                  // Ignore errors for unsupported schemes
                  const errorMsg = err?.message || String(err);
                  if (!errorMsg.includes("chrome-extension") && !errorMsg.includes("unsupported")) {
                    console.warn(`Failed to cache ${url.pathname}:`, err);
                  }
                }
              }).catch((err) => {
                // Ignore cache open errors silently
              });
            }
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
