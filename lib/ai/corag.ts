/**
 * Chain-of-Retrieval (CoRAG)
 * 
 * Model reasons step-by-step, dynamically reformulating queries
 * based on evolving internal states.
 */

import { RAGPipeline, RAGContext } from "./rag";

export interface CoRAGStep {
  step: number;
  query: string;
  retrieved: number;
  reasoning: string;
  nextQuery?: string;
}

export interface CoRAGResult {
  originalQuery: string;
  steps: CoRAGStep[];
  finalAnswer: string;
  confidence: number;
  totalRetrieved: number;
}

export class CoRAG {
  private ragPipeline: RAGPipeline;
  private openaiApiKey: string | null = null;

  constructor(ragPipeline: RAGPipeline) {
    this.ragPipeline = ragPipeline;
    this.openaiApiKey = process.env.OPENAI_API_KEY || null;
  }

  /**
   * Execute Chain-of-Retrieval
   */
  async execute(
    query: string,
    tenantId: string,
    options?: {
      maxSteps?: number;
      minConfidence?: number;
    }
  ): Promise<CoRAGResult> {
    const { maxSteps = 5, minConfidence = 0.7 } = options || {};

    const steps: CoRAGStep[] = [];
    let currentQuery = query;
    const allRetrieved: string[] = [];

    for (let step = 1; step <= maxSteps; step++) {
      // Retrieve for current query
      const context = await this.ragPipeline.buildContext(currentQuery, tenantId, { limit: 5 });

      // Track retrieved
      const retrievedIds = context.evidence.map(e => e.evidence_id);
      allRetrieved.push(...retrievedIds);

      // Reason about what we have and what we need
      const reasoning = await this.reasonAboutRetrieval(
        query,
        currentQuery,
        context,
        steps
      );

      // Determine if we need another step
      const needsMore = await this.needsMoreRetrieval(
        query,
        context,
        reasoning,
        minConfidence
      );

      steps.push({
        step,
        query: currentQuery,
        retrieved: retrievedIds.length,
        reasoning: reasoning.reasoning,
        nextQuery: needsMore.needMore ? needsMore.nextQuery : undefined,
      });

      // If we have enough, stop
      if (!needsMore.needMore) {
        break;
      }

      // Reformulate query for next step
      currentQuery = needsMore.nextQuery || currentQuery;
    }

    // Generate final answer
    const finalContext = await this.ragPipeline.buildContext(query, tenantId, { limit: 10 });
    const finalAnswer = await this.generateFinalAnswer(query, finalContext, steps);

    return {
      originalQuery: query,
      steps,
      finalAnswer,
      confidence: this.calculateConfidence(steps, finalContext),
      totalRetrieved: allRetrieved.length,
    };
  }

  /**
   * Reason about retrieval
   */
  private async reasonAboutRetrieval(
    originalQuery: string,
    currentQuery: string,
    context: RAGContext,
    previousSteps: CoRAGStep[]
  ): Promise<{ reasoning: string; gaps: string[] }> {
    if (!this.openaiApiKey) {
      return {
        reasoning: `Retrieved ${context.evidence.length} evidence items`,
        gaps: [],
      };
    }

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
              content: "Analyze what information has been retrieved and what gaps remain. Provide reasoning and identify missing information.",
            },
            {
              role: "user",
              content: `Original Query: ${originalQuery}\nCurrent Query: ${currentQuery}\nRetrieved: ${context.evidence.length} items\n\nWhat information do we have? What's missing?`,
            },
          ],
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const reasoning = data.choices[0]?.message?.content || "";

        // Extract gaps (simplified)
        const gaps: string[] = [];
        const gapPattern = /missing|need|gap|lack/gi;
        if (gapPattern.test(reasoning)) {
          // Would extract specific gaps in production
          gaps.push("Additional information needed");
        }

        return { reasoning, gaps };
      }
    } catch (error) {
      console.warn("Reasoning about retrieval failed:", error);
    }

    return {
      reasoning: `Retrieved ${context.evidence.length} evidence items`,
      gaps: [],
    };
  }

  /**
   * Determine if more retrieval is needed
   */
  private async needsMoreRetrieval(
    originalQuery: string,
    context: RAGContext,
    reasoning: { reasoning: string; gaps: string[] },
    minConfidence: number
  ): Promise<{ needMore: boolean; nextQuery?: string }> {
    // Check if we have enough evidence
    if (context.evidence.length >= 5 && context.metadata.relevance_scores[0] >= minConfidence) {
      return { needMore: false };
    }

    // Check if there are gaps
    if (reasoning.gaps.length > 0) {
      // Generate next query to fill gaps
      const nextQuery = await this.generateNextQuery(originalQuery, reasoning.gaps);
      return { needMore: true, nextQuery };
    }

    return { needMore: false };
  }

  /**
   * Generate next query to fill gaps
   */
  private async generateNextQuery(
    originalQuery: string,
    gaps: string[]
  ): Promise<string> {
    if (!this.openaiApiKey || gaps.length === 0) {
      return originalQuery;
    }

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
              content: "Generate a refined query to retrieve missing information.",
            },
            {
              role: "user",
              content: `Original: ${originalQuery}\nGaps: ${gaps.join(", ")}\n\nGenerate refined query:`,
            },
          ],
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0]?.message?.content || originalQuery;
      }
    } catch (error) {
      console.warn("Next query generation failed:", error);
    }

    return originalQuery;
  }

  /**
   * Generate final answer
   */
  private async generateFinalAnswer(
    query: string,
    context: RAGContext,
    steps: CoRAGStep[]
  ): Promise<string> {
    // Build answer from all retrieved evidence
    const evidenceTexts = context.evidence.map((ev, idx) => {
      const content = typeof ev.content === "string"
        ? ev.content
        : JSON.stringify(ev.content);
      return `[Evidence ${idx + 1}]: ${content.substring(0, 200)}`;
    }).join("\n\n");

    return `Based on ${steps.length} retrieval steps and ${context.evidence.length} evidence items:\n\n${evidenceTexts}`;
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(
    steps: CoRAGStep[],
    finalContext: RAGContext
  ): number {
    // Confidence based on number of steps and evidence quality
    const stepScore = Math.min(0.3, steps.length * 0.05);
    const evidenceScore = Math.min(0.5, finalContext.evidence.length * 0.1);
    const relevanceScore = finalContext.metadata.relevance_scores.length > 0
      ? finalContext.metadata.relevance_scores[0] * 0.2
      : 0;

    return stepScore + evidenceScore + relevanceScore;
  }
}
