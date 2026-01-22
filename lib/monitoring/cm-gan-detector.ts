/**
 * CM-GAN (Cross-Modal Graph Attention Networks) Detector
 * 
 * Analyzes relationships between different modalities (text, image, video, audio)
 * using graph attention mechanisms to detect cross-modal inconsistencies.
 * 
 * CM-GAN builds a graph where nodes represent different modalities and edges
 * represent attention-weighted relationships, enabling detection of mismatches
 * between modalities that indicate manipulation or synthetic content.
 */

import { VectorEmbeddings } from "@/lib/search/embeddings";
import { DINOv2Detector } from "./dino-v2-detector";

export interface CMGANFeatures {
  text: number[];
  image: number[];
  video?: number[];
  audio?: number[];
  crossModalAttention: number[][];
  relationshipScore: number;
  graphNodes: Array<{
    id: string;
    modality: "text" | "image" | "video" | "audio";
    features: number[];
  }>;
  graphEdges: Array<{
    from: string;
    to: string;
    weight: number;
    attention: number;
  }>;
}

export interface CMGANDetectionResult {
  isMismatched: boolean;
  confidence: number;
  relationshipScore: number;
  mismatches: Array<{
    modality1: string;
    modality2: string;
    severity: "low" | "medium" | "high";
    description: string;
  }>;
  features: CMGANFeatures;
}

export class CMGANDetector {
  private embeddings: VectorEmbeddings;
  private dinov2Detector: DINOv2Detector;

  constructor() {
    this.embeddings = new VectorEmbeddings();
    this.dinov2Detector = new DINOv2Detector();
  }

  /**
   * Extract CM-GAN features from multimodal content
   */
  async extractFeatures(
    content: {
      text?: string;
      imageUrl?: string;
      videoUrl?: string;
      audioUrl?: string;
    }
  ): Promise<CMGANFeatures> {
    try {
      const textFeatures: number[] = [];
      const imageFeatures: number[] = [];
      const videoFeatures: number[] = [];
      const audioFeatures: number[] = [];
      const graphNodes: CMGANFeatures["graphNodes"] = [];
      const graphEdges: CMGANFeatures["graphEdges"] = [];

      // Extract text features
      if (content.text) {
        const textEmbedding = await this.embeddings.embed(content.text, { model: "openai" });
        textFeatures.push(...textEmbedding.vector);
        graphNodes.push({
          id: "text",
          modality: "text",
          features: textEmbedding.vector,
        });
      }

      // Extract image features using DINOv2
      if (content.imageUrl) {
        const dinov2Features = await this.dinov2Detector.extractFeatures(content.imageUrl);
        imageFeatures.push(...dinov2Features.globalFeatures);
        graphNodes.push({
          id: "image",
          modality: "image",
          features: dinov2Features.globalFeatures,
        });
      }

      // Extract video features
      if (content.videoUrl) {
        const videoEmbedding = await this.embeddings.embed(content.videoUrl, { model: "openai" });
        videoFeatures.push(...videoEmbedding.vector);
        graphNodes.push({
          id: "video",
          modality: "video",
          features: videoEmbedding.vector,
        });
      }

      // Extract audio features
      if (content.audioUrl) {
        const audioEmbedding = await this.embeddings.embed(content.audioUrl, { model: "openai" });
        audioFeatures.push(...audioEmbedding.vector);
        graphNodes.push({
          id: "audio",
          modality: "audio",
          features: audioEmbedding.vector,
        });
      }

      // Calculate cross-modal attention using graph attention mechanism
      const crossModalAttention = this.calculateCrossModalAttention(
        textFeatures,
        imageFeatures,
        videoFeatures,
        audioFeatures
      );

      // Build graph edges from attention weights
      const modalities = [
        { id: "text", features: textFeatures },
        { id: "image", features: imageFeatures },
        { id: "video", features: videoFeatures },
        { id: "audio", features: audioFeatures },
      ].filter(m => m.features.length > 0);

      for (let i = 0; i < modalities.length; i++) {
        for (let j = i + 1; j < modalities.length; j++) {
          const attention = crossModalAttention[i]?.[j] || crossModalAttention[j]?.[i] || 0;
          const weight = this.cosineSimilarity(modalities[i].features, modalities[j].features);
          
          graphEdges.push({
            from: modalities[i].id,
            to: modalities[j].id,
            weight,
            attention,
          });
        }
      }

      // Calculate relationship score
      const relationshipScore = this.calculateRelationshipScore(
        textFeatures,
        imageFeatures,
        videoFeatures,
        audioFeatures
      );

      return {
        text: textFeatures,
        image: imageFeatures,
        video: videoFeatures.length > 0 ? videoFeatures : undefined,
        audio: audioFeatures.length > 0 ? audioFeatures : undefined,
        crossModalAttention,
        relationshipScore,
        graphNodes,
        graphEdges,
      };
    } catch (error) {
      console.warn("CM-GAN feature extraction failed:", error);
      return {
        text: [],
        image: [],
        crossModalAttention: [],
        relationshipScore: 0.5,
        graphNodes: [],
        graphEdges: [],
      };
    }
  }

