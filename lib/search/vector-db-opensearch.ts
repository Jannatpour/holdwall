/**
 * OpenSearch Vector Database Integration
 * 
 * OpenSearch with k-NN search for enterprise deployments.
 */

export interface OpenSearchDocument {
  id: string;
  vector: number[];
  text?: string;
  metadata?: Record<string, unknown>;
}

export interface OpenSearchResult {
  id: string;
  score: number;
  text?: string;
  metadata?: Record<string, unknown>;
}

export class OpenSearchVectorDB {
  private url: string;
  private indexName: string;
  private auth?: { username: string; password: string };
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;

  constructor(
    url: string = process.env.OPENSEARCH_URL || "http://localhost:9200",
    indexName: string = process.env.OPENSEARCH_INDEX || "holdwall",
    auth?: { username: string; password: string },
    options?: {
      timeout?: number;
      maxRetries?: number;
      retryDelay?: number;
    }
  ) {
    this.url = url.replace(/\/$/, ""); // Remove trailing slash
    this.indexName = indexName;
    this.auth = auth || (process.env.OPENSEARCH_USERNAME && process.env.OPENSEARCH_PASSWORD
      ? {
          username: process.env.OPENSEARCH_USERNAME,
          password: process.env.OPENSEARCH_PASSWORD,
        }
      : undefined);
    this.timeout = options?.timeout || 30000; // 30 seconds
    this.maxRetries = options?.maxRetries || 3;
    this.retryDelay = options?.retryDelay || 1000; // 1 second
  }

  /**
   * Index document with retry logic
   */
  async index(doc: OpenSearchDocument): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (this.auth) {
          const credentials = Buffer.from(`${this.auth.username}:${this.auth.password}`).toString("base64");
          headers["Authorization"] = `Basic ${credentials}`;
        }

        const response = await fetch(
          `${this.url}/${this.indexName}/_doc/${doc.id}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify({
              text: doc.text,
              embedding: doc.vector,
              ...doc.metadata,
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenSearch API error (${response.status}): ${errorText}`);
        }

        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (error instanceof Error && error.message.includes("4") && !error.message.includes("429")) {
          throw lastError;
        }

        // Wait before retrying (exponential backoff for rate limits)
        if (attempt < this.maxRetries - 1) {
          const delay = error instanceof Error && error.message.includes("429")
            ? this.retryDelay * Math.pow(2, attempt + 1) // Exponential backoff for rate limits
            : this.retryDelay * (attempt + 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `OpenSearch index failed after ${this.maxRetries} attempts: ${lastError?.message || "Unknown error"}`
    );
  }

  /**
   * Search with retry logic
   */
  async search(
    queryVector: number[],
    options?: {
      size?: number;
      filter?: Record<string, unknown>;
    }
  ): Promise<OpenSearchResult[]> {
    const { size = 10, filter } = options || {};

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (this.auth) {
          const credentials = Buffer.from(`${this.auth.username}:${this.auth.password}`).toString("base64");
          headers["Authorization"] = `Basic ${credentials}`;
        }

        const response = await fetch(
          `${this.url}/${this.indexName}/_search`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              size,
              query: {
                knn: {
                  embedding: {
                    vector: queryVector,
                    k: size,
                  },
                  ...(filter ? { filter } : {}),
                },
              },
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenSearch API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        return (data.hits?.hits || []).map((hit: any) => ({
          id: hit._id,
          score: hit._score,
          text: hit._source?.text,
          metadata: hit._source,
        }));
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (error instanceof Error && error.message.includes("4") && !error.message.includes("429")) {
          throw lastError;
        }

        // Wait before retrying (exponential backoff for rate limits)
        if (attempt < this.maxRetries - 1) {
          const delay = error instanceof Error && error.message.includes("429")
            ? this.retryDelay * Math.pow(2, attempt + 1) // Exponential backoff for rate limits
            : this.retryDelay * (attempt + 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `OpenSearch search failed after ${this.maxRetries} attempts: ${lastError?.message || "Unknown error"}`
    );
  }

  /**
   * Delete document with retry logic
   */
  async delete(id: string): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const headers: Record<string, string> = {};

        if (this.auth) {
          const credentials = Buffer.from(`${this.auth.username}:${this.auth.password}`).toString("base64");
          headers["Authorization"] = `Basic ${credentials}`;
        }

        const response = await fetch(
          `${this.url}/${this.indexName}/_doc/${id}`,
          {
            method: "DELETE",
            headers,
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenSearch API error (${response.status}): ${errorText}`);
        }

        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (error instanceof Error && error.message.includes("4") && !error.message.includes("429")) {
          throw lastError;
        }

        // Wait before retrying
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        }
      }
    }

    throw new Error(
      `OpenSearch delete failed after ${this.maxRetries} attempts: ${lastError?.message || "Unknown error"}`
    );
  }
}
