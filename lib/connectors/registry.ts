/**
 * Connector Registry
 * Manages available connector types and their executors
 */

import type { ConnectorExecutor } from "./base";
import { RSSConnector } from "./rss";
import { GitHubConnector } from "./github";
import { S3Connector } from "./s3";
import { WebhookConnector } from "./webhook";

export class ConnectorRegistry {
  private executors: Map<string, () => ConnectorExecutor> = new Map();

  constructor() {
    // Register built-in connectors
    this.register("rss", () => new RSSConnector());
    this.register("github", () => new GitHubConnector());
    this.register("s3", () => new S3Connector());
    this.register("webhook", () => new WebhookConnector());
  }

  /**
   * Register a connector executor factory
   */
  register(type: string, factory: () => ConnectorExecutor): void {
    this.executors.set(type, factory);
  }

  /**
   * Get connector executor for type
   */
  getExecutor(type: string, apiKey?: string): ConnectorExecutor | null {
    const factory = this.executors.get(type);
    if (!factory) {
      return null;
    }

    const executor = factory();
    
    // Inject API key for GitHub connector
    if (type === "github" && apiKey) {
      return new GitHubConnector(apiKey);
    }

    return executor;
  }

  /**
   * List available connector types
   */
  listTypes(): string[] {
    return Array.from(this.executors.keys());
  }
}

export const connectorRegistry = new ConnectorRegistry();
