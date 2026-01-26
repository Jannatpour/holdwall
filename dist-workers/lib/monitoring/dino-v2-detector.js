"use strict";
/**
 * DINO v2 (Self-Distilled Transformers) Detector
 *
 * Extracts visual features from images using self-supervised learning.
 * DINO v2 produces patch-level embeddings and a global CLS token that
 * capture rich visual semantics useful for content understanding and
 * manipulation detection.
 *
 * Supports:
 * - DINOv2-base (768 dimensions)
 * - DINOv3-base (768 dimensions, newer)
 * - NVIDIA NIM API integration
 * - Hugging Face Transformers API
 * - OpenAI Vision API fallback
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DINOv2Detector = void 0;
const embeddings_1 = require("@/lib/search/embeddings");
class DINOv2Detector {
    constructor() {
        this.openaiApiKey = null;
        this.nvidiaApiKey = null;
        this.huggingfaceApiKey = null;
        this.embeddings = new embeddings_1.VectorEmbeddings();
        this.openaiApiKey = process.env.OPENAI_API_KEY || null;
        this.nvidiaApiKey = process.env.NVIDIA_API_KEY || null;
        this.huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY || null;
    }
    /**
     * Extract DINO v2 features from image
     */
    async extractFeatures(imageUrl, options) {
        try {
            const { patchSize = 16, numPatches = 196, useLocal = false, model = "dinov3" } = options || {};
            const patches = [];
            let baseFeatures = [];
            let usedModel = model === "dinov3" ? "facebook/dinov3-base" : "facebook/dinov2-base";
            // Try NVIDIA NIM DINOv2 endpoint (if available)
            if (this.nvidiaApiKey && !useLocal) {
                try {
                    const response = await fetch("https://integrate.api.nvidia.com/v1/embeddings", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${this.nvidiaApiKey}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            model: "nvidia/nv-dinov2",
                            input: imageUrl,
                        }),
                    });
                    if (response.ok) {
                        const data = await response.json();
                        const embedding = data.data?.[0]?.embedding || data.embedding;
                        if (embedding && Array.isArray(embedding)) {
                            baseFeatures = embedding;
                            usedModel = "nvidia/nv-dinov2";
                        }
                    }
                }
                catch (error) {
                    console.warn("NVIDIA DINOv2 failed, trying Hugging Face:", error);
                }
            }
            // Fallback: Hugging Face Transformers API
            if (baseFeatures.length === 0 && this.huggingfaceApiKey) {
                try {
                    const models = model === "dinov3"
                        ? ["facebook/dinov3-base", "facebook/dinov2-base"]
                        : ["facebook/dinov2-base", "facebook/dinov3-base"];
                    for (const hfModel of models) {
                        try {
                            const response = await fetch(`https://api-inference.huggingface.co/pipeline/feature-extraction/${hfModel}`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${this.huggingfaceApiKey}`,
                                },
                                body: JSON.stringify({
                                    inputs: imageUrl,
                                    options: { wait_for_model: true },
                                }),
                            });
                            if (response.ok) {
                                const embedding = await response.json();
                                if (Array.isArray(embedding) && embedding.length > 0) {
                                    baseFeatures = Array.isArray(embedding[0]) ? embedding[0] : embedding;
                                    usedModel = hfModel;
                                    break;
                                }
                            }
                        }
                        catch {
                            continue;
                        }
                    }
                }
                catch (error) {
                    console.warn("Hugging Face DINOv2/v3 failed:", error);
                }
            }
            // Final fallback: Use OpenAI Vision API
            if (baseFeatures.length === 0 && this.openaiApiKey) {
                try {
                    const imageEmbedding = await this.embeddings.embed(imageUrl, { model: "openai" });
                    baseFeatures = imageEmbedding.vector;
                    usedModel = "openai-vision";
                }
                catch (error) {
                    console.warn("OpenAI Vision fallback failed:", error);
                }
            }
            if (baseFeatures.length === 0) {
                throw new Error("DINOv2 feature extraction failed: No available model endpoint");
            }
            // DINOv2/v3 produces patch embeddings and a global CLS token
            // For DINOv2-base: patch_dim=768, global_dim=768
            // For DINOv3-base: patch_dim=768, global_dim=768
            const patchDim = 768;
            const globalDim = 768;
            // Extract global features (first 768 dimensions = CLS token)
            const globalFeatures = baseFeatures.slice(0, globalDim);
            // Generate patch features from base features
            // In production, DINOv2/v3 would return patch embeddings directly
            // Here we simulate by chunking the embedding vector
            const patchesPerSide = Math.floor(Math.sqrt(numPatches));
            const patchFeatureLength = Math.min(patchDim, Math.floor((baseFeatures.length - globalDim) / numPatches));
            for (let y = 0; y < patchesPerSide; y++) {
                for (let x = 0; x < patchesPerSide; x++) {
                    const patchIndex = y * patchesPerSide + x;
                    if (patchIndex >= numPatches)
                        break;
                    const featureStart = globalDim + (patchIndex * patchFeatureLength);
                    const patchFeatures = baseFeatures.slice(featureStart, featureStart + patchFeatureLength);
                    // Pad or truncate to patchDim
                    const finalFeatures = patchFeatures.length === patchDim
                        ? patchFeatures
                        : patchFeatures.length < patchDim
                            ? [...patchFeatures, ...new Array(patchDim - patchFeatures.length).fill(0)]
                            : patchFeatures.slice(0, patchDim);
                    patches.push({
                        x: x * patchSize,
                        y: y * patchSize,
                        features: finalFeatures,
                    });
                }
            }
            // Calculate attention weights based on patch similarity
            // In production, these would come from the transformer's attention mechanism
            const attentionWeights = [];
            for (let i = 0; i < patches.length; i++) {
                const row = [];
                for (let j = 0; j < patches.length; j++) {
                    if (i === j) {
                        row.push(1.0); // Self-attention
                    }
                    else {
                        // Calculate cosine similarity between patches as attention weight
                        const patchI = patches[i].features;
                        const patchJ = patches[j].features;
                        const similarity = this.cosineSimilarity(patchI, patchJ);
                        row.push(Math.max(0, similarity));
                    }
                }
                attentionWeights.push(row);
            }
            // Calculate patch attention scores (how much each patch contributes)
            const patchAttentionScores = this.calculatePatchAttention(patches, globalFeatures);
            patches.forEach((patch, idx) => {
                patch.attention = patchAttentionScores[idx];
            });
            return {
                patches,
                globalFeatures,
                attentionWeights,
                model: usedModel,
                dimensions: {
                    patch: patchDim,
                    global: globalDim,
                },
            };
        }
        catch (error) {
            console.warn("DINO v2 feature extraction failed:", error);
            return {
                patches: [],
                globalFeatures: [],
                attentionWeights: [],
                model: "unknown",
                dimensions: {
                    patch: 768,
                    global: 768,
                },
            };
        }
    }
    /**
     * Detect anomalies in image using DINOv2 features
     */
    async detectAnomalies(imageUrl, options) {
        const features = await this.extractFeatures(imageUrl, options);
        const anomalies = [];
        const threshold = options?.threshold || 0.5;
        if (features.patches.length === 0) {
            return {
                isAnomalous: false,
                confidence: 0.5,
                anomalies: [],
                features,
            };
        }
        // Analyze patch variances for inconsistencies
        const patchVariances = features.patches.map(patch => {
            const mean = patch.features.reduce((sum, f) => sum + f, 0) / patch.features.length;
            const variance = patch.features.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / patch.features.length;
            return variance;
        });
        const meanVariance = patchVariances.reduce((sum, v) => sum + v, 0) / patchVariances.length;
        const stdVariance = Math.sqrt(patchVariances.reduce((sum, v) => sum + Math.pow(v - meanVariance, 2), 0) / patchVariances.length);
        // Identify anomalous patches (high variance or low attention)
        for (let i = 0; i < features.patches.length; i++) {
            const patch = features.patches[i];
            const variance = patchVariances[i];
            const zScore = (variance - meanVariance) / (stdVariance || 1);
            if (zScore > 2.0) {
                anomalies.push({
                    patchIndex: i,
                    x: patch.x,
                    y: patch.y,
                    severity: "high",
                    description: `High variance patch (z-score: ${zScore.toFixed(2)})`,
                });
            }
            else if (zScore > 1.5) {
                anomalies.push({
                    patchIndex: i,
                    x: patch.x,
                    y: patch.y,
                    severity: "medium",
                    description: `Moderate variance patch (z-score: ${zScore.toFixed(2)})`,
                });
            }
            // Low attention indicates potential manipulation
            if (patch.attention !== undefined && patch.attention < 0.1) {
                anomalies.push({
                    patchIndex: i,
                    x: patch.x,
                    y: patch.y,
                    severity: "low",
                    description: `Low attention patch (attention: ${(patch.attention * 100).toFixed(1)}%)`,
                });
            }
        }
        const isAnomalous = anomalies.some(a => a.severity === "high") ||
            anomalies.filter(a => a.severity === "medium").length >= 3;
        const confidence = this.calculateConfidence(anomalies, patchVariances);
        return {
            isAnomalous,
            confidence,
            anomalies,
            features,
        };
    }
    /**
     * Calculate patch attention scores based on similarity to global features
     */
    calculatePatchAttention(patches, globalFeatures) {
        return patches.map(patch => {
            const similarity = this.cosineSimilarity(patch.features, globalFeatures);
            // Normalize to 0-1 range
            return Math.max(0, Math.min(1, (similarity + 1) / 2));
        });
    }
    /**
     * Calculate confidence from anomalies and patch variances
     */
    calculateConfidence(anomalies, patchVariances) {
        let baseConfidence = 0.7; // Start with moderate confidence
        // Adjust based on anomalies
        for (const anomaly of anomalies) {
            switch (anomaly.severity) {
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
        // Adjust based on overall variance
        if (patchVariances.length > 0) {
            const meanVariance = patchVariances.reduce((sum, v) => sum + v, 0) / patchVariances.length;
            if (meanVariance > 0.5) {
                baseConfidence -= 0.1;
            }
        }
        return Math.max(0, Math.min(1, baseConfidence));
    }
    /**
     * Cosine similarity between two vectors
     */
    cosineSimilarity(vec1, vec2) {
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
exports.DINOv2Detector = DINOv2Detector;
