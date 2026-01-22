/**
 * Semantic Chunking
 * 
 * Advanced chunking strategies preserving context better
 * than fixed-size methods.
 */

export interface Chunk {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  metadata?: {
    topic?: string;
    entities?: string[];
    importance?: number;
  };
}

export interface ChunkingOptions {
  strategy: "semantic" | "sentence" | "paragraph" | "topic";
  maxChunkSize?: number;
  overlap?: number;
  preserveContext?: boolean;
}

export class SemanticChunking {
  /**
   * Chunk text using semantic strategy
   */
  chunk(
    text: string,
    options: ChunkingOptions = { strategy: "semantic" }
  ): Chunk[] {
    switch (options.strategy) {
      case "semantic":
        return this.semanticChunk(text, options);
      case "sentence":
        return this.sentenceChunk(text, options);
      case "paragraph":
        return this.paragraphChunk(text, options);
      case "topic":
        return this.topicChunk(text, options);
      default:
        return this.semanticChunk(text, options);
    }
  }

  /**
   * Semantic chunking (preserves meaning)
   */
  private semanticChunk(
    text: string,
    options: ChunkingOptions
  ): Chunk[] {
    const maxSize = options.maxChunkSize || 500;
    const overlap = options.overlap || 50;

    const chunks: Chunk[] = [];
    const sentences = this.splitIntoSentences(text);

    let currentChunk = "";
    let startIndex = 0;
    let chunkId = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const potentialChunk = currentChunk + (currentChunk ? " " : "") + sentence;

      if (potentialChunk.length > maxSize && currentChunk) {
        // Save current chunk
        chunks.push({
          id: `chunk-${chunkId++}`,
          text: currentChunk.trim(),
          startIndex,
          endIndex: startIndex + currentChunk.length,
          metadata: {
            topic: this.extractTopic(currentChunk),
            importance: this.calculateImportance(currentChunk),
          },
        });

        // Start new chunk with overlap
        const overlapText = this.getOverlap(currentChunk, overlap);
        currentChunk = overlapText + " " + sentence;
        startIndex = startIndex + currentChunk.length - overlapText.length - sentence.length;
      } else {
        currentChunk = potentialChunk;
      }
    }

    // Add final chunk
    if (currentChunk) {
      chunks.push({
        id: `chunk-${chunkId++}`,
        text: currentChunk.trim(),
        startIndex,
        endIndex: startIndex + currentChunk.length,
        metadata: {
          topic: this.extractTopic(currentChunk),
          importance: this.calculateImportance(currentChunk),
        },
      });
    }

    return chunks;
  }

  /**
   * Sentence-based chunking
   */
  private sentenceChunk(
    text: string,
    options: ChunkingOptions
  ): Chunk[] {
    const sentences = this.splitIntoSentences(text);
    const maxSentences = Math.ceil((options.maxChunkSize || 500) / 50); // ~50 chars per sentence

    const chunks: Chunk[] = [];
    let startIndex = 0;

    for (let i = 0; i < sentences.length; i += maxSentences) {
      const chunkSentences = sentences.slice(i, i + maxSentences);
      const chunkText = chunkSentences.join(" ");

      chunks.push({
        id: `chunk-${i}`,
        text: chunkText,
        startIndex,
        endIndex: startIndex + chunkText.length,
      });

      startIndex += chunkText.length + 1;
    }

    return chunks;
  }

  /**
   * Paragraph-based chunking
   */
  private paragraphChunk(
    text: string,
    options: ChunkingOptions
  ): Chunk[] {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
    const chunks: Chunk[] = [];
    let startIndex = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();

      chunks.push({
        id: `chunk-${i}`,
        text: paragraph,
        startIndex,
        endIndex: startIndex + paragraph.length,
      });

      startIndex += paragraph.length + 2; // +2 for \n\n
    }

    return chunks;
  }

  /**
   * Topic-based chunking
   */
  private topicChunk(
    text: string,
    options: ChunkingOptions
  ): Chunk[] {
    // Split by topic shifts (simplified)
    const sentences = this.splitIntoSentences(text);
    const chunks: Chunk[] = [];
    let currentTopic = "";
    let currentChunk = "";
    let startIndex = 0;
    let chunkId = 0;

    for (const sentence of sentences) {
      const sentenceTopic = this.extractTopic(sentence);

      if (currentTopic && sentenceTopic !== currentTopic && currentChunk) {
        // Topic shift - save chunk
        chunks.push({
          id: `chunk-${chunkId++}`,
          text: currentChunk.trim(),
          startIndex,
          endIndex: startIndex + currentChunk.length,
          metadata: {
            topic: currentTopic,
          },
        });

        currentChunk = sentence;
        startIndex = startIndex + currentChunk.length;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }

      currentTopic = sentenceTopic;
    }

    // Add final chunk
    if (currentChunk) {
      chunks.push({
        id: `chunk-${chunkId++}`,
        text: currentChunk.trim(),
        startIndex,
        endIndex: startIndex + currentChunk.length,
        metadata: {
          topic: currentTopic,
        },
      });
    }

    return chunks;
  }

  /**
   * Split into sentences
   */
  private splitIntoSentences(text: string): string[] {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0).map(s => s.trim());
  }

  /**
   * Extract topic from text
   */
  private extractTopic(text: string): string {
    // Simple extraction (in production, use NLP)
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const frequencies = new Map<string, number>();

    for (const word of words) {
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    }

    const topWord = Array.from(frequencies.entries())
      .sort((a, b) => b[1] - a[1])[0];

    return topWord?.[0] || "general";
  }

  /**
   * Calculate importance
   */
  private calculateImportance(text: string): number {
    // Simple heuristics (in production, use ML)
    let importance = 0.5;

    // Keywords boost
    const importantKeywords = ["important", "critical", "key", "essential", "significant"];
    const lower = text.toLowerCase();
    importance += importantKeywords.filter(kw => lower.includes(kw)).length * 0.1;

    // Length boost (longer = more important)
    importance += Math.min(0.2, text.length / 1000);

    return Math.min(1.0, importance);
  }

  /**
   * Get overlap text
   */
  private getOverlap(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) {
      return text;
    }

    return text.substring(text.length - overlapSize);
  }
}