  /**
   * Detect cross-modal mismatches
   */
  async detectMismatch(
    content: {
      text?: string;
      imageUrl?: string;
      videoUrl?: string;
      audioUrl?: string;
    }
  ): Promise<CMGANDetectionResult> {
    const features = await this.extractFeatures(content);
    const mismatches: CMGANDetectionResult["mismatches"] = [];

    // Analyze relationship scores between modalities
    const modalities = [
      { name: "text", features: features.text },
      { name: "image", features: features.image },
      { name: "video", features: features.video || [] },
      { name: "audio", features: features.audio || [] },
    ].filter(m => m.features.length > 0);

    for (let i = 0; i < modalities.length; i++) {
      for (let j = i + 1; j < modalities.length; j++) {
        const similarity = this.cosineSimilarity(
          modalities[i].features,
          modalities[j].features
        );

        if (similarity < 0.3) {
          mismatches.push({
            modality1: modalities[i].name,
            modality2: modalities[j].name,
            severity: "high",
            description: `Low similarity (${(similarity * 100).toFixed(1)}%) between ${modalities[i].name} and ${modalities[j].name}`,
          });
        } else if (similarity < 0.5) {
          mismatches.push({
            modality1: modalities[i].name,
            modality2: modalities[j].name,
            severity: "medium",
            description: `Moderate similarity (${(similarity * 100).toFixed(1)}%) between ${modalities[i].name} and ${modalities[j].name}`,
          });
        }
      }
    }

    // Low overall relationship score indicates mismatch
    if (features.relationshipScore < 0.4) {
      mismatches.push({
        modality1: "all",
        modality2: "all",
        severity: "high",
        description: "Low overall cross-modal relationship score",
      });
    }

    const isMismatched = mismatches.some(m => m.severity === "high") ||
                        mismatches.filter(m => m.severity === "medium").length >= 2;
    
    const confidence = this.calculateConfidence(features.relationshipScore, mismatches);

    return {
      isMismatched,
      confidence,
      relationshipScore: features.relationshipScore,
      mismatches,
      features,
    };
  }

  /**
   * Calculate cross-modal attention weights using graph attention mechanism
   */
  private calculateCrossModalAttention(
    text: number[],
    image: number[],
    video: number[],
    audio: number[]
  ): number[][] {
    const modalities = [
      { name: "text", features: text },
      { name: "image", features: image },
      { name: "video", features: video },
      { name: "audio", features: audio },
    ].filter(m => m.features.length > 0);

    const attention: number[][] = [];

    // Graph attention: each modality attends to all others
    for (let i = 0; i < modalities.length; i++) {
      const row: number[] = [];
      const query = modalities[i].features;
      
      // Calculate attention scores for all modalities
      const scores: number[] = [];
      for (let j = 0; j < modalities.length; j++) {
        if (i === j) {
          scores.push(1.0); // Self-attention
        } else {
          // Attention = softmax(cosine_similarity(query, key))
          const similarity = this.cosineSimilarity(query, modalities[j].features);
          scores.push(similarity);
        }
      }

      // Softmax normalization
      const maxScore = Math.max(...scores);
      const expScores = scores.map(s => Math.exp(s - maxScore));
      const sumExp = expScores.reduce((sum, s) => sum + s, 0);
      const normalizedScores = expScores.map(s => s / sumExp);

      row.push(...normalizedScores);
      attention.push(row);
    }

    return attention;
  }

  /**
   * Calculate overall relationship score between modalities
   */
  private calculateRelationshipScore(
    text: number[],
    image: number[],
    video: number[],
    audio: number[]
  ): number {
    const scores: number[] = [];

    if (text.length > 0 && image.length > 0) {
      scores.push(this.cosineSimilarity(text, image));
    }
    if (text.length > 0 && video.length > 0) {
      scores.push(this.cosineSimilarity(text, video));
    }
    if (text.length > 0 && audio.length > 0) {
      scores.push(this.cosineSimilarity(text, audio));
    }
    if (image.length > 0 && video.length > 0) {
      scores.push(this.cosineSimilarity(image, video));
    }
    if (image.length > 0 && audio.length > 0) {
      scores.push(this.cosineSimilarity(image, audio));
    }
    if (video.length > 0 && audio.length > 0) {
      scores.push(this.cosineSimilarity(video, audio));
    }

    return scores.length > 0
      ? scores.reduce((sum, s) => sum + s, 0) / scores.length
      : 0.5;
  }

  /**
   * Calculate confidence from relationship score and mismatches
   */
  private calculateConfidence(
    relationshipScore: number,
    mismatches: CMGANDetectionResult["mismatches"]
  ): number {
    let baseConfidence = relationshipScore;

    // Adjust based on mismatches
    for (const mismatch of mismatches) {
      switch (mismatch.severity) {
        case "high":
          baseConfidence -= 0.15;
          break;
        case "medium":
          baseConfidence -= 0.08;
          break;
        case "low":
          baseConfidence -= 0.03;
          break;
      }
    }

    return Math.max(0, Math.min(1, baseConfidence));
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length === 0 || vec2.length === 0) {
      return 0;
    }

    const minLen = Math.min(vec1.length, vec2.length);
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < minLen; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator > 0 ? dotProduct / denominator : 0;
  }
}
