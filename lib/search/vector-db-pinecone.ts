/**
 * Pinecone Vector Database Integration
 * 
 * Cloud-scale vector database for production deployments.
 */

export interface VectorRecord {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

export interface QueryResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export class PineconeVectorDB {
  private apiKey: string | null = null;
  private indexName: string;
  private baseUrl: string = "https://api.pinecone.io";

  constructor(indexName: string = "holdwall") {
    this.indexName = indexName;
    this.apiKey = process.env.PINECONE_API_KEY || null;
  }

  /**
   * Upsert vectors
   */
  async upsert(vectors: VectorRecord[]): Promise<void> {
    if (!this.apiKey) {
      throw new Error("Pinecone API key not configured. Set PINECONE_API_KEY environment variable.");
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/vectors/upsert`,
        {
          method: "POST",
          headers: {
            "Api-Key": this.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vectors: vectors.map(v => ({
              id: v.id,
              values: v.values,
              metadata: v.metadata || {},
            })),
            namespace: this.indexName,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Pinecone API error: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(
        `Pinecone upsert failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Query vectors
   */
  async query(
    vector: number[],
    options?: {
      topK?: number;
      filter?: Record<string, unknown>;
      includeMetadata?: boolean;
    }
  ): Promise<QueryResult[]> {
    if (!this.apiKey) {
      throw new Error("Pinecone API key not configured");
    }

    const { topK = 10, filter, includeMetadata = true } = options || {};

    try {
      const response = await fetch(
        `${this.baseUrl}/query`,
        {
          method: "POST",
          headers: {
            "Api-Key": this.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vector,
            topK,
            filter,
            includeMetadata,
            namespace: this.indexName,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Pinecone API error: ${response.statusText}`);
      }

      const data = await response.json();
      return (data.matches || []).map((match: any) => ({
        id: match.id,
        score: match.score,
        metadata: includeMetadata ? match.metadata : undefined,
      }));
    } catch (error) {
      throw new Error(
        `Pinecone query failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Delete vectors
   */
  async delete(ids: string[]): Promise<void> {
    if (!this.apiKey) {
      throw new Error("Pinecone API key not configured");
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/vectors/delete`,
        {
          method: "POST",
          headers: {
            "Api-Key": this.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ids,
            namespace: this.indexName,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Pinecone API error: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(
        `Pinecone delete failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
