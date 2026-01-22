/**
 * Base Connector Interface
 * All connectors implement this interface
 */

import type { Signal } from "@/lib/signals/ingestion";

export interface ConnectorConfig {
  [key: string]: unknown;
}

export interface ConnectorResult {
  signals: Signal[];
  cursor?: string; // Checkpoint for next sync
  metadata?: Record<string, unknown>;
}

export interface ConnectorExecutor {
  /**
   * Execute connector sync
   */
  sync(
    config: ConnectorConfig,
    cursor?: string
  ): Promise<ConnectorResult>;

  /**
   * Validate connector configuration
   */
  validate(config: ConnectorConfig): Promise<{ valid: boolean; error?: string }>;

  /**
   * Test connector connection
   */
  test(config: ConnectorConfig): Promise<{ success: boolean; error?: string }>;
}
