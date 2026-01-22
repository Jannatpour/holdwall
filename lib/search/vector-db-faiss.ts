/**
 * FAISS Vector Database Integration
 * 
 * Facebook AI Similarity Search for local/in-memory deployments.
 */

export interface FAISSIndex {
  dimension: number;
  metric: "L2" | "inner_product" | "cosine";
}

export class FAISSVectorDB {
  private vectors: Map<string, number[]> = new Map();
  private dimension: number;
  private metric: "L2" | "inner_product" | "cosine";

  constructor(dimension: number = 1536, metric: "L2" | "inner_product" | "cosine" = "cosine") {
    this.dimension = dimension;
    this.metric = metric;
  }

  /**
   * Add vector
   */
  add(id: string, vector: number[]): void {
    if (vector.length !== this.dimension) {
      throw new Error(`Vector dimension ${vector.length} does not match index dimension ${this.dimension}`);
    }

    this.vectors.set(id, vector);
  }

  /**
   * Search similar vectors
   */
  search(
    queryVector: number[],
    topK: number = 10
  ): Array<{ id: string; score: number }> {
    if (queryVector.length !== this.dimension) {
      throw new Error(`Query vector dimension ${queryVector.length} does not match index dimension ${this.dimension}`);
    }

    const results: Array<{ id: string; score: number }> = [];

    for (const [id, vector] of this.vectors.entries()) {
      const score = this.calculateSimilarity(queryVector, vector);
      results.push({ id, score });
    }

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  /**
   * Calculate similarity
   */
  private calculateSimilarity(vec1: number[], vec2: number[]): number {
    switch (this.metric) {
      case "cosine":
        return this.cosineSimilarity(vec1, vec2);
      case "L2":
        return 1 / (1 + this.euclideanDistance(vec1, vec2));
      case "inner_product":
        return this.dotProduct(vec1, vec2);
      default:
        return this.cosineSimilarity(vec1, vec2);
    }
  }

  /**
   * Cosine similarity
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Euclidean distance
   */
  private euclideanDistance(vec1: number[], vec2: number[]): number {
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      sum += Math.pow(vec1[i] - vec2[i], 2);
    }
    return Math.sqrt(sum);
  }

  /**
   * Dot product
   */
  private dotProduct(vec1: number[], vec2: number[]): number {
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      sum += vec1[i] * vec2[i];
    }
    return sum;
  }

  /**
   * Remove vector
   */
  remove(id: string): void {
    this.vectors.delete(id);
  }

  /**
   * Get index size
   */
  size(): number {
    return this.vectors.size;
  }
}
