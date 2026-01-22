/**
 * CRAG (Corrective Retrieval Augmented Generation)
 * 
 * Self-correcting RAG that introduces an explicit retrieve → critique → correct → re-retrieve loop
 * for low-quality retrieval situations. Based on: https://arxiv.org/abs/2401.15884
 * 
 * Why it matters: narratives are noisy and adversarial; CRAG dramatically reduces 
 * "confident but wrong" outputs.
 */

import type { Evidence } from "@/lib/evidence/vault";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { RAGPipeline } from "./rag";
import { LLMProvider } from "@/lib/llm/providers";
import { logger } from "@/lib/logging/logger";

export interface CRAGResult {
  query: string;
  evidence: Evidence[];
  context: string;
  corrections: CRAGCorrection[];
  metadata: {
    retrieval_count: number;
    retrieval_time_ms: number;
    critique_passes: number;
    correction_applied: boolean;
    relevance_scores: number[];
  };
}

export interface CRAGCorrection {
  pass: number;
  critique: string;
  action: "keep" | "correct" | "re-retrieve";
  confidence: number;
  reasoning: string;
}

export interface CRAGOptions {
  /** Maximum number of correction passes */
  max_passes?: number;
  /** Minimum relevance threshold for keeping evidence */
  min_relevance?: number;
  /** Whether to use query rewriting on correction */
  use_query_rewrite?: boolean;
  /** Initial retrieval limit */
  initial_limit?: number;
  /** Final evidence limit */
  final_limit?: number;
}

export class CRAGPipeline {
  private ragPipeline: RAGPipeline;
  private llmProvider: LLMProvider;
  private evidenceVault: DatabaseEvidenceVault;

  constructor(evidenceVault: DatabaseEvidenceVault) {
    this.evidenceVault = evidenceVault;
    this.ragPipeline = new RAGPipeline(evidenceVault);
    this.llmProvider = new LLMProvider();
  }

  /**
   * Retrieve with CRAG: retrieve → critique → correct → re-retrieve
   */
  async retrieve(
    query: string,
    tenant_id: string,
    options: CRAGOptions = {}
  ): Promise<CRAGResult> {
    const startTime = Date.now();
    const maxPasses = options.max_passes || 3;
    const minRelevance = options.min_relevance || 0.5;
    const initialLimit = options.initial_limit || 10;
    const finalLimit = options.final_limit || 5;

    let currentQuery = query;
    let evidence: Evidence[] = [];
    let corrections: CRAGCorrection[] = [];
    let pass = 0;

    while (pass < maxPasses) {
      pass++;

      // Step 1: Retrieve evidence
      const retrieved = await this.ragPipeline.retrieve(
        currentQuery,
        tenant_id,
        {
          limit: initialLimit,
          min_relevance: minRelevance,
          useReranking: true,
          useHybridSearch: true,
          useQueryRewriting: options.use_query_rewrite ?? true,
        }
      );

      if (retrieved.length === 0) {
        logger.warn("CRAG: No evidence retrieved", { query, tenant_id, pass });
        break;
      }

      // Step 2: Critique retrieval quality
      const critique = await this.critiqueRetrieval(query, retrieved, tenant_id);

      corrections.push(critique);

      // Step 3: Decide action based on critique
      if (critique.action === "keep" && critique.confidence >= minRelevance) {
        // Good enough, keep current evidence
        evidence = retrieved.slice(0, finalLimit);
        break;
      } else if (critique.action === "correct" || critique.action === "re-retrieve") {
        // Need correction or re-retrieval
        if (critique.action === "re-retrieve" && pass < maxPasses) {
          // Rewrite query based on critique
          currentQuery = await this.rewriteQuery(query, critique, retrieved);
          continue;
        } else {
          // Apply correction (filter/rerank based on critique)
          evidence = await this.applyCorrection(retrieved, critique, finalLimit);
          break;
        }
      } else {
        // Low confidence but no clear action - keep best evidence
        evidence = retrieved.slice(0, finalLimit);
        break;
      }
    }

    // If we exhausted passes, use best evidence we have
    if (evidence.length === 0 && corrections.length > 0) {
      const lastRetrieval = await this.ragPipeline.retrieve(
        currentQuery,
        tenant_id,
        { limit: finalLimit, min_relevance: minRelevance * 0.7 }
      );
      evidence = lastRetrieval;
    }

    // Build context
    const context = this.buildContext(evidence);

    // Calculate relevance scores
    const relevanceScores = await this.calculateRelevanceScores(query, evidence);

    return {
      query,
      evidence,
      context,
      corrections,
      metadata: {
        retrieval_count: evidence.length,
        retrieval_time_ms: Date.now() - startTime,
        critique_passes: pass,
        correction_applied: corrections.some((c) => c.action !== "keep"),
        relevance_scores: relevanceScores,
      },
    };
  }

