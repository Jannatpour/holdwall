/**
 * Semantic Search API
 * 
 * Endpoints for vector embeddings and semantic search
 */

import { NextRequest, NextResponse } from "next/server";
import { VectorEmbeddings } from "@/lib/search/embeddings";
import { MultimodalEmbeddings } from "@/lib/search/multimodal-embeddings";
import { PineconeVectorDB } from "@/lib/search/vector-db-pinecone";
import { QdrantVectorDB } from "@/lib/search/vector-db-qdrant";
import { FAISSVectorDB } from "@/lib/search/vector-db-faiss";
import { ChromaVectorDB } from "@/lib/search/vector-db-chroma";
import { OpenSearchVectorDB } from "@/lib/search/vector-db-opensearch";
import { ANNAlgorithms } from "@/lib/search/ann-algorithms";
import { Reranker } from "@/lib/search/reranking";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { logger } from "@/lib/logging/logger";
import { createHash } from "crypto";
import { z } from "zod";

const embeddingModelSchema = z.enum(["voyage", "gemini", "openai", "auto"]);

const embedRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("embed"),
    text: z.string().min(1),
    model: embeddingModelSchema.optional(),
    dimensions: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal("embed-batch"),
    texts: z.array(z.string().min(1)).min(1),
    model: embeddingModelSchema.optional(),
  }),
  z.object({
    action: z.literal("embed-multimodal"),
    items: z.array(
      z.object({
        type: z.enum(["text", "image", "video"]),
        content: z.string().min(1),
        transcript: z.string().optional(),
      })
    ).min(1),
  }),
]);

const queryRequestSchema = z.object({
  provider: z.enum(["pinecone", "qdrant", "faiss", "chroma", "opensearch"]),
  query: z.string().min(1),
  topK: z.number().int().min(1).max(200).optional().default(10),
  filter: z.record(z.string(), z.unknown()).optional(),
  useReranking: z.boolean().optional(),
  rerankingModel: z.enum(["qwen", "cross-encoder", "bge-reranker"]).optional(),
});

const similarityRequestSchema = z.object({
  vec1: z.array(z.number()).min(1),
  vec2: z.array(z.number()).min(1),
  metric: z.enum(["cosine", "euclidean", "dot"]).optional().default("cosine"),
});

