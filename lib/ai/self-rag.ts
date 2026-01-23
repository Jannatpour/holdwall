/**
 * Self-RAG (Self-Reflective Retrieval-Augmented Generation)
 * 
 * Self-RAG uses a reflection mechanism to decide when to retrieve, when to generate,
 * and when to critique its own output. It includes special tokens for retrieval,
 * generation, and critique decisions.
 * 
 * Based on: "Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection" (2023)
 */

import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { RAGPipeline } from "./rag";
import { LLMProvider } from "@/lib/llm/providers";
import { logger } from "@/lib/logging/logger";
import type { Evidence } from "@/lib/evidence/vault";

export interface SelfRAGConfig {
  retrievalThreshold: number; // Confidence threshold for retrieval decision
  critiqueThreshold: number; // Quality threshold for critique decision
  maxIterations: number; // Maximum refinement iterations
  enableReflection: boolean; // Enable self-reflection and critique
}

export interface SelfRAGDecision {
  action: "retrieve" | "generate" | "critique" | "finish";
  confidence: number;
  reasoning: string;
}

export interface SelfRAGResult {
  response: string;
  evidence: Evidence[];
  iterations: number;
  decisions: SelfRAGDecision[];
  metadata: {
    retrievalCount: number;
    generationCount: number;
    critiqueCount: number;
    totalTime: number;
    tokensUsed: number;
    cost: number;
  };
}

export class SelfRAG {
  private ragPipeline: RAGPipeline;
  private llmProvider: LLMProvider;
  private config: SelfRAGConfig;

  constructor(
    evidenceVault: DatabaseEvidenceVault,
    config?: Partial<SelfRAGConfig>
  ) {
    this.ragPipeline = new RAGPipeline(evidenceVault);
    this.llmProvider = new LLMProvider();
    this.config = {
      retrievalThreshold: 0.6,
      critiqueThreshold: 0.7,
      maxIterations: 5,
      enableReflection: true,
      ...config,
    };
  }

