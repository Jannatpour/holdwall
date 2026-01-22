/**
 * Open-Source Embeddings
 * 
 * NVIDIA NV-Embed-v2, Qwen3-Embedding, BAAI BGE-M3
 * for local/self-hosted deployments.
 */

export interface OpenSourceEmbedding {
  vector: number[];
  model: string;
  dimensions: number;
}

export class OpenSourceEmbeddings {
  private nvidiaApiKey: string | null = null;
  private nvidiaBaseUrl: string;
  private huggingfaceApiKey: string | null = null;

  constructor() {
    this.nvidiaApiKey = process.env.NVIDIA_API_KEY || null;
    this.nvidiaBaseUrl = process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1";
    this.huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY || null;
  }

  /**
   * Embed with NVIDIA NV-Embed-v2 via NIM API
   * Supports query/passage input types and Matryoshka dimensions
   */
  async embedWithNVIDIA(
    text: string,
    options?: {
      inputType?: "query" | "passage";
      dimensions?: number;
      useLocal?: boolean;
    }
  ): Promise<OpenSourceEmbedding> {
    const { inputType = "passage", dimensions, useLocal = false } = options || {};
    const model = useLocal
      ? "nvidia/nv-embed-v2"
      : "nvidia/llama-3.2-nv-embedqa-1b-v2";

    // Try NVIDIA NIM API (local or hosted)
    const nimUrl = useLocal
      ? (process.env.NVIDIA_NIM_LOCAL_URL || "http://localhost:8000/v1")
      : (this.nvidiaBaseUrl || "https://ai.api.nvidia.com/v1/retrieval/nvidia/embeddings");

    if (this.nvidiaApiKey || useLocal) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (this.nvidiaApiKey && !useLocal) {
          headers["Authorization"] = `Bearer ${this.nvidiaApiKey}`;
        }

        const url = useLocal ? `${nimUrl}/embeddings` : nimUrl;
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            input: [text],
            model: useLocal ? model : `${model}-${inputType}`,
            ...(dimensions ? { dimensions } : {}),
            ...(useLocal ? {} : { input_type: inputType }),
            encoding_format: "float",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const embedding = Array.isArray(data.data)
            ? data.data[0]?.embedding
            : data.embedding?.values || data.embedding;

          if (embedding && Array.isArray(embedding)) {
            return {
              vector: embedding,
              model: data.model || model,
              dimensions: embedding.length,
            };
          }
        }
      } catch (error) {
        console.warn("NVIDIA NIM embedding failed, trying Hugging Face:", error);
      }
    }

    // Fallback: Hugging Face Inference API
    if (this.huggingfaceApiKey) {
      try {
        const hfResponse = await fetch(
          `https://api-inference.huggingface.co/pipeline/feature-extraction/nvidia/nv-embed-v2`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.huggingfaceApiKey}`,
            },
            body: JSON.stringify({ inputs: text }),
          }
        );

        if (hfResponse.ok) {
          const embedding = await hfResponse.json();
          if (Array.isArray(embedding) && embedding.length > 0) {
            return {
              vector: Array.isArray(embedding[0]) ? embedding[0] : embedding,
              model: "nvidia/nv-embed-v2",
              dimensions: Array.isArray(embedding[0]) ? embedding[0].length : embedding.length,
            };
          }
        }
      } catch (error) {
        console.warn("Hugging Face NVIDIA fallback failed:", error);
      }
    }

    throw new Error(
      "NVIDIA embedding failed: No available endpoint. Configure NVIDIA_API_KEY or NVIDIA_NIM_LOCAL_URL."
    );
  }

  /**
   * Embed with Qwen3-Embedding
   * Supports OpenAI-compatible APIs (Azure, OpenRouter, Fireworks) and Hugging Face
   */
  async embedWithQwen(
    text: string,
    options?: {
      dimensions?: number;
      normalize?: boolean;
      truncate?: boolean;
    }
  ): Promise<OpenSourceEmbedding> {
    const { dimensions, normalize = true, truncate = true } = options || {};
    const model = "qwen3-embedding-8b";
    const qwenApiUrl = process.env.QWEN_API_URL || "https://api.openrouter.ai/v1";
    const qwenApiKey = process.env.QWEN_API_KEY || process.env.OPENROUTER_API_KEY || null;

    // Try OpenAI-compatible endpoint (OpenRouter, Fireworks, Azure, etc.)
    if (qwenApiKey) {
      try {
        const response = await fetch(`${qwenApiUrl}/embeddings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${qwenApiKey}`,
          },
          body: JSON.stringify({
            model,
            input: text,
            ...(dimensions ? { dimensions } : {}),
            normalize,
            truncate,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const embedding = Array.isArray(data.data)
            ? data.data[0]?.embedding
            : data.embedding?.values || data.embedding;

          if (embedding && Array.isArray(embedding)) {
            return {
              vector: embedding,
              model: data.model || model,
              dimensions: embedding.length,
            };
          }
        }
      } catch (error) {
        console.warn("Qwen API embedding failed, trying Hugging Face:", error);
      }
    }

    // Fallback: Hugging Face Inference API
    if (this.huggingfaceApiKey) {
      try {
        const hfResponse = await fetch(
          "https://api-inference.huggingface.co/pipeline/feature-extraction/Qwen/Qwen3-Embedding-8B",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.huggingfaceApiKey}`,
            },
            body: JSON.stringify({
              inputs: text,
              options: { wait_for_model: true },
            }),
          }
        );

        if (hfResponse.ok) {
          const embedding = await hfResponse.json();
          if (Array.isArray(embedding) && embedding.length > 0) {
            return {
              vector: Array.isArray(embedding[0]) ? embedding[0] : embedding,
              model: "Qwen/Qwen3-Embedding-8B",
              dimensions: Array.isArray(embedding[0]) ? embedding[0].length : embedding.length,
            };
          }
        }
      } catch (error) {
        console.warn("Hugging Face Qwen fallback failed:", error);
      }
    }

    throw new Error(
      "Qwen embedding failed: No available endpoint. Configure QWEN_API_KEY or HUGGINGFACE_API_KEY."
    );
  }

  /**
   * Embed with BAAI BGE-M3
   * Supports OpenAI-compatible APIs (DeepInfra, OpenRouter) and Hugging Face
   */
  async embedWithBGE(
    text: string,
    options?: {
      normalize?: boolean;
    }
  ): Promise<OpenSourceEmbedding> {
    const { normalize = true } = options || {};
    const model = "baai/bge-m3";
    const bgeApiUrl = process.env.BGE_API_URL || "https://api.deepinfra.com/v1";
    const bgeApiKey = process.env.BGE_API_KEY || process.env.DEEPINFRA_API_KEY || null;

    // Try OpenAI-compatible endpoint (DeepInfra, OpenRouter)
    if (bgeApiKey && bgeApiUrl) {
      try {
        const response = await fetch(`${bgeApiUrl}/embeddings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${bgeApiKey}`,
          },
          body: JSON.stringify({
            model: "BAAI/bge-m3",
            input: text,
            normalize,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const embedding = Array.isArray(data.data)
            ? data.data[0]?.embedding
            : data.embedding?.values || data.embedding;

          if (embedding && Array.isArray(embedding)) {
            return {
              vector: embedding,
              model: data.model || model,
              dimensions: embedding.length,
            };
          }
        }
      } catch (error) {
        console.warn("BGE API embedding failed, trying Hugging Face:", error);
      }
    }

    // Fallback: Hugging Face Inference API
    if (this.huggingfaceApiKey) {
      try {
        const hfResponse = await fetch(
          "https://api-inference.huggingface.co/pipeline/feature-extraction/BAAI/bge-m3",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.huggingfaceApiKey}`,
            },
            body: JSON.stringify({
              inputs: text,
              options: { wait_for_model: true },
            }),
          }
        );

        if (hfResponse.ok) {
          const embedding = await hfResponse.json();
          if (Array.isArray(embedding) && embedding.length > 0) {
            return {
              vector: Array.isArray(embedding[0]) ? embedding[0] : embedding,
              model: "BAAI/bge-m3",
              dimensions: Array.isArray(embedding[0]) ? embedding[0].length : embedding.length,
            };
          }
        }
      } catch (error) {
        console.warn("Hugging Face BGE fallback failed:", error);
      }
    }

    throw new Error(
      "BGE-M3 embedding failed: No available endpoint. Configure BGE_API_KEY and BGE_API_URL, or HUGGINGFACE_API_KEY."
    );
  }

  /**
   * Generate text-based embedding (fallback when API unavailable)
   * Uses hash-based approach with text content for better semantic properties
   */
  private generateTextBasedEmbedding(text: string, dimensions: number): number[] {
    const hash = this.simpleHash(text);
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const embedding = new Array(dimensions).fill(0);

    // Use word positions and frequencies to create more meaningful embeddings
    for (let i = 0; i < words.length; i++) {
      const wordHash = this.simpleHash(words[i]);
      for (let j = 0; j < dimensions; j++) {
        const seed = (hash + wordHash + i * 1000 + j) % 10000;
        embedding[j] += Math.sin(seed) * (1.0 / (words.length + 1));
      }
    }

    // Normalize to unit vector
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      return embedding.map(val => val / norm);
    }

    // Fallback if normalization fails
    return embedding.map((_, i) => {
      const seed = (hash + i) % 1000;
      return Math.sin(seed) * 0.5 + 0.5;
    });
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