/**
 * POST /api/ai/semantic-search/embed
 * Generate embeddings for text
 * 
 * Note: This endpoint may be intentionally public for certain AI model access patterns
 * Consider adding authentication if this should be restricted
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = embedRequestSchema.parse(body);

    if (validated.action === "embed") {
      const embeddings = new VectorEmbeddings();
      const result = await embeddings.embed(validated.text, {
        model: validated.model,
        dimensions: validated.dimensions,
      });
      return NextResponse.json(result);
    }

    if (validated.action === "embed-batch") {
      const embeddings = new VectorEmbeddings();
      const results = await embeddings.embedBatch(validated.texts, { model: validated.model });
      return NextResponse.json(results);
    }

    if (validated.action === "embed-multimodal") {
      const multimodal = new MultimodalEmbeddings();
      const results = await multimodal.embedMultimodal(validated.items);
      return NextResponse.json(results);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    const msg = error instanceof Error ? error.message : String(error);
    const lower = msg.toLowerCase();
    const quota =
      lower.includes("exceeded your current quota") ||
      lower.includes("check your plan and billing") ||
      lower.includes("insufficient_quota") ||
      lower.includes("providers unavailable");
    logger.error("Semantic search error", {
      error: msg,
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (quota) {
      return NextResponse.json(
        { error: "AI provider unavailable", message: msg },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: msg || "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/semantic-search/query
 * Query vector database
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = queryRequestSchema.parse(body);
    const { provider, query, topK, filter } = validated;

    const embeddings = new VectorEmbeddings();
    const queryEmbedding = await embeddings.embed(query);

    let results;

    switch (provider) {
      case "pinecone":
        const pinecone = new PineconeVectorDB();
        results = await pinecone.query(queryEmbedding.vector, { topK, filter });
        break;

      case "qdrant":
        const qdrant = new QdrantVectorDB();
        results = await qdrant.query(queryEmbedding.vector, { limit: topK, filter });
        break;

      case "faiss":
        // FAISS requires pre-loaded vectors, would need to be initialized with data
        return NextResponse.json(
          { error: "FAISS requires pre-initialized index" },
          { status: 400 }
        );

      case "chroma":
        const chroma = new ChromaVectorDB();
        results = await chroma.query(queryEmbedding.vector, { nResults: topK, where: filter });
        break;

      case "opensearch":
        const opensearch = new OpenSearchVectorDB();
        results = await opensearch.search(queryEmbedding.vector, { size: topK, filter });
        break;

      default:
        return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    // Apply reranking if requested
    let finalResults = results;
    if (validated.useReranking) {
      const evidenceVault = new DatabaseEvidenceVault();
      const reranker = new Reranker();
      
      // Convert results to reranker documents (no synthetic Evidence records)
      const docsWithOrigin = await Promise.all(
        results.map(async (r: any) => {
          const stableId =
            r.id ||
            `doc_${createHash("sha256")
              .update(String(r.text || r.metadata?.text || ""))
              .digest("hex")
              .slice(0, 24)}`;

          // Prefer canonical evidence content when the result references a stored evidence ID.
          if (r.id) {
            const ev = await evidenceVault.get(r.id);
            if (ev) {
              return {
                id: ev.evidence_id,
                text: `${ev.content.raw || ""} ${ev.content.normalized || ""}`.trim(),
                metadata: ((ev as any).metadata ?? (ev as any).content?.metadata ?? {}) as Record<string, unknown>,
              };
            }
          }

          // Otherwise, rerank directly on returned text/metadata.
          const text = String(r.text || r.metadata?.text || "");
          return { origin: r, doc: {
            id: stableId,
            text,
            metadata: (r.metadata || {}) as Record<string, unknown>,
          }};
        })
      );

      const documents = docsWithOrigin.map((d) => ("doc" in d ? (d as any).doc : d));
      const originByDocId = new Map<string, any>();
      for (const item of docsWithOrigin as any[]) {
        const doc = item.doc ?? item;
        const origin = item.origin ?? null;
        if (origin) {
          originByDocId.set(doc.id, origin);
        } else {
          // Fallback: if we built from evidence get(), origin is still r (has id)
          originByDocId.set(doc.id, { id: doc.id, metadata: doc.metadata, text: doc.text });
        }
      }

      const reranked = await reranker.rerank(
        query,
        documents,
        {
          model: (validated.rerankingModel as any) || "cross-encoder",
          topK: topK,
        }
      );
      
      // Map reranked docs back to original vector results (use reranked doc id as key)
      finalResults = reranked
        .map((rr) => {
          const origin = originByDocId.get(rr.id);
          if (!origin) return null;
          return {
            ...origin,
            score: rr.score ?? origin.score,
            metadata: {
              ...(origin.metadata || {}),
              reranking: {
                rank: rr.rank,
                originalRank: rr.originalRank,
              },
            },
          };
        })
        .filter(Boolean);
    }

    return NextResponse.json({
      query,
      results: finalResults,
      model: queryEmbedding.model,
      dimensions: queryEmbedding.dimensions,
      reranked: validated.useReranking || false,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    logger.error("Vector query error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/semantic-search/similarity
 * Calculate similarity between vectors
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = similarityRequestSchema.parse(body);
    const { vec1, vec2, metric } = validated;

    const ann = new ANNAlgorithms();

    let similarity: number;
    let distance: number;

    switch (metric) {
      case "cosine":
        similarity = ann.cosineSimilarity(vec1, vec2);
        distance = 1 - similarity;
        break;

      case "euclidean":
        distance = ann.euclideanDistance(vec1, vec2);
        similarity = 1 / (1 + distance);
        break;

      case "dot":
        similarity = ann.dotProduct(vec1, vec2);
        distance = -similarity;
        break;

      default:
        return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
    }

    return NextResponse.json({
      similarity,
      distance,
      metric,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    logger.error("Similarity calculation error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