  /**
   * Execute Self-RAG with self-reflection and critique
   */
  async execute(
    query: string,
    tenantId: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<SelfRAGResult> {
    const startTime = Date.now();
    const model = options?.model || "gpt-4o";
    const decisions: SelfRAGDecision[] = [];
    let evidence: Evidence[] = [];
    let response = "";
    let iterations = 0;
    let retrievalCount = 0;
    let generationCount = 0;
    let critiqueCount = 0;
    let totalTokens = 0;
    let totalCost = 0;

    // Initial decision: should we retrieve?
    let currentDecision = await this.decideAction(query, null, null, model);
    decisions.push(currentDecision);

    while (iterations < this.config.maxIterations) {
      iterations++;

      if (currentDecision.action === "retrieve") {
        // Retrieve relevant evidence
        retrievalCount++;
        const retrieved = await this.ragPipeline.retrieve(query, tenantId, {
          limit: 5,
          useReranking: true,
        });
        evidence = [...evidence, ...retrieved];

        // Generate with retrieved context
        const augmentedPrompt = this.buildAugmentedPrompt(query, evidence);
        const genResponse = await this.llmProvider.call({
          model,
          prompt: augmentedPrompt,
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 2000,
          system_prompt: "You are a helpful assistant. Answer the question using the provided evidence. Cite evidence IDs when referencing specific evidence.",
        });
        response = genResponse.text;
        generationCount++;
        totalTokens += genResponse.tokens_used;
        totalCost += genResponse.cost;

        // Decide next action: critique or finish?
        if (this.config.enableReflection) {
          currentDecision = await this.decideAction(query, response, evidence, model);
          decisions.push(currentDecision);
        } else {
          currentDecision = { action: "finish", confidence: 1.0, reasoning: "Reflection disabled" };
          decisions.push(currentDecision);
          break;
        }
      } else if (currentDecision.action === "critique") {
        // Critique and refine response
        critiqueCount++;
        const critique = await this.critiqueResponse(query, response, evidence, model);
        const refinedResponse = await this.refineResponse(query, response, critique, evidence, model, options);
        
        const refineResponse = await this.llmProvider.call({
          model,
          prompt: this.buildRefinementPrompt(query, response, critique, evidence),
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 2000,
        });
        response = refineResponse.text;
        generationCount++;
        totalTokens += refineResponse.tokens_used;
        totalCost += refineResponse.cost;

        // Decide next action: continue critique or finish?
        currentDecision = await this.decideAction(query, response, evidence, model);
        decisions.push(currentDecision);
      } else if (currentDecision.action === "generate") {
        // Generate without retrieval
        const genResponse = await this.llmProvider.call({
          model,
          prompt: query,
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 2000,
          system_prompt: "You are a helpful assistant. Answer the question directly based on your knowledge.",
        });
        response = genResponse.text;
        generationCount++;
        totalTokens += genResponse.tokens_used;
        totalCost += genResponse.cost;

        // Decide next action: critique or finish?
        if (this.config.enableReflection) {
          currentDecision = await this.decideAction(query, response, evidence, model);
          decisions.push(currentDecision);
        } else {
          currentDecision = { action: "finish", confidence: 1.0, reasoning: "Reflection disabled" };
          decisions.push(currentDecision);
          break;
        }
      } else {
        // Finish
        break;
      }
    }

    const totalTime = Date.now() - startTime;

    return {
      response,
      evidence,
      iterations,
      decisions,
      metadata: {
        retrievalCount,
        generationCount,
        critiqueCount,
        totalTime,
        tokensUsed: totalTokens,
        cost: totalCost,
      },
    };
  }

  /**
   * Decide next action: retrieve, generate, critique, or finish
   */
  private async decideAction(
    query: string,
    currentResponse: string | null,
    evidence: Evidence[] | null,
    model: string
  ): Promise<SelfRAGDecision> {
    let prompt = `You are a Self-RAG system that decides the next action for answering a query.

Query: "${query}"

`;

    if (currentResponse) {
      prompt += `Current Response: "${currentResponse.substring(0, 500)}"\n\n`;
    }

    if (evidence && evidence.length > 0) {
      prompt += `Retrieved Evidence: ${evidence.length} pieces\n\n`;
    } else {
      prompt += `No evidence retrieved yet.\n\n`;
    }

    prompt += `Decide the next action:
- "retrieve": If we need more information or current response is incomplete
- "generate": If we have enough information to generate a response (only if no response yet)
- "critique": If we have a response but need to improve it
- "finish": If the response is complete and satisfactory

Respond in JSON format:
{
  "action": "retrieve" | "generate" | "critique" | "finish",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

    try {
      const response = await this.llmProvider.call({
        model: "gpt-4o-mini", // Use fast model for decision making
        prompt,
        temperature: 0.1,
        max_tokens: 200,
      });

      const parsed = JSON.parse(response.text.trim());
      return {
        action: parsed.action || "finish",
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || "",
      };
    } catch (error) {
      logger.warn("Self-RAG: decision parsing failed, defaulting to finish", { error });
      return {
        action: "finish",
        confidence: 0.5,
        reasoning: "Decision parsing failed",
      };
    }
  }

  /**
   * Critique the current response
   */
  private async critiqueResponse(
    query: string,
    response: string,
    evidence: Evidence[],
    model: string
  ): Promise<string> {
    const prompt = `Critique this response to the query. Identify:
1. What is good about the response
2. What is missing or incorrect
3. How it could be improved
4. Whether it properly uses the evidence

Query: "${query}"
Response: "${response.substring(0, 1000)}"
Evidence: ${evidence.length} pieces

Provide a constructive critique:`;

    const critiqueResponse = await this.llmProvider.call({
      model: "gpt-4o-mini",
      prompt,
      temperature: 0.3,
      max_tokens: 500,
    });

    return critiqueResponse.text;
  }

  /**
   * Refine response based on critique
   */
  private async refineResponse(
    query: string,
    currentResponse: string,
    critique: string,
    evidence: Evidence[],
    model: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    const prompt = this.buildRefinementPrompt(query, currentResponse, critique, evidence);
    
    const refinedResponse = await this.llmProvider.call({
      model,
      prompt,
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens || 2000,
    });

    return refinedResponse.text;
  }

  /**
   * Build refinement prompt
   */
  private buildRefinementPrompt(
    query: string,
    currentResponse: string,
    critique: string,
    evidence: Evidence[]
  ): string {
    let prompt = `Query: ${query}\n\n`;
    prompt += `Current Response:\n${currentResponse}\n\n`;
    prompt += `Critique:\n${critique}\n\n`;

    if (evidence.length > 0) {
      prompt += `Evidence:\n`;
      for (const ev of evidence) {
        prompt += `[Evidence ID: ${ev.evidence_id}]\n${ev.content.normalized || ev.content.raw || ""}\n\n`;
      }
    }

    prompt += `Please refine the response based on the critique. Address all issues identified and improve the response quality.`;
    return prompt;
  }

  /**
   * Build augmented prompt with evidence
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
