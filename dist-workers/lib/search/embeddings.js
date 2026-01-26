"use strict";
/**
 * Vector Embeddings (Production Models)
 *
 * Proprietary embedding models: Voyage AI, Google Gemini, OpenAI
 * for production use.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorEmbeddings = void 0;
const embeddings_1 = require("../vector/embeddings");
class VectorEmbeddings {
    constructor() {
        this.voyageApiKey = null;
        this.googleApiKey = null;
        this.embeddingService = new embeddings_1.EmbeddingService();
        this.voyageApiKey = process.env.VOYAGE_API_KEY || null;
        this.googleApiKey = process.env.GOOGLE_API_KEY || null;
    }
    /**
     * Embed text using best available model
     */
    async embed(text, options) {
        const { model = "auto", dimensions } = options || {};
        // Auto-select best available
        if (model === "auto") {
            if (this.voyageApiKey) {
                return await this.embedWithVoyage(text, dimensions);
            }
            else if (this.googleApiKey) {
                return await this.embedWithGemini(text, dimensions);
            }
            else {
                return await this.embedWithOpenAI(text, dimensions);
            }
        }
        switch (model) {
            case "voyage":
                return await this.embedWithVoyage(text, dimensions);
            case "gemini":
                return await this.embedWithGemini(text, dimensions);
            case "openai":
                return await this.embedWithOpenAI(text, dimensions);
            default:
                return await this.embedWithOpenAI(text, dimensions);
        }
    }
    /**
     * Embed with Voyage AI
     */
    async embedWithVoyage(text, dimensions) {
        if (!this.voyageApiKey) {
            throw new Error("Voyage API key not configured. Set VOYAGE_API_KEY environment variable.");
        }
        try {
            const response = await fetch("https://api.voyageai.com/v1/embeddings", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.voyageApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: dimensions === 1024 ? "voyage-3" : "voyage-3.5",
                    input: text,
                    input_type: "document",
                    truncation: "END",
                }),
            });
            if (!response.ok) {
                throw new Error(`Voyage API error: ${response.statusText}`);
            }
            const data = await response.json();
            return {
                vector: data.data[0].embedding,
                model: "voyage-3.5",
                dimensions: data.data[0].embedding.length,
                cost: 0.0001, // Approximate cost
            };
        }
        catch (error) {
            throw new Error(`Voyage embedding failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Embed with Google Gemini
     */
    async embedWithGemini(text, dimensions) {
        if (!this.googleApiKey) {
            throw new Error("Google API key not configured. Set GOOGLE_API_KEY environment variable.");
        }
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${this.googleApiKey}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "models/text-embedding-004",
                    content: {
                        parts: [{ text }],
                    },
                    taskType: "RETRIEVAL_DOCUMENT",
                }),
            });
            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.statusText}`);
            }
            const data = await response.json();
            return {
                vector: data.embedding.values,
                model: "text-embedding-004",
                dimensions: data.embedding.values.length,
                cost: 0.0001,
            };
        }
        catch (error) {
            throw new Error(`Gemini embedding failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Embed with OpenAI
     */
    async embedWithOpenAI(text, dimensions) {
        // Use existing EmbeddingService
        const result = await this.embeddingService.embed(text, dimensions === 1024 ? "text-embedding-3-small" : "text-embedding-3-large");
        return {
            vector: result.vector,
            model: result.model,
            dimensions: result.dimensions,
        };
    }
    /**
     * Batch embed
     */
    async embedBatch(texts, options) {
        return Promise.all(texts.map(text => this.embed(text, options)));
    }
}
exports.VectorEmbeddings = VectorEmbeddings;
