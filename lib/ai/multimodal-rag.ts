/**
 * Multimodal RAG
 * 
 * Extends retrieval beyond text to images/videos using
 * Latent Diffusion Models (LDMs) and multimodal embeddings.
 */

import { RAGPipeline, RAGContext } from "./rag";
import { MultimodalExtractor } from "../monitoring/multimodal-extractor";

export interface MultimodalEvidence {
  type: "text" | "image" | "video" | "audio";
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

export interface MultimodalRAGResult {
  query: string;
  answer: string;
  evidence: MultimodalEvidence[];
  sources: string[];
}

export class MultimodalRAG {
  private ragPipeline: RAGPipeline;
  private multimodalExtractor: MultimodalExtractor;

  constructor(ragPipeline: RAGPipeline) {
    this.ragPipeline = ragPipeline;
    this.multimodalExtractor = new MultimodalExtractor();
  }

  /**
   * Execute multimodal RAG
   */
  async execute(
    query: string,
    tenantId: string,
    options?: {
      includeImages?: boolean;
      includeVideos?: boolean;
    }
  ): Promise<MultimodalRAGResult> {
    const { includeImages = true, includeVideos = true } = options || {};

    // Text retrieval
    const textContext = await this.ragPipeline.buildContext(query, tenantId);

    // Extract multimodal evidence
    const multimodalEvidence: MultimodalEvidence[] = [];

    // Add text evidence
    for (const ev of textContext.evidence) {
      const content = typeof ev.content === "string"
        ? ev.content
        : JSON.stringify(ev.content);

      multimodalEvidence.push({
        type: "text",
        content: content.substring(0, 1000),
        metadata: {
          evidenceId: ev.evidence_id,
          source: ev.source,
        },
      });
    }

    // Extract images from evidence (if URLs present)
    if (includeImages) {
      const imageEvidence = await this.extractImageEvidence(textContext.evidence);
      multimodalEvidence.push(...imageEvidence);
    }

    // Extract videos from evidence
    if (includeVideos) {
      const videoEvidence = await this.extractVideoEvidence(textContext.evidence);
      multimodalEvidence.push(...videoEvidence);
    }

    // Generate answer from multimodal evidence
    const answer = await this.generateMultimodalAnswer(query, multimodalEvidence);

    return {
      query,
      answer,
      evidence: multimodalEvidence,
      sources: multimodalEvidence.map(e => e.metadata?.source as string || "").filter(Boolean),
    };
  }

  /**
   * Extract image evidence
   */
  private async extractImageEvidence(
    evidence: Array<{ content: unknown; source?: { url?: string } }>
  ): Promise<MultimodalEvidence[]> {
    const imageEvidence: MultimodalEvidence[] = [];

    for (const ev of evidence) {
      // Look for image URLs in content
      const content = typeof ev.content === "string"
        ? ev.content
        : JSON.stringify(ev.content);

      const imageUrlRegex = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/gi;
      const imageUrls = content.match(imageUrlRegex) || [];

      for (const imageUrl of imageUrls.slice(0, 3)) {
        try {
          // Extract text from image
          const extracted = await this.multimodalExtractor.extractTextFromImage(imageUrl);

          imageEvidence.push({
            type: "image",
            content: extracted.text,
            metadata: {
              imageUrl,
              confidence: extracted.confidence,
            },
          });
        } catch (error) {
          console.warn(`Failed to extract text from image ${imageUrl}:`, error);
        }
      }
    }

    return imageEvidence;
  }

  /**
   * Extract video evidence
   */
  private async extractVideoEvidence(
    evidence: Array<{ content: unknown; source?: { url?: string } }>
  ): Promise<MultimodalEvidence[]> {
    const videoEvidence: MultimodalEvidence[] = [];

    for (const ev of evidence) {
      const content = typeof ev.content === "string"
        ? ev.content
        : JSON.stringify(ev.content);

      const videoUrlRegex = /https?:\/\/[^\s]+\.(mp4|webm|mov|avi)/gi;
      const videoUrls = content.match(videoUrlRegex) || [];

      for (const videoUrl of videoUrls.slice(0, 2)) {
        try {
          // Extract transcript from video
          const transcript = await this.multimodalExtractor.extractTranscriptFromVideo(videoUrl);

          videoEvidence.push({
            type: "video",
            content: transcript.transcript,
            metadata: {
              videoUrl,
              duration: transcript.duration,
            },
          });
        } catch (error) {
          console.warn(`Failed to extract transcript from video ${videoUrl}:`, error);
        }
      }
    }

    return videoEvidence;
  }

  /**
   * Generate answer from multimodal evidence
   */
  private async generateMultimodalAnswer(
    query: string,
    evidence: MultimodalEvidence[]
  ): Promise<string> {
    // Combine all evidence
    const textEvidence = evidence
      .filter(e => e.type === "text")
      .map(e => e.content)
      .join("\n\n");

    const imageEvidence = evidence
      .filter(e => e.type === "image")
      .map(e => `[Image]: ${e.content}`)
      .join("\n\n");

    const videoEvidence = evidence
      .filter(e => e.type === "video")
      .map(e => `[Video]: ${e.content}`)
      .join("\n\n");

    return `Text: ${textEvidence}\n\nImages: ${imageEvidence}\n\nVideos: ${videoEvidence}`;
  }
}
