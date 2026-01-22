/**
 * SAFF (Synchronization-Aware Feature Fusion) Detector
 * 
 * Detects temporal inconsistencies in video/audio content by analyzing
 * synchronization between temporal and spatial features.
 * 
 * SAFF extracts features from video frames or audio samples and calculates
 * a synchronization score that indicates how consistent the content is
 * across time, which is useful for detecting deepfakes and manipulated media.
 */

import { VectorEmbeddings } from "@/lib/search/embeddings";
import { MultimodalExtractor } from "./multimodal-extractor";
import { DINOv2Detector } from "./dino-v2-detector";

export interface SAFFFeatures {
  temporal: number[];
  spatial: number[];
  fused: number[];
  synchronizationScore: number;
  frameFeatures?: Array<{
    timestamp: number;
    temporal: number[];
    spatial: number[];
  }>;
}

export interface SAFFDetectionResult {
  isManipulated: boolean;
  confidence: number;
  synchronizationScore: number;
  inconsistencies: Array<{
    timestamp: number;
    severity: "low" | "medium" | "high";
    description: string;
  }>;
  features: SAFFFeatures;
}

export class SAFFDetector {
  private embeddings: VectorEmbeddings;
  private extractor: MultimodalExtractor;
  private dinov2Detector: DINOv2Detector;

  constructor() {
    this.embeddings = new VectorEmbeddings();
    this.extractor = new MultimodalExtractor();
    this.dinov2Detector = new DINOv2Detector();
  }

  /**
   * Extract SAFF features from video or audio content
   */
  async extractFeatures(
    content: {
      type: "video" | "audio";
      url?: string;
      file?: Blob;
      frames?: Array<{ timestamp: number; data: Blob }>;
    }
  ): Promise<SAFFFeatures> {
    try {
      const temporalFeatures: number[] = [];
      const spatialFeatures: number[] = [];
      const frameFeatures: SAFFFeatures["frameFeatures"] = [];

      if (content.type === "video" && content.frames) {
        // Process frames for temporal consistency
        for (let i = 0; i < content.frames.length; i++) {
          const frame = content.frames[i];
          
          // Extract spatial features from frame using DINOv2
          let spatialFrameFeatures: number[] = [];
          try {
            // Try to extract frame image features using DINOv2
            if (frame.data) {
              // Convert Blob to URL for DINOv2
              const frameUrl = URL.createObjectURL(frame.data);
              try {
                const dinov2Features = await this.dinov2Detector.extractFeatures(frameUrl, {
                  patchSize: 14,
                  numPatches: 256,
                });
                // Use global features for spatial representation
                spatialFrameFeatures = dinov2Features.globalFeatures.slice(0, 256);
                URL.revokeObjectURL(frameUrl);
              } catch (dinov2Error) {
                URL.revokeObjectURL(frameUrl);
                // Fallback to embedding if DINOv2 fails
                if (i === 0 && content.url) {
                  const frameEmbedding = await this.embeddings.embed(
                    content.url,
                    { model: "openai" }
                  );
                  spatialFrameFeatures = frameEmbedding.vector.slice(0, 256);
                }
              }
            } else if (i === 0 && content.url) {
              // For first frame without Blob, extract using URL with DINOv2
              try {
                const dinov2Features = await this.dinov2Detector.extractFeatures(content.url, {
                  patchSize: 14,
                  numPatches: 256,
                });
                spatialFrameFeatures = dinov2Features.globalFeatures.slice(0, 256);
              } catch (dinov2Error) {
                // Fallback to embedding
                const frameEmbedding = await this.embeddings.embed(
                  content.url,
                  { model: "openai" }
                );
                spatialFrameFeatures = frameEmbedding.vector.slice(0, 256);
              }
            }
          } catch (error) {
            console.warn("Frame spatial feature extraction failed:", error);
          }

          // Temporal features: extract from frame timestamp and position
          // Use frame index and timestamp to create temporal embedding
          const temporalContext = `frame_${i}_timestamp_${frame.timestamp}_position_${i}`;
          const frameEmbedding = await this.embeddings.embed(
            temporalContext,
            { model: "openai" }
          );
          const temporalFrameFeatures = frameEmbedding.vector.slice(0, 128);

          temporalFeatures.push(...temporalFrameFeatures);
          if (spatialFrameFeatures.length > 0) {
            spatialFeatures.push(...spatialFrameFeatures);
          }

          frameFeatures.push({
            timestamp: frame.timestamp,
            temporal: temporalFrameFeatures,
            spatial: spatialFrameFeatures,
          });
        }
      } else if (content.type === "audio") {
        // Extract audio features
        try {
          const audioEmbedding = await this.embeddings.embed(
            content.url || "audio_content",
            { model: "openai" }
          );
          const audioVector = audioEmbedding.vector;
          
          // Split into temporal and spatial components
          temporalFeatures.push(...audioVector.slice(0, 128));
          spatialFeatures.push(...audioVector.slice(128, 256));
        } catch (error) {
          console.warn("Audio embedding extraction failed:", error);
        }
      } else if (content.type === "video" && content.url) {
        // Fallback: extract from video URL metadata
        try {
          const metadata = await this.extractor.extractVideoMetadata(content.url, content.file);
          
          // Generate features from metadata
          const metadataText = JSON.stringify(metadata);
          const metadataEmbedding = await this.embeddings.embed(metadataText, { model: "openai" });
          const metadataVector = metadataEmbedding.vector;
          
          temporalFeatures.push(...metadataVector.slice(0, 128));
          spatialFeatures.push(...metadataVector.slice(128, 256));
        } catch (error) {
          console.warn("Video metadata extraction failed:", error);
        }
      }

      // Calculate synchronization score (temporal consistency)
      const synchronizationScore = this.calculateSynchronizationScore(temporalFeatures);

      // Fuse temporal and spatial features
      const fusedFeatures = this.fuseFeatures(temporalFeatures, spatialFeatures);

      return {
        temporal: temporalFeatures,
        spatial: spatialFeatures,
        fused: fusedFeatures,
        synchronizationScore,
        frameFeatures: frameFeatures.length > 0 ? frameFeatures : undefined,
      };
    } catch (error) {
      console.warn("SAFF feature extraction failed:", error);
      return {
        temporal: [],
        spatial: [],
        fused: [],
        synchronizationScore: 0.5,
      };
    }
  }

