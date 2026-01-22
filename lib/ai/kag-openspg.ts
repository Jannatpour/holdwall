/**
 * OpenSPG KAG Engine
 * 
 * Logical form-guided reasoning handling complex, multi-hop factual queries.
 * Uses knowledge-chunk mutual indexing integrating contextual text with structured knowledge.
 */

import { KAGPipeline, KAGContext } from "./kag";

export interface OpenSPGQuery {
  query: string;
  logicalForm?: string; // SPG logical form
  multiHop?: boolean;
  maxHops?: number;
}

export interface OpenSPGResult {
  query: string;
  answer: string;
  reasoning: Array<{
    hop: number;
    retrieved: string[];
    reasoning: string;
  }>;
  confidence: number;
  sources: string[];
}

export class OpenSPGKAG {
  private kagPipeline: KAGPipeline;

  constructor() {
    this.kagPipeline = new KAGPipeline();
  }

  /**
   * Execute OpenSPG-style multi-hop reasoning
   */
  async execute(
    query: OpenSPGQuery,
    tenantId: string
  ): Promise<OpenSPGResult> {
    const { query: queryText, multiHop = true, maxHops = 3 } = query;

    if (!multiHop) {
      // Single-hop query
      const context = await this.kagPipeline.retrieve(queryText, tenantId);
      const answer = await this.generateAnswer(queryText, context, []);
      return {
        query: queryText,
        answer: answer.text,
        reasoning: [],
        confidence: answer.confidence,
        sources: context.nodes.map(n => n.node_id),
      };
    }

    // Multi-hop reasoning
    const reasoning: OpenSPGResult["reasoning"] = [];
    let currentContext: KAGContext | null = null;
    const allSources: string[] = [];

    for (let hop = 1; hop <= maxHops; hop++) {
      // Retrieve context for current hop
      const retrieved = await this.kagPipeline.retrieve(
        queryText,
        tenantId,
        { max_nodes: 10, max_depth: hop }
      );

      // Track reasoning
      reasoning.push({
        hop,
        retrieved: retrieved.nodes.map(n => n.node_id),
        reasoning: `Retrieved ${retrieved.nodes.length} nodes at depth ${hop}`,
      });

      allSources.push(...retrieved.nodes.map(n => n.node_id));

      // Check if we have enough information
      if (retrieved.nodes.length >= 5) {
        currentContext = retrieved;
        break;
      }

      // If not enough, continue to next hop
      currentContext = retrieved;
    }

    // Generate answer from accumulated context
    const answer = await this.generateAnswer(queryText, currentContext!, reasoning);

    return {
      query: queryText,
      answer: answer.text,
      reasoning,
      confidence: answer.confidence,
      sources: [...new Set(allSources)],
    };
  }

  /**
   * Generate answer from context
   */
  private async generateAnswer(
    query: string,
    context: KAGContext,
    reasoning: OpenSPGResult["reasoning"]
  ): Promise<{ text: string; confidence: number }> {
    // Build answer from knowledge graph context
    const answerParts: string[] = [];

    // Use nodes to construct answer
    for (const node of context.nodes) {
      if (this.isRelevant(node.content, query)) {
        answerParts.push(node.content);
      }
    }

    const answer = answerParts.length > 0
      ? answerParts.join(". ")
      : "Unable to generate answer from knowledge graph.";

    // Calculate confidence based on node trust scores
    const avgTrust = context.nodes.length > 0
      ? context.nodes.reduce((sum, n) => sum + n.trust_score, 0) / context.nodes.length
      : 0.5;

    return {
      text: answer,
      confidence: avgTrust,
    };
  }

  /**
   * Check if content is relevant to query
   */
  private isRelevant(content: string, query: string): boolean {
    const contentWords = new Set(content.toLowerCase().split(/\s+/));
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const intersection = new Set([...queryWords].filter(w => contentWords.has(w)));
    return intersection.size >= 2; // At least 2 words match
  }
}
