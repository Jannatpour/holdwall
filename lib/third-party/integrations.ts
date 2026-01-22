/**
 * Third-Party API Integration Framework
 * Standardized integration pattern
 */

export interface IntegrationConfig {
  api_key: string;
  base_url: string;
  timeout?: number;
  retries?: number;
}

export class ThirdPartyIntegration {
  constructor(private config: IntegrationConfig) {}

  /**
   * Make authenticated API request
   */
  async request(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = {}
  ): Promise<unknown> {
    const url = `${this.config.base_url}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.api_key}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }
}
