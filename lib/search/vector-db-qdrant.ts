/**
 * Qdrant Vector Database Integration
 * 
 * Open-source vector database for self-hosted deployments.
 */

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface QdrantQueryResult {
  id: string;
  score: number;
  payload?: Record<string, unknown>;
}

export class QdrantVectorDB {
  private url: string;
  private collectionName: string;

  constructor(url: string = "http://localhost:6333", collectionName: string = "holdwall") {
    this.url = url;
    this.collectionName = collectionName;
  }

  /**
   * Upsert points
   */
  async upsert(points: QdrantPoint[]): Promise<void> {
    try {
      const response = await fetch(
        `${this.url}/collections/${this.collectionName}/points`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            points: points.map(p => ({
              id: p.id,
              vector: p.vector,
              payload: p.payload || {},
            })),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Qdrant API error: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(
        `Qdrant upsert failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Query points
   */
  async query(
    vector: number[],
    options?: {
      limit?: number;
      filter?: Record<string, unknown>;
      withPayload?: boolean;
    }
  ): Promise<QdrantQueryResult[]> {
    const { limit = 10, filter, withPayload = true } = options || {};

    try {
      const response = await fetch(
        `${this.url}/collections/${this.collectionName}/points/search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vector,
            limit,
            filter,
            with_payload: withPayload,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Qdrant API error: ${response.statusText}`);
      }

      const data = await response.json();
      return (data.result || []).map((result: any) => ({
        id: result.id.toString(),
        score: result.score,
        payload: withPayload ? result.payload : undefined,
      }));
    } catch (error) {
      throw new Error(
        `Qdrant query failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Delete points
   */
  async delete(ids: string[]): Promise<void> {
    try {
      const response = await fetch(
        `${this.url}/collections/${this.collectionName}/points/delete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            points: ids,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Qdrant API error: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(
        `Qdrant delete failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
