/**
 * Approximate Nearest Neighbor (ANN) Algorithms
 * 
 * Cosine Similarity, Euclidean Distance, Dot Product
 * for efficient similarity search.
 */

export interface ANNResult {
  id: string;
  distance: number;
  similarity: number;
}

export class ANNAlgorithms {
  /**
   * Cosine similarity
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error("Vectors must have same dimension");
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * Euclidean distance
   */
  euclideanDistance(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error("Vectors must have same dimension");
    }

    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      sum += Math.pow(vec1[i] - vec2[i], 2);
    }

    return Math.sqrt(sum);
  }

  /**
   * Dot product
   */
  dotProduct(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error("Vectors must have same dimension");
    }

    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      sum += vec1[i] * vec2[i];
    }

    return sum;
  }

  /**
   * Find nearest neighbors
   */
  findNearestNeighbors(
    queryVector: number[],
    candidates: Array<{ id: string; vector: number[] }>,
    metric: "cosine" | "euclidean" | "dot",
    topK: number = 10
  ): ANNResult[] {
    const results: ANNResult[] = [];

    for (const candidate of candidates) {
      let similarity: number;
      let distance: number;

      switch (metric) {
        case "cosine":
          similarity = this.cosineSimilarity(queryVector, candidate.vector);
          distance = 1 - similarity; // Convert to distance
          break;

        case "euclidean":
          distance = this.euclideanDistance(queryVector, candidate.vector);
          similarity = 1 / (1 + distance); // Convert to similarity
          break;

        case "dot":
          similarity = this.dotProduct(queryVector, candidate.vector);
          distance = -similarity; // For dot product, higher is better
          break;

        default:
          similarity = this.cosineSimilarity(queryVector, candidate.vector);
          distance = 1 - similarity;
      }

      results.push({
        id: candidate.id,
        distance,
        similarity,
      });
    }

    // Sort by similarity (descending) or distance (ascending)
    if (metric === "dot") {
      results.sort((a, b) => b.similarity - a.similarity);
    } else {
      results.sort((a, b) => a.distance - b.distance);
    }

    return results.slice(0, topK);
  }

  /**
   * Batch search
   */
  batchSearch(
    queryVectors: number[][],
    candidates: Array<{ id: string; vector: number[] }>,
    metric: "cosine" | "euclidean" | "dot",
    topK: number = 10
  ): ANNResult[][] {
    return queryVectors.map(queryVector =>
      this.findNearestNeighbors(queryVector, candidates, metric, topK)
    );
  }
}
