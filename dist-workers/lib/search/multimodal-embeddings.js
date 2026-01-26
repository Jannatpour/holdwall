"use strict";
/**
 * Multimodal Embeddings
 *
 * Process different data types (text, images, videos) simultaneously
 * for unified semantic search.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultimodalEmbeddings = void 0;
class MultimodalEmbeddings {
    constructor() {
        this.openaiApiKey = null;
        this.openaiApiKey = process.env.OPENAI_API_KEY || null;
    }
    /**
     * Embed text
     */
    async embedText(text) {
        // Use text embedding
        const embeddingService = new (await Promise.resolve().then(() => __importStar(require("../vector/embeddings")))).EmbeddingService();
        const result = await embeddingService.embed(text);
        return {
            type: "text",
            vector: result.vector,
            model: result.model,
            dimensions: result.dimensions,
        };
    }
    /**
     * Embed image using OpenAI Vision API or DINOv2
     */
    async embedImage(imageUrl, options) {
        const { useDINOv2 = false } = options || {};
        // Try DINOv2 for visual features (better for images)
        if (useDINOv2) {
            try {
                const { MultimodalDetector } = await Promise.resolve().then(() => __importStar(require("../monitoring/multimodal-detector")));
                const detector = new MultimodalDetector();
                const url = typeof imageUrl === "string" ? imageUrl : URL.createObjectURL(imageUrl);
                const dinov2Features = await detector.extractDINOv2Features(url);
                return {
                    type: "image",
                    vector: dinov2Features.globalFeatures,
                    model: "facebook/dinov2-base",
                    dimensions: dinov2Features.globalFeatures.length,
                    metadata: { imageUrl: typeof imageUrl === "string" ? imageUrl : "blob", patches: dinov2Features.patches.length },
                };
            }
            catch (error) {
                console.warn("DINOv2 image embedding failed, trying OpenAI Vision:", error);
            }
        }
        // Use OpenAI Vision API for image understanding
        if (this.openaiApiKey) {
            try {
                // Convert Blob to base64 if needed
                let imageData;
                if (imageUrl instanceof Blob) {
                    const arrayBuffer = await imageUrl.arrayBuffer();
                    const base64 = Buffer.from(arrayBuffer).toString("base64");
                    const mimeType = imageUrl.type || "image/jpeg";
                    imageData = `data:${mimeType};base64,${base64}`;
                }
                else {
                    imageData = imageUrl;
                }
                // Use OpenAI Vision API to get image description, then embed
                const visionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
                                        text: "Describe this image in detail for embedding purposes.",
                                    },
                                    {
                                        type: "image_url",
                                        image_url: { url: imageData },
                                    },
                                ],
                            },
                        ],
                        max_tokens: 300,
                    }),
                });
                if (visionResponse.ok) {
                    const visionData = await visionResponse.json();
                    const description = visionData.choices[0]?.message?.content || "";
                    // Embed the description
                    const embeddingService = new (await Promise.resolve().then(() => __importStar(require("../vector/embeddings")))).EmbeddingService();
                    const embedding = await embeddingService.embed(description);
                    return {
                        type: "image",
                        vector: embedding.vector,
                        model: embedding.model,
                        dimensions: embedding.dimensions,
                        metadata: { imageUrl: typeof imageUrl === "string" ? imageUrl : "blob", description },
                    };
                }
            }
            catch (error) {
                console.warn("OpenAI Vision embedding failed:", error);
            }
        }
        throw new Error("Image embedding failed: No available endpoint. Configure OPENAI_API_KEY or use DINOv2.");
    }
    /**
     * Embed video (via transcript)
     */
    async embedVideo(videoUrl, transcript) {
        // Embed transcript if available
        if (transcript) {
            return await this.embedText(transcript);
        }
        // Fallback: embed video URL as text
        return await this.embedText(videoUrl);
    }
    /**
     * Embed multiple modalities
     */
    async embedMultimodal(items) {
        const embeddings = [];
        for (const item of items) {
            try {
                let embedding;
                switch (item.type) {
                    case "text":
                        embedding = await this.embedText(item.content);
                        break;
                    case "image":
                        embedding = await this.embedImage(item.content);
                        break;
                    case "video":
                        embedding = await this.embedVideo(item.content, item.transcript);
                        break;
                    default:
                        continue;
                }
                embeddings.push(embedding);
            }
            catch (error) {
                console.warn(`Failed to embed ${item.type}:`, error);
            }
        }
        return embeddings;
    }
}
exports.MultimodalEmbeddings = MultimodalEmbeddings;