  /**
   * Critique retrieval quality using LLM
   */
  private async critiqueRetrieval(
    query: string,
    evidence: Evidence[],
    tenant_id: string
  ): Promise<CRAGCorrection> {
    const evidenceTexts = evidence.map((ev, idx) => {
      const content = ev.content.normalized || ev.content.raw || "";
      return `[${idx + 1}] ${content.substring(0, 500)}...`;
    }).join("\n\n");

    const critiquePrompt = `You are a retrieval quality critic. Analyze whether the retrieved evidence is relevant to the query.

Query: "${query}"

Retrieved Evidence:
${evidenceTexts}

Analyze:
1. Are the retrieved items actually relevant to the query?
2. What is the overall relevance score (0-1)?
3. Should we keep these results, correct them (filter/rerank), or re-retrieve with a better query?

Respond in JSON format:
{
  "relevance_score": <0-1>,
  "action": "keep" | "correct" | "re-retrieve",
  "reasoning": "<explanation>",
  "confidence": <0-1>
}`;

    try {
      const response = await this.llmProvider.call({
        model: "gpt-4o-mini", // Use cheaper model for critique
        prompt: critiquePrompt,
        temperature: 0.3,
        max_tokens: 500,
        system_prompt: "You are a precise retrieval quality analyst. Always respond with valid JSON.",
      });

      const parsed = JSON.parse(response.text || "{}");
      
      return {
        pass: 0, // Will be set by caller
        critique: parsed.reasoning || "",
        action: parsed.action || "keep",
        confidence: Math.max(0, Math.min(1, parsed.relevance_score || 0.5)),
        reasoning: parsed.reasoning || "",
      };
    } catch (error) {
      logger.error("CRAG critique failed", { error, query, tenant_id });
      // Fallback: assume moderate quality
      return {
        pass: 0,
        critique: "Critique failed, using fallback",
        action: "keep",
        confidence: 0.5,
        reasoning: "LLM critique unavailable, defaulting to keep",
      };
    }
  }

  /**
   * Rewrite query based on critique
   */
  private async rewriteQuery(
    originalQuery: string,
    critique: CRAGCorrection,
    evidence: Evidence[]
  ): Promise<string> {
    const evidenceSummary = evidence
      .map((ev) => ev.content.normalized || ev.content.raw || "")
      .slice(0, 3)
      .join(" ");

    const rewritePrompt = `The original query retrieved evidence that was not sufficiently relevant.

Original Query: "${originalQuery}"
Critique: "${critique.reasoning}"

Sample Retrieved Evidence:
${evidenceSummary.substring(0, 500)}...

Rewrite the query to be more specific and better aligned with what we're actually looking for. 
Return only the rewritten query, nothing else.`;

    try {
      const response = await this.llmProvider.call({
        model: "gpt-4o-mini",
        prompt: rewritePrompt,
        temperature: 0.5,
        max_tokens: 200,
      });

      return response.text.trim();
    } catch (error) {
      logger.error("CRAG query rewrite failed", { error, originalQuery });
      return originalQuery; // Fallback to original
    }
  }

  /**
   * Apply correction to evidence (filter/rerank)
   */
  private async applyCorrection(
    evidence: Evidence[],
    critique: CRAGCorrection,
    limit: number
  ): Promise<Evidence[]> {
    // If critique suggests correction, try to filter out irrelevant items
    // For now, we'll use a simple approach: keep top items by score
    // In production, this could use the critique reasoning to filter more intelligently
    
    // Re-rank based on critique if available
    if (critique.reasoning.includes("irrelevant") || critique.confidence < 0.5) {
      // Filter out low-confidence items
      return evidence.slice(0, Math.max(1, Math.floor(evidence.length * critique.confidence))).slice(0, limit);
    }

    return evidence.slice(0, limit);
  }

  /**
   * Build context string from evidence
   */
  private buildContext(evidence: Evidence[]): string {
    return evidence
      .map((ev, idx) => {
        const content = ev.content.normalized || ev.content.raw || "";
        return `[Evidence ${idx + 1} (${ev.evidence_id})]\n${content}\nSource: ${ev.source.type}/${ev.source.id}\n`;
      })
      .join("\n---\n\n");
  }

  /**
   * Calculate relevance scores for evidence
   */
  private async calculateRelevanceScores(
    query: string,
    evidence: Evidence[]
  ): Promise<number[]> {
    // Use embedding similarity as relevance proxy
    const { EmbeddingService } = await import("@/lib/vector/embeddings");
    const embeddingService = new EmbeddingService();

    try {
      const queryEmbedding = await embeddingService.embed(query);
      
      const scores = await Promise.all(
        evidence.map(async (ev) => {
          const content = ev.content.normalized || ev.content.raw || "";
          if (!content.trim()) return 0;
          
          const evEmbedding = await embeddingService.embed(content);
          return embeddingService.cosineSimilarity(
            queryEmbedding.vector,
            evEmbedding.vector
          );
        })
      );

      return scores;
    } catch (error) {
      logger.error("CRAG relevance calculation failed", { error });
      // Return uniform scores as fallback
      return evidence.map(() => 0.5);
    }
  }
}
