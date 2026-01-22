/**
 * Offline Action Storage
 * Client-side utility for storing offline actions in IndexedDB
 */

export interface OfflineAction {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  synced: boolean;
  syncedAt?: number;
  retryCount: number;
  failed: boolean;
  createdAt: number;
}

const DB_NAME = "holdwall-offline-actions";
const DB_VERSION = 1;
const STORE_NAME = "actions";

export class OfflineActionStorage {
  private db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB
   */
  async init(): Promise<void> {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      throw new Error("IndexedDB not supported");
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("synced", "synced");
          store.createIndex("retryCount", "retryCount");
          store.createIndex("createdAt", "createdAt");
        }
      };
    });
  }

  /**
   * Store an offline action
   */
  async storeAction(action: Omit<OfflineAction, "id" | "synced" | "retryCount" | "failed" | "createdAt">): Promise<string> {
    if (!this.db) {
      await this.init();
    }

    const id = crypto.randomUUID();
    const offlineAction: OfflineAction = {
      id,
      ...action,
      synced: false,
      retryCount: 0,
      failed: false,
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(offlineAction);

      request.onsuccess = () => {
        // Request background sync
        if ("serviceWorker" in navigator && "sync" in (self as any).registration) {
          (self as any).registration.sync.register("sync-claims").catch(() => {
            // Background sync not supported, will retry on next service worker activation
          });
        }
        resolve(id);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get pending actions
   */
  async getPendingActions(): Promise<OfflineAction[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("synced");
      const request = index.openCursor(IDBKeyRange.only(false));
      const actions: OfflineAction[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          const action = cursor.value as OfflineAction;
          if (!action.failed) {
            actions.push(action);
          }
          cursor.continue();
        } else {
          resolve(actions);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Mark action as synced
   */
  async markSynced(actionId: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
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

  /**
   * Delete synced actions older than 7 days
   */
  async cleanupOldActions(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("createdAt");
      const request = index.openCursor(IDBKeyRange.upperBound(sevenDaysAgo));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const action = cursor.value as OfflineAction;
          if (action.synced) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const offlineStorage = new OfflineActionStorage();
