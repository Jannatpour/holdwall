/**
 * Production Event Store Implementation
 * Database-backed with streaming support
 */

import { DatabaseEventStore } from "./store-db";

// Export singleton instance
export const eventStore = new DatabaseEventStore();
