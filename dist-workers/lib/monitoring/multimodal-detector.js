"use strict";
/**
 * Multimodal Detection
 *
 * Detects and processes synthetic media, deepfakes, and manipulated content
 * across text, images, videos, and audio.
 *
 * Implements advanced models:
 * - SAFF (Synchronization-Aware Feature Fusion) for temporal consistency
 * - CM-GAN (Cross-Modal Graph Attention Networks) for multimodal relationships
 * - DINO v2 (Self-Distilled Transformers) for visual feature extraction
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultimodalDetector = void 0;
const multimodal_extractor_1 = require("./multimodal-extractor");
const embeddings_1 = require("@/lib/search/embeddings");
const saff_detector_1 = require("./saff-detector");
const cm_gan_detector_1 = require("./cm-gan-detector");
const dino_v2_detector_1 = require("./dino-v2-detector");
// Interfaces imported from separate detector files
// SAFFFeatures, CMGANFeatures, DINOv2Features
class MultimodalDetector {
    constructor() {
        this.openaiApiKey = null;
        this.extractor = new multimodal_extractor_1.MultimodalExtractor();
        this.embeddings = new embeddings_1.VectorEmbeddings();
        this.saffDetector = new saff_detector_1.SAFFDetector();
        this.cmganDetector = new cm_gan_detector_1.CMGANDetector();
        this.dinov2Detector = new dino_v2_detector_1.DINOv2Detector();
        this.openaiApiKey = process.env.OPENAI_API_KEY || null;
    }
    /**
     * Detect synthetic media
     */
    async detectSynthetic(content) {
        const indicators = [];
        switch (content.type) {
            case "text":
                return await this.detectSyntheticText(content.text || "");
            case "image":
                return await this.detectSyntheticImage(content.url || "", content.file);
            case "video":
                return await this.detectSyntheticVideo(content.url || "", content.file);
            case "audio":
                return await this.detectSyntheticAudio(content.url || "", content.file);
            default:
                return {
                    type: content.type,
                    isSynthetic: false,
                    confidence: 0.5,
                    indicators: [],
                };
        }
    }
    /**
     * Detect synthetic text (AI-generated)
     */
    async detectSyntheticText(text) {
        const indicators = [];
        // Check for AI-like patterns
        const aiPatterns = [
            /as an ai language model/i,
            /i cannot/i,
            /i don't have/i,
            /i'm not able/i,
        ];
        for (const pattern of aiPatterns) {
            if (pattern.test(text)) {
                indicators.push({
                    indicator: "ai_language_pattern",
                    severity: "high",
                    description: "Contains AI language model disclaimers",
                });
            }
        }
        // Check for repetition
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
        const repetitionRatio = 1 - (uniqueSentences.size / sentences.length);
        if (repetitionRatio > 0.3) {
            indicators.push({
                indicator: "high_repetition",
                severity: "medium",
                description: `High sentence repetition (${(repetitionRatio * 100).toFixed(1)}%)`,
            });
        }
        // Check for statistical anomalies
        const avgWordLength = text.split(/\s+/).reduce((sum, w) => sum + w.length, 0) / text.split(/\s+/).length;
        if (avgWordLength > 6) {
            indicators.push({
                indicator: "unusual_word_length",
                severity: "low",
                description: "Unusually long average word length",
            });
        }
        // Use GPTZero-like detection if available
        if (this.openaiApiKey) {
            try {
                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${this.openaiApiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: "gpt-4o",
                        messages: [
                            {
                                role: "system",
                                content: "Analyze if this text appears to be AI-generated. Respond with JSON: {\"isAI\": boolean, \"confidence\": number, \"reasons\": string[]}",
                            },
                            {
                                role: "user",
                                content: text.substring(0, 2000),
                            },
                        ],
                        temperature: 0.3,
                    }),
                });
                if (response.ok) {
                    const data = await response.json();
                    const analysis = JSON.parse(data.choices[0]?.message?.content || "{}");
                    if (analysis.isAI) {
                        indicators.push({
                            indicator: "llm_analysis",
                            severity: "high",
                            description: analysis.reasons?.join(", ") || "LLM analysis suggests AI generation",
                        });
                    }
                }
            }
            catch (error) {
                console.warn("AI detection failed:", error);
            }
        }
        const isSynthetic = indicators.some(i => i.severity === "high") ||
            indicators.filter(i => i.severity === "medium").length >= 2;
        const confidence = this.calculateConfidence(indicators);
        return {
            type: "text",
            isSynthetic,
            confidence,
            indicators,
        };
    }
    /**
     * Detect synthetic image (deepfake/manipulated)
     */
    async detectSyntheticImage(url, file) {
        const indicators = [];
        try {
            // Extract image metadata
            const metadata = await this.extractor.extractImageMetadata(url, file);
            // Check for common deepfake artifacts
            if (metadata.width && metadata.height) {
                const aspectRatio = metadata.width / metadata.height;
                if (aspectRatio < 0.5 || aspectRatio > 2.0) {
                    indicators.push({
                        indicator: "unusual_aspect_ratio",
                        severity: "low",
                        description: `Unusual aspect ratio: ${aspectRatio.toFixed(2)}`,
                    });
                }
            }
            // Check for compression artifacts
            if (metadata.format === "jpeg" && metadata.quality && metadata.quality < 80) {
                indicators.push({
                    indicator: "low_quality_compression",
                    severity: "medium",
                    description: "Low quality JPEG compression may hide manipulation",
                });
            }
            // Use OpenAI Vision for analysis if available
            if (this.openaiApiKey && url) {
                try {
                    const response = await fetch("https://api.openai.com/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${this.openaiApiKey}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            model: "gpt-4o",
                            messages: [
                                {
                                    role: "user",
                                    content: [
                                        {
                                            type: "text",
                                            text: "Analyze this image for signs of manipulation, deepfake, or synthetic generation. Look for inconsistencies, artifacts, or unnatural features.",
                                        },
                                        {
                                            type: "image_url",
                                            image_url: { url },
                                        },
                                    ],
                                },
                            ],
                            temperature: 0.3,
                        }),
                    });
                    if (response.ok) {
                        const data = await response.json();
                        const analysis = data.choices[0]?.message?.content || "";
                        if (analysis.toLowerCase().includes("manipulated") ||
                            analysis.toLowerCase().includes("synthetic") ||
                            analysis.toLowerCase().includes("deepfake") ||
                            analysis.toLowerCase().includes("artifacts")) {
                            indicators.push({
                                indicator: "vision_analysis",
                                severity: "high",
                                description: "Vision model detected potential manipulation",
                            });
                        }
                    }
                }
                catch (error) {
                    console.warn("Vision analysis failed:", error);
                }
            }
        }
        catch (error) {
            console.warn("Image detection failed:", error);
        }
        const isSynthetic = indicators.some(i => i.severity === "high");
        const confidence = this.calculateConfidence(indicators);
        return {
            type: "image",
            isSynthetic,
            confidence,
            indicators,
            metadata: { url },
        };
    }
    /**
     * Detect synthetic video
     */
    async detectSyntheticVideo(url, file) {
        const indicators = [];
        try {
            // Extract video metadata
            const metadata = await this.extractor.extractVideoMetadata(url, file);
            // Check for frame rate anomalies
            if (metadata.frameRate && (metadata.frameRate < 15 || metadata.frameRate > 60)) {
                indicators.push({
                    indicator: "unusual_frame_rate",
                    severity: "low",
                    description: `Unusual frame rate: ${metadata.frameRate} fps`,
                });
            }
            // Check for resolution anomalies
            if (metadata.width && metadata.height) {
                const resolution = metadata.width * metadata.height;
                if (resolution < 640 * 480) {
                    indicators.push({
                        indicator: "low_resolution",
                        severity: "medium",
                        description: "Low resolution may hide manipulation artifacts",
                    });
                }
            }
            // Note: Full deepfake detection would require specialized models
            indicators.push({
                indicator: "requires_specialized_analysis",
                severity: "low",
                description: "Full deepfake detection requires specialized video analysis models",
            });
        }
        catch (error) {
            console.warn("Video detection failed:", error);
        }
        const isSynthetic = indicators.some(i => i.severity === "high");
        const confidence = this.calculateConfidence(indicators);
        return {
            type: "video",
            isSynthetic,
            confidence,
            indicators,
            metadata: { url },
        };
    }
    /**
     * Detect synthetic audio
     */
    async detectSyntheticAudio(url, file) {
        const indicators = [];
        try {
            // Extract audio metadata
            const metadata = await this.extractor.extractAudioMetadata(url, file);
            // Check for sample rate anomalies
            if (metadata.sampleRate && (metadata.sampleRate < 16000 || metadata.sampleRate > 48000)) {
                indicators.push({
                    indicator: "unusual_sample_rate",
                    severity: "low",
                    description: `Unusual sample rate: ${metadata.sampleRate} Hz`,
                });
            }
            // Note: Full voice clone detection would require specialized models
            indicators.push({
                indicator: "requires_specialized_analysis",
                severity: "low",
                description: "Full voice clone detection requires specialized audio analysis models",
            });
        }
        catch (error) {
            console.warn("Audio detection failed:", error);
        }
        const isSynthetic = indicators.some(i => i.severity === "high");
        const confidence = this.calculateConfidence(indicators);
        return {
            type: "audio",
            isSynthetic,
            confidence,
            indicators,
            metadata: { url },
        };
    }
    /**
     * Detect deepfake specifically
     */
    async detectDeepfake(content) {
        const artifacts = [];
        if (content.type === "image") {
            const detection = await this.detectSyntheticImage(content.url || "", content.file);
            for (const indicator of detection.indicators) {
                if (indicator.severity === "high" || indicator.severity === "medium") {
                    artifacts.push({
                        type: indicator.indicator,
                        location: "unknown",
                        severity: indicator.severity,
                    });
                }
            }
            return {
                isDeepfake: detection.isSynthetic && detection.confidence > 0.7,
                confidence: detection.confidence,
                artifacts,
            };
        }
        else if (content.type === "video") {
            const detection = await this.detectSyntheticVideo(content.url || "", content.file);
            for (const indicator of detection.indicators) {
                if (indicator.severity === "high" || indicator.severity === "medium") {
                    artifacts.push({
                        type: indicator.indicator,
                        location: "unknown",
                        severity: indicator.severity,
                    });
                }
            }
            return {
                isDeepfake: detection.isSynthetic && detection.confidence > 0.7,
                confidence: detection.confidence,
                artifacts,
            };
        }
        return {
            isDeepfake: false,
            confidence: 0.5,
            artifacts: [],
        };
    }
    /**
     * Calculate confidence from indicators
     */
    calculateConfidence(indicators) {
        if (indicators.length === 0) {
            return 0.3; // Low confidence if no indicators
        }
        let score = 0;
        for (const indicator of indicators) {
            switch (indicator.severity) {
                case "high":
                    score += 0.4;
                    break;
                case "medium":
                    score += 0.2;
                    break;
                case "low":
                    score += 0.1;
                    break;
            }
        }
        return Math.min(0.95, 0.3 + score);
    }
    /**
     * SAFF: Synchronization-Aware Feature Fusion
     * Detects temporal inconsistencies in video/audio content
     */
    async extractSAFFFeatures(content) {
        return this.saffDetector.extractFeatures(content);
    }
    /**
     * CM-GAN: Cross-Modal Graph Attention Networks
     * Analyzes relationships between text, image, video, and audio
     */
    async extractCMGANFeatures(content) {
        return this.cmganDetector.extractFeatures(content);
    }
    /**
     * DINO v2: Self-Distilled Transformers
     * Extracts visual features from images using self-supervised learning
     * Uses Hugging Face Transformers or NVIDIA NIM for production inference
     */
    async extractDINOv2Features(imageUrl, options) {
        return this.dinov2Detector.extractFeatures(imageUrl, options);
    }
    /**
     * Calculate cross-modal attention weights
     */
    calculateCrossModalAttention(text, image, video, audio) {
        const modalities = [
            { name: "text", features: text },
            { name: "image", features: image },
            { name: "video", features: video },
            { name: "audio", features: audio },
        ].filter(m => m.features.length > 0);
        const attention = [];
        for (let i = 0; i < modalities.length; i++) {
            const row = [];
            for (let j = 0; j < modalities.length; j++) {
                if (i === j) {
                    row.push(1.0); // Self-attention
                }
                else {
                    // Calculate cosine similarity as attention weight
                    const similarity = this.cosineSimilarity(modalities[i].features, modalities[j].features);
                    row.push(similarity);
                }
            }
            attention.push(row);
        }
        return attention;
    }
    /**
     * Calculate relationship score between modalities
     */
    calculateRelationshipScore(text, image, video, audio) {
        const scores = [];
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
        return scores.length > 0
            ? scores.reduce((sum, s) => sum + s, 0) / scores.length
            : 0.5;
    }
    /**
     * Cosine similarity
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
    /**
     * Enhanced deepfake detection using SAFF, CM-GAN, and DINO v2
     */
    async detectDeepfakeAdvanced(content) {
        const baseDetection = await this.detectDeepfake(content);
        const advanced = { ...baseDetection };
        try {
            // Extract DINO v2 features for images
            if (content.type === "image" && content.url) {
                const dinov2Features = await this.extractDINOv2Features(content.url);
                advanced.dinov2Features = dinov2Features;
                // Analyze DINO v2 features for inconsistencies
                if (dinov2Features.patches.length > 0) {
                    const patchVariances = dinov2Features.patches.map(p => {
                        const mean = p.features.reduce((sum, f) => sum + f, 0) / p.features.length;
                        const variance = p.features.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / p.features.length;
                        return variance;
                    });
                    const highVariancePatches = patchVariances.filter(v => v > 0.5).length;
                    if (highVariancePatches > patchVariances.length * 0.3) {
                        advanced.artifacts.push({
                            type: "dinov2_inconsistency",
                            location: "multiple_patches",
                            severity: "high",
                        });
                        advanced.confidence = Math.min(0.95, advanced.confidence + 0.2);
                    }
                }
            }
            // Extract SAFF features for videos
            if (content.type === "video") {
                const saffFeatures = await this.extractSAFFFeatures({
                    type: "video",
                    url: content.url,
                    file: content.file,
                });
                advanced.saffFeatures = saffFeatures;
                // Low synchronization score indicates manipulation
                if (saffFeatures.synchronizationScore < 0.5) {
                    advanced.artifacts.push({
                        type: "saff_temporal_inconsistency",
                        location: "temporal",
                        severity: "high",
                    });
                    advanced.confidence = Math.min(0.95, advanced.confidence + 0.15);
                }
            }
            // Extract CM-GAN features if text context is available
            if (content.text) {
                const cmganFeatures = await this.extractCMGANFeatures({
                    text: content.text,
                    imageUrl: content.type === "image" ? content.url : undefined,
                    videoUrl: content.type === "video" ? content.url : undefined,
                });
                advanced.cmganFeatures = cmganFeatures;
                // Low relationship score indicates mismatch
                if (cmganFeatures.relationshipScore < 0.4) {
                    advanced.artifacts.push({
                        type: "cmgan_crossmodal_mismatch",
                        location: "crossmodal",
                        severity: "medium",
                    });
                    advanced.confidence = Math.min(0.95, advanced.confidence + 0.1);
                }
            }
        }
        catch (error) {
            console.warn("Advanced deepfake detection failed:", error);
        }
        return advanced;
    }
}
exports.MultimodalDetector = MultimodalDetector;
