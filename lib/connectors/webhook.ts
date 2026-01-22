/**
 * Webhook/Custom API Connector
 * Ingests signals from webhook endpoints or custom HTTP APIs
 */

import type { ConnectorExecutor, ConnectorConfig, ConnectorResult } from "./base";
import type { Signal } from "@/lib/signals/ingestion";

export class WebhookConnector implements ConnectorExecutor {
  async sync(
    config: ConnectorConfig,
    cursor?: string
  ): Promise<ConnectorResult> {
    const webhookUrl = config.url as string;
    if (!webhookUrl) {
      throw new Error("Webhook URL is required");
    }

    const tenantId = config.tenantId as string;
    if (!tenantId) {
      throw new Error("Tenant ID is required");
    }

    // Fetch from webhook endpoint
    const headers: Record<string, string> = {
      "User-Agent": "Holdwall-Webhook-Connector/1.0",
    };

    // Add authentication if provided
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey as string}`;
    } else if (config.basicAuth) {
      const auth = config.basicAuth as { username: string; password: string };
      const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
    }

    // Add custom headers
    if (config.headers) {
      Object.assign(headers, config.headers as Record<string, string>);
    }

    const response = await fetch(webhookUrl, {
      method: (config.method as string) || "GET",
      headers,
      body: config.body ? JSON.stringify(config.body) : undefined,
      signal: AbortSignal.timeout((config.timeout as number) || 30000),
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const signals: Signal[] = [];

    // Parse response based on format
    const format = (config.format as string) || "json";
    const items = this.extractItems(data, format, config.itemPath as string);

    for (const item of items) {
      signals.push({
        signal_id: crypto.randomUUID(),
        tenant_id: tenantId,
        source: {
          type: "webhook",
          id: (typeof item.id === 'string' ? item.id : (typeof item.url === 'string' ? item.url : crypto.randomUUID())),
          url: typeof item.url === 'string' ? item.url : undefined,
        },
        content: {
          raw: (typeof item.content === 'string' ? item.content : (typeof item.body === 'string' ? item.body : JSON.stringify(item))),
          normalized: this.normalizeContent(typeof item.content === 'string' ? item.content : (typeof item.body === 'string' ? item.body : JSON.stringify(item))),
        },
        metadata: {
          ...item,
          timestamp: (typeof item.timestamp === 'string' ? item.timestamp : (typeof item.created_at === 'string' ? item.created_at : new Date().toISOString())),
        },
        compliance: {
          source_allowed: true,
          collection_method: "api",
          retention_policy: config.retentionPolicy as string || "90 days",
        },
        created_at: new Date().toISOString(),
      });
    }

    return {
      signals,
      cursor: new Date().toISOString(),
      metadata: {
        url: webhookUrl,
        itemsProcessed: signals.length,
      },
    };
  }

  async validate(config: ConnectorConfig): Promise<{ valid: boolean; error?: string }> {
    if (!config.url) {
      return { valid: false, error: "Webhook URL is required" };
    }

    try {
      new URL(config.url as string);
    } catch {
      return { valid: false, error: "Invalid webhook URL" };
    }

    return { valid: true };
  }

  async test(config: ConnectorConfig): Promise<{ success: boolean; error?: string }> {
    const validation = await this.validate(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const headers: Record<string, string> = {
        "User-Agent": "Holdwall-Webhook-Connector/1.0",
      };

      if (config.apiKey) {
        headers["Authorization"] = `Bearer ${config.apiKey as string}`;
      }

      const response = await fetch(config.url as string, {
        method: "HEAD",
        headers,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok && response.status !== 405) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Extract items from response data
   */
  private extractItems(
    data: unknown,
    format: string,
    itemPath?: string
  ): Array<Record<string, unknown>> {
    if (format === "json") {
      if (itemPath) {
        // Navigate JSON path (e.g., "data.items")
        const parts = itemPath.split(".");
        let current: any = data;
        for (const part of parts) {
          current = current?.[part];
        }
        return Array.isArray(current) ? current : [];
      }

      // Default: assume data is an array or has a 'data' field
      if (Array.isArray(data)) {
        return data as Array<Record<string, unknown>>;
      }
      if (typeof data === "object" && data !== null && "data" in data) {
        const dataField = (data as any).data;
        return Array.isArray(dataField) ? dataField : [];
      }
      return [];
    }

    // Other formats (XML, CSV) would be parsed here
    return [];
  }

  /**
   * Normalize content
   */
  private normalizeContent(content: string): string {
    return content
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
}
