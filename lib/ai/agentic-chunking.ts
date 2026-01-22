/**
 * Agentic Chunking
 * 
 * Context-aware chunking for better retrieval using
 * agent-based decision making.
 */

import { SemanticChunking, Chunk } from "./semantic-chunking";

export interface ChunkingDecision {
  chunk: Chunk;
  reasoning: string;
  confidence: number;
  nextAction?: "merge" | "split" | "keep";
}

export class AgenticChunking {
  private semanticChunking: SemanticChunking;
  private openaiApiKey: string | null = null;

  constructor() {
    this.semanticChunking = new SemanticChunking();
    this.openaiApiKey = process.env.OPENAI_API_KEY || null;
  }

  /**
   * Chunk text with agentic decision-making
   */
  async chunk(
    text: string,
    query?: string,
    options?: {
      maxChunkSize?: number;
      minChunkSize?: number;
    }
  ): Promise<Chunk[]> {
    // Initial semantic chunking
    const initialChunks = this.semanticChunking.chunk(text, {
      strategy: "semantic",
      maxChunkSize: options?.maxChunkSize || 500,
      preserveContext: true,
    });

    // Agentic refinement
    const refinedChunks = await this.refineChunks(initialChunks, query, options);

    return refinedChunks;
  }

  /**
   * Refine chunks using agentic decisions
   */
  private async refineChunks(
    chunks: Chunk[],
    query?: string,
    options?: {
      maxChunkSize?: number;
      minChunkSize?: number;
    }
  ): Promise<Chunk[]> {
    const refined: Chunk[] = [];
    const maxSize = options?.maxChunkSize || 500;
    const minSize = options?.minChunkSize || 100;

    for (const chunk of chunks) {
      // Make decision about chunk
      const decision = await this.makeChunkingDecision(chunk, query);

      switch (decision.nextAction) {
        case "split":
          // Split chunk
          const split = this.splitChunk(chunk, maxSize);
          refined.push(...split);
          break;

        case "merge":
          // Try to merge with previous
          if (refined.length > 0) {
            const last = refined[refined.length - 1];
            const merged = this.mergeChunks(last, chunk, maxSize);
            if (merged) {
              refined[refined.length - 1] = merged;
            } else {
              refined.push(chunk);
            }
          } else {
            refined.push(chunk);
          }
          break;

        case "keep":
        default:
          // Keep as is
          refined.push(chunk);
          break;
      }
    }

    // Filter chunks that are too small
    return refined.filter(c => c.text.length >= minSize);
  }

  /**
   * Make chunking decision
   */
  private async makeChunkingDecision(
    chunk: Chunk,
    query?: string
  ): Promise<ChunkingDecision> {
    // Simple heuristics (in production, use LLM agent)
    let nextAction: "merge" | "split" | "keep" = "keep";
    let reasoning = "Chunk size appropriate";

    if (chunk.text.length > 800) {
      nextAction = "split";
      reasoning = "Chunk too large, should be split";
    } else if (chunk.text.length < 100) {
      nextAction = "merge";
      reasoning = "Chunk too small, should be merged";
    }

    // Check relevance to query if provided
    if (query) {
      const relevance = this.calculateRelevance(chunk.text, query);
      if (relevance < 0.3 && chunk.text.length < 200) {
        nextAction = "merge";
        reasoning = "Low relevance chunk, merge with adjacent";
      }
    }

    return {
      chunk,
      reasoning,
      confidence: 0.7,
      nextAction,
    };
  }

  /**
   * Split chunk
   */
  private splitChunk(chunk: Chunk, maxSize: number): Chunk[] {
    const sentences = chunk.text.split(/[.!?]+/).filter(s => s.trim());
    const split: Chunk[] = [];
    let current = "";
    let startIndex = chunk.startIndex;

    for (const sentence of sentences) {
      const potential = current + (current ? " " : "") + sentence;

      if (potential.length > maxSize && current) {
        split.push({
          id: `${chunk.id}-split-${split.length}`,
          text: current.trim(),
          startIndex,
          endIndex: startIndex + current.length,
          metadata: chunk.metadata,
        });

        current = sentence;
        startIndex = startIndex + current.length;
      } else {
        current = potential;
      }
    }

    if (current) {
      split.push({
        id: `${chunk.id}-split-${split.length}`,
        text: current.trim(),
        startIndex,
        endIndex: startIndex + current.length,
        metadata: chunk.metadata,
      });
    }

    return split;
  }

  /**
   * Merge chunks
   */
  private mergeChunks(
    chunk1: Chunk,
    chunk2: Chunk,
    maxSize: number
  ): Chunk | null {
    const mergedText = chunk1.text + " " + chunk2.text;

    if (mergedText.length > maxSize) {
      return null; // Can't merge
    }

    return {
      id: `${chunk1.id}-merged`,
      text: mergedText,
      startIndex: chunk1.startIndex,
      endIndex: chunk2.endIndex,
      metadata: {
        ...chunk1.metadata,
        importance: (chunk1.metadata?.importance || 0.5) + (chunk2.metadata?.importance || 0.5),
      },
    };
  }

  /**
   * Calculate relevance
   */
  private calculateRelevance(text: string, query: string): number {
    const textWords = new Set(text.toLowerCase().split(/\s+/));
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const intersection = new Set([...queryWords].filter(w => textWords.has(w)));
    const union = new Set([...textWords, ...queryWords]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }
}