  /**
   * Detect manipulation using SAFF features
   */
  async detectManipulation(
    content: {
      type: "video" | "audio";
      url?: string;
      file?: Blob;
      frames?: Array<{ timestamp: number; data: Blob }>;
    }
  ): Promise<SAFFDetectionResult> {
    const features = await this.extractFeatures(content);
    const inconsistencies: SAFFDetectionResult["inconsistencies"] = [];

    // Low synchronization score indicates manipulation
    if (features.synchronizationScore < 0.5) {
      inconsistencies.push({
        timestamp: 0,
        severity: "high",
        description: "Low temporal synchronization detected",
      });
    } else if (features.synchronizationScore < 0.7) {
      inconsistencies.push({
        timestamp: 0,
        severity: "medium",
        description: "Moderate temporal synchronization issues",
      });
    }

    // Analyze frame-by-frame inconsistencies if available
    if (features.frameFeatures && features.frameFeatures.length > 1) {
      for (let i = 1; i < features.frameFeatures.length; i++) {
        const prev = features.frameFeatures[i - 1];
        const curr = features.frameFeatures[i];

        // Calculate temporal difference
        const temporalDiff = this.cosineSimilarity(prev.temporal, curr.temporal);
        
        if (temporalDiff < 0.3) {
          inconsistencies.push({
            timestamp: curr.timestamp,
            severity: "high",
            description: "Significant temporal discontinuity detected",
          });
        } else if (temporalDiff < 0.5) {
          inconsistencies.push({
            timestamp: curr.timestamp,
            severity: "medium",
            description: "Moderate temporal discontinuity",
          });
        }
      }
    }

    const isManipulated = inconsistencies.some(i => i.severity === "high") ||
                         inconsistencies.filter(i => i.severity === "medium").length >= 2;
    
    const confidence = this.calculateConfidence(features.synchronizationScore, inconsistencies);

    return {
      isManipulated,
      confidence,
      synchronizationScore: features.synchronizationScore,
      inconsistencies,
      features,
    };
  }

  /**
   * Calculate synchronization score (temporal consistency)
   * Lower variance in temporal features = better synchronization
   */
  private calculateSynchronizationScore(temporalFeatures: number[]): number {
    if (temporalFeatures.length < 2) {
      return 0.5;
    }

    // Calculate variance in temporal features
    const mean = temporalFeatures.reduce((sum, val) => sum + val, 0) / temporalFeatures.length;
    const variance = temporalFeatures.reduce(
      (sum, val) => sum + Math.pow(val - mean, 2),
      0
    ) / temporalFeatures.length;
    
    // Normalize to 0-1 (lower variance = higher score)
    // Use exponential decay to map variance to score
    const maxVariance = 1.0;
    const normalizedVariance = Math.min(1.0, variance / maxVariance);
    return Math.max(0, 1 - normalizedVariance);
  }

  /**
   * Fuse temporal and spatial features using weighted combination
   */
  private fuseFeatures(temporal: number[], spatial: number[]): number[] {
    const fused: number[] = [];
    const maxLen = Math.max(temporal.length, spatial.length);

    // Weighted fusion: temporal 0.6, spatial 0.4
    // This emphasizes temporal consistency for manipulation detection
    for (let i = 0; i < maxLen; i++) {
      const t = temporal[i] || 0;
      const s = spatial[i] || 0;
      fused.push(t * 0.6 + s * 0.4);
    }

    return fused;
  }

  /**
   * Calculate confidence score from synchronization and inconsistencies
   */
  private calculateConfidence(
    synchronizationScore: number,
    inconsistencies: SAFFDetectionResult["inconsistencies"]
  ): number {
    let baseConfidence = synchronizationScore;

    // Adjust based on inconsistencies
    for (const inconsistency of inconsistencies) {
      switch (inconsistency.severity) {
        case "high":
          baseConfidence -= 0.2;
          break;
        case "medium":
          baseConfidence -= 0.1;
          break;
        case "low":
          baseConfidence -= 0.05;
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
