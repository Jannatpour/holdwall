/**
 * Vector Embeddings
 * Production embedding generation for RAG/KAG
 */

import { logger } from "@/lib/logging/logger";

export interface Embedding {
  vector: number[];
  model: string;
  dimensions: number;
}

export class EmbeddingService {
  private openaiApiKey: string | null = null;
  private cohereApiKey: string | null = null;
  private cache = new Map<string, Embedding>();

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || null;
    this.cohereApiKey = process.env.COHERE_API_KEY || null;
  }

  /**
   * Generate embedding for text
   */
  async embed(text: string, model: string = "text-embedding-3-small"): Promise<Embedding> {
    // Check cache first
    const cacheKey = `${model}:${text.substring(0, 100)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Try OpenAI first
    if (this.openaiApiKey && (model.startsWith("text-embedding") || model.startsWith("gpt"))) {
      try {
        const embedding = await this.embedWithOpenAI(text, model);
        this.cache.set(cacheKey, embedding);
        return embedding;
      } catch (error) {
        logger.warn("OpenAI embedding failed, trying fallback", {
          error: error instanceof Error ? error.message : String(error),
          model,
        });
      }
    }

    // Try Cohere
    if (this.cohereApiKey && model.startsWith("cohere")) {
      try {
        const embedding = await this.embedWithCohere(text, model);
        this.cache.set(cacheKey, embedding);
        return embedding;
      } catch (error) {
        logger.warn("Cohere embedding failed, trying fallback", {
          error: error instanceof Error ? error.message : String(error),
          model,
        });
      }
    }

    // Fallback to local embedding (development only). In production we must not return synthetic vectors.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Embedding providers unavailable (check OPENAI_API_KEY / VOYAGE_API_KEY / GOOGLE_API_KEY and billing/quota)."
      );
    }

    const embedding = this.embedLocal(text, model);
    this.cache.set(cacheKey, embedding);
    return embedding;
  }

  /**
   * Generate embedding using OpenAI API
   */
  private async embedWithOpenAI(text: string, model: string): Promise<Embedding> {
    if (!this.openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model === "text-embedding-3-small" ? "text-embedding-3-small" : "text-embedding-ada-002",
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`OpenAI embedding failed: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      vector: data.data[0].embedding,
      model: data.model,
      dimensions: data.data[0].embedding.length,
    };
  }

  /**
   * Generate embedding using Cohere API
   */
  private async embedWithCohere(text: string, model: string): Promise<Embedding> {
    if (!this.cohereApiKey) {
      throw new Error("Cohere API key not configured");
    }

    const response = await fetch("https://api.cohere.ai/v1/embed", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.cohereApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model === "cohere" ? "embed-english-v3.0" : model,
        texts: [text],
        input_type: "search_document",
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Cohere embedding failed: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      vector: data.embeddings[0],
      model: data.model || model,
      dimensions: data.embeddings[0].length,
    };
  }

  /**
   * Generate local embedding (fallback for development)
   */
  private embedLocal(text: string, model: string): Embedding {
    // Simple hash-based embedding for development
    const hash = this.simpleHash(text);
    const dimensions = model.includes("3-small") ? 1536 : 768;
    const vector = new Array(dimensions).fill(0).map((_, i) => {
      const seed = (hash + i) % 1000;
      return Math.sin(seed) * 0.5 + 0.5;
    });

    return {
      vector,
      model,
      dimensions,
    };
  }

  /**
   * Simple hash function for local embeddings
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Embeddings must have same dimensions");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find most similar embeddings
   */
  findSimilar(
    queryEmbedding: number[],
    candidateEmbeddings: Array<{ id: string; embedding: number[] }>,
    topK: number = 10
  ): Array<{ id: string; score: number }> {
    const scored = candidateEmbeddings.map((candidate) => ({
      id: candidate.id,
      score: this.cosineSimilarity(queryEmbedding, candidate.embedding),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
