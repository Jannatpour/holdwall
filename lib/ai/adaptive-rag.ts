/**
 * Adaptive RAG (Retrieval-Augmented Generation)
 * 
 * Adaptive RAG dynamically decides whether to retrieve, generate, or skip retrieval
 * based on query complexity and confidence thresholds. This optimizes cost and latency
 * while maintaining quality for simple queries that don't require retrieval.
 * 
 * Based on: "Adaptive-RAG: Learning to Adapt Retrieval-Augmented Large Language Models
 * through Question Complexity" (2024)
 */

import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { RAGPipeline } from "./rag";
import { LLMProvider } from "@/lib/llm/providers";
import { logger } from "@/lib/logging/logger";
import type { Evidence } from "@/lib/evidence/vault";

export interface AdaptiveRAGConfig {
  complexityThreshold: number; // 0-1, queries above this require retrieval
  confidenceThreshold: number; // 0-1, queries below this require retrieval
  maxRetrievalAttempts: number;
  enableSkipRetrieval: boolean; // Allow skipping retrieval for simple queries
}

export interface AdaptiveRAGResult {
  response: string;
  evidence: Evidence[];
  strategy: "retrieve" | "generate" | "skip";
  complexity: number;
  confidence: number;
  metadata: {
    retrievalTime?: number;
    generationTime: number;
    totalTime: number;
    tokensUsed: number;
    cost: number;
  };
}

export class AdaptiveRAG {
  private ragPipeline: RAGPipeline;
  private llmProvider: LLMProvider;
  private config: AdaptiveRAGConfig;

  constructor(
    evidenceVault: DatabaseEvidenceVault,
    config?: Partial<AdaptiveRAGConfig>
  ) {
    this.ragPipeline = new RAGPipeline(evidenceVault);
    this.llmProvider = new LLMProvider();
    this.config = {
      complexityThreshold: 0.5,
      confidenceThreshold: 0.7,
      maxRetrievalAttempts: 3,
      enableSkipRetrieval: true,
      ...config,
    };
  }

