"use strict";
/**
 * Production Event Store Implementation
 * Database-backed with streaming support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventStore = void 0;
const store_db_1 = require("./store-db");
// Export singleton instance
exports.eventStore = new store_db_1.DatabaseEventStore();
