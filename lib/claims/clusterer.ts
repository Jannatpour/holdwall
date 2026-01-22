/**
 * Claim Clusterer
 * 
 * Clustering algorithms for grouping similar claims together.
 * Supports hierarchical and DBSCAN clustering methods.
 */

import { VectorEmbeddings } from '@/lib/search/embeddings';

export interface ClusterResult {
  id: string;
  claims: string[];
  centroid?: number[];
}

export interface ClusterOptions {
  method?: 'hierarchical' | 'dbscan';
  similarityThreshold?: number;
  eps?: number;
  minPoints?: number;
}

export class ClaimClusterer {
  private embeddings: VectorEmbeddings;

  constructor() {
    this.embeddings = new VectorEmbeddings();
  }

  /**
   * Cluster claims using specified method
   */
  async cluster(
    claims: string[],
    options: ClusterOptions = {}
  ): Promise<ClusterResult[]> {
    if (claims.length === 0) {
      return [];
    }

    const method = options.method || 'hierarchical';

    if (method === 'hierarchical') {
      return this.hierarchicalCluster(claims, options);
    } else if (method === 'dbscan') {
      return this.dbscanCluster(claims, options);
    }

    throw new Error(`Unknown clustering method: ${method}`);
  }

  /**
   * Hierarchical clustering based on similarity threshold
   */
  private async hierarchicalCluster(
    claims: string[],
    options: ClusterOptions
  ): Promise<ClusterResult[]> {
    const threshold = options.similarityThreshold || 0.7;

    // Generate embeddings for all claims
    const claimEmbeddings = await Promise.all(
      claims.map(async (claim, index) => {
        const result = await this.embeddings.embed(claim);
        return {
          id: `claim-${index}`,
          text: claim,
          embedding: result.vector,
        };
      })
    );

    const clusters: ClusterResult[] = [];
    const used = new Set<number>();

    for (let i = 0; i < claimEmbeddings.length; i++) {
      if (used.has(i)) {
        continue;
      }

      const cluster: string[] = [claimEmbeddings[i].text];
      used.add(i);

      // Find similar claims
      for (let j = i + 1; j < claimEmbeddings.length; j++) {
        if (used.has(j)) {
          continue;
        }

        const similarity = this.cosineSimilarity(
          claimEmbeddings[i].embedding,
          claimEmbeddings[j].embedding
        );

        if (similarity >= threshold) {
          cluster.push(claimEmbeddings[j].text);
          used.add(j);
        }
      }

      // Calculate centroid
      const clusterEmbeddings = cluster.map((text, idx) => {
        const found = claimEmbeddings.find(ce => ce.text === text);
        return found?.embedding || [];
      }).filter(e => e.length > 0);

      const centroid = clusterEmbeddings.length > 0
        ? this.calculateCentroid(clusterEmbeddings)
        : undefined;

      clusters.push({
        id: `cluster-${clusters.length}`,
        claims: cluster,
        centroid,
      });
    }

    return clusters;
  }

  /**
   * DBSCAN clustering algorithm
   */
  private async dbscanCluster(
    claims: string[],
    options: ClusterOptions
  ): Promise<ClusterResult[]> {
    const eps = options.eps || 0.5;
    const minPoints = options.minPoints || 2;

    // Generate embeddings
    const claimEmbeddings = await Promise.all(
      claims.map(async (claim, index) => {
        const result = await this.embeddings.embed(claim);
        return {
          id: `claim-${index}`,
          text: claim,
          embedding: result.vector,
        };
      })
    );

    const visited = new Set<number>();
    const clustered = new Set<number>();
    const clusters: ClusterResult[] = [];
    let clusterId = 0;

    for (let i = 0; i < claimEmbeddings.length; i++) {
      if (visited.has(i)) {
        continue;
      }

      visited.add(i);

      // Find neighbors within eps distance
      const neighbors = this.findNeighbors(
        i,
        claimEmbeddings,
        eps
      );

      if (neighbors.length < minPoints) {
        // Noise point - skip
        continue;
      }

      // Create new cluster
      const cluster: string[] = [claimEmbeddings[i].text];
      clustered.add(i);

      // Expand cluster
      let seedSet = [...neighbors];
      while (seedSet.length > 0) {
        const neighborIdx = seedSet.shift()!;
        
        if (!visited.has(neighborIdx)) {
          visited.add(neighborIdx);
          const neighborNeighbors = this.findNeighbors(
            neighborIdx,
            claimEmbeddings,
            eps
          );
          if (neighborNeighbors.length >= minPoints) {
            seedSet.push(...neighborNeighbors);
          }
        }

        if (!clustered.has(neighborIdx)) {
          clustered.add(neighborIdx);
          cluster.push(claimEmbeddings[neighborIdx].text);
        }
      }

      // Calculate centroid
      const clusterEmbeddings = cluster.map(text => {
        const found = claimEmbeddings.find(ce => ce.text === text);
        return found?.embedding || [];
      }).filter(e => e.length > 0);

      const centroid = clusterEmbeddings.length > 0
        ? this.calculateCentroid(clusterEmbeddings)
        : undefined;

      clusters.push({
        id: `cluster-${clusterId++}`,
        claims: cluster,
        centroid,
      });
    }

    return clusters;
  }

  /**
   * Find neighbors within eps distance
   */
  private findNeighbors(
    pointIdx: number,
    allPoints: Array<{ embedding: number[] }>,
    eps: number
  ): number[] {
    const neighbors: number[] = [];
    const pointEmbedding = allPoints[pointIdx].embedding;

    for (let i = 0; i < allPoints.length; i++) {
      if (i === pointIdx) {
        continue;
      }

      const distance = this.euclideanDistance(
        pointEmbedding,
        allPoints[i].embedding
      );

      if (distance <= eps) {
        neighbors.push(i);
      }
    }

    return neighbors;
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0;
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
   * Calculate Euclidean distance
   */
  private euclideanDistance(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return Infinity;
    }

    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      sum += Math.pow(vec1[i] - vec2[i], 2);
    }

    return Math.sqrt(sum);
  }

  /**
   * Calculate centroid of embeddings
   */
  private calculateCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      return [];
    }

    const dimension = embeddings[0].length;
    const centroid = new Array(dimension).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        centroid[i] += embedding[i];
      }
    }

    for (let i = 0; i < dimension; i++) {
      centroid[i] /= embeddings.length;
    }

    return centroid;
  }
}