  /**
   * Execute adaptive RAG: decide strategy based on query complexity
   */
  async execute(
    query: string,
    tenantId: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<AdaptiveRAGResult> {
    const startTime = Date.now();
    const model = options?.model || "gpt-4o-mini";

    // Step 1: Assess query complexity
    const complexity = await this.assessComplexity(query, model);
    logger.info("Adaptive RAG: query complexity assessed", {
      query: query.substring(0, 100),
      complexity,
      tenantId,
    });

    // Step 2: Decide strategy
    let strategy: "retrieve" | "generate" | "skip";
    if (this.config.enableSkipRetrieval && complexity < 0.3) {
      // Very simple queries - skip retrieval
      strategy = "skip";
    } else if (complexity >= this.config.complexityThreshold) {
      // Complex queries - require retrieval
      strategy = "retrieve";
    } else {
      // Medium complexity - try generation first, fallback to retrieval if low confidence
      strategy = "generate";
    }

    // Step 3: Execute strategy
    let response: string;
    let evidence: Evidence[] = [];
    let confidence = 0;
    let retrievalTime = 0;
    let generationTime = 0;
    let tokensUsed = 0;
    let cost = 0;

    if (strategy === "skip") {
      // Direct generation without retrieval
      const genStart = Date.now();
      const llmResponse = await this.llmProvider.call({
        model,
        prompt: query,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 2000,
        system_prompt: "You are a helpful assistant. Answer the question directly based on your knowledge.",
      });
      generationTime = Date.now() - genStart;
      response = llmResponse.text;
      confidence = await this.assessConfidence(query, response, model);
      tokensUsed = llmResponse.tokens_used;
      cost = llmResponse.cost;
    } else if (strategy === "generate") {
      // Try generation first, check confidence
      const genStart = Date.now();
      const llmResponse = await this.llmProvider.call({
        model,
        prompt: query,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 2000,
        system_prompt: "You are a helpful assistant. Answer the question directly based on your knowledge.",
      });
      generationTime = Date.now() - genStart;
      response = llmResponse.text;
      confidence = await this.assessConfidence(query, response, model);
      tokensUsed = llmResponse.tokens_used;
      cost = llmResponse.cost;

      // If confidence is low, fallback to retrieval
      if (confidence < this.config.confidenceThreshold) {
        logger.info("Adaptive RAG: low confidence, falling back to retrieval", {
          confidence,
          query: query.substring(0, 100),
        });
        const retStart = Date.now();
        const retrieved = await this.ragPipeline.retrieve(query, tenantId, {
          limit: 5,
          useReranking: true,
        });
        retrievalTime = Date.now() - retStart;
        evidence = retrieved;

        // Regenerate with retrieved context
        const augmentedPrompt = this.buildAugmentedPrompt(query, retrieved);
        const regenStart = Date.now();
        const regenResponse = await this.llmProvider.call({
          model,
          prompt: augmentedPrompt,
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 2000,
          system_prompt: "You are a helpful assistant. Answer the question using the provided evidence. Cite evidence IDs when referencing specific evidence.",
        });
        generationTime += Date.now() - regenStart;
        response = regenResponse.text;
        confidence = await this.assessConfidence(query, response, model);
        tokensUsed += regenResponse.tokens_used;
        cost += regenResponse.cost;
        strategy = "retrieve"; // Update strategy to reflect actual execution
      }
    } else {
      // Strategy: retrieve
      const retStart = Date.now();
      const retrieved = await this.ragPipeline.retrieve(query, tenantId, {
        limit: 5,
        useReranking: true,
      });
      retrievalTime = Date.now() - retStart;
      evidence = retrieved;

      // Generate with retrieved context
      const augmentedPrompt = this.buildAugmentedPrompt(query, retrieved);
      const genStart = Date.now();
      const llmResponse = await this.llmProvider.call({
        model,
        prompt: augmentedPrompt,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 2000,
        system_prompt: "You are a helpful assistant. Answer the question using the provided evidence. Cite evidence IDs when referencing specific evidence.",
      });
      generationTime = Date.now() - genStart;
      response = llmResponse.text;
      confidence = await this.assessConfidence(query, response, model);
      tokensUsed = llmResponse.tokens_used;
      cost = llmResponse.cost;
    }

    const totalTime = Date.now() - startTime;

    return {
      response,
      evidence,
      strategy,
      complexity,
      confidence,
      metadata: {
        retrievalTime: retrievalTime > 0 ? retrievalTime : undefined,
        generationTime,
        totalTime,
        tokensUsed,
        cost,
      },
    };
  }

  /**
   * Assess query complexity (0-1, higher = more complex)
   */
  private async assessComplexity(query: string, model: string): Promise<number> {
    const prompt = `Assess the complexity of this query on a scale of 0-1, where:
- 0.0-0.3: Simple factual question (e.g., "What is X?")
- 0.3-0.6: Moderate complexity requiring some reasoning
- 0.6-0.8: Complex query requiring multiple pieces of information
- 0.8-1.0: Very complex query requiring deep analysis or synthesis

Query: "${query}"

Respond with only a number between 0 and 1.`;

    try {
      const response = await this.llmProvider.call({
        model: "gpt-4o-mini", // Use fast model for complexity assessment
        prompt,
        temperature: 0.1,
        max_tokens: 10,
      });

      const complexity = parseFloat(response.text.trim());
      if (isNaN(complexity) || complexity < 0 || complexity > 1) {
        // Default to medium complexity if parsing fails
        return 0.5;
      }
      return complexity;
    } catch (error) {
      logger.warn("Adaptive RAG: complexity assessment failed, defaulting to 0.5", { error });
      return 0.5;
    }
  }

  /**
   * Assess response confidence (0-1, higher = more confident)
   */
  private async assessConfidence(query: string, response: string, model: string): Promise<number> {
    const prompt = `Assess how confident you are that this response adequately answers the query on a scale of 0-1, where:
- 0.0-0.4: Low confidence, response is incomplete or uncertain
- 0.4-0.7: Moderate confidence, response is adequate but could be improved
- 0.7-1.0: High confidence, response fully addresses the query

Query: "${query}"
Response: "${response.substring(0, 500)}"

Respond with only a number between 0 and 1.`;

    try {
      const llmResponse = await this.llmProvider.call({
        model: "gpt-4o-mini", // Use fast model for confidence assessment
        prompt,
        temperature: 0.1,
        max_tokens: 10,
      });

      const confidence = parseFloat(llmResponse.text.trim());
      if (isNaN(confidence) || confidence < 0 || confidence > 1) {
        return 0.5;
      }
      return confidence;
    } catch (error) {
      logger.warn("Adaptive RAG: confidence assessment failed, defaulting to 0.5", { error });
      return 0.5;
    }
  }

  /**
   * Build augmented prompt with retrieved evidence
   */
  private buildAugmentedPrompt(query: string, evidence: Evidence[]): string {
    let prompt = `Query: ${query}\n\n`;
    prompt += `Evidence Context:\n`;

    for (const ev of evidence) {
      prompt += `[Evidence ID: ${ev.evidence_id}]\n`;
      prompt += `${ev.content.normalized || ev.content.raw || ""}\n\n`;
    }

    prompt += `Please provide a comprehensive answer based on the evidence above. Cite evidence IDs when referencing specific evidence.`;
    return prompt;
  }
}
