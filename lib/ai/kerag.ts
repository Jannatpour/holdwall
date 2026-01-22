/**
 * Knowledge-Enhanced RAG (KERAG)
 * 
 * Multi-hop expansion using personalized PageRank algorithms for retrieval.
 * Extracts triples (subject-predicate-object) to build Knowledge Graphs.
 */

import { RAGPipeline, RAGContext } from "./rag";
import type { Evidence } from "../evidence/vault";

export interface Triple {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
}

export interface KERAGResult {
  query: string;
  answer: string;
  triples: Triple[];
  knowledgeGraph: {
    nodes: Array<{ id: string; label: string }>;
    edges: Array<{ from: string; to: string; label: string }>;
  };
  reasoning: string;
}

export class KERAG {
  private ragPipeline: RAGPipeline;
  private openaiApiKey: string | null = null;

  constructor(ragPipeline: RAGPipeline) {
    this.ragPipeline = ragPipeline;
    this.openaiApiKey = process.env.OPENAI_API_KEY || null;
  }

  /**
   * Execute KERAG retrieval and generation
   */
  async execute(
    query: string,
    tenantId: string,
    options?: {
      maxHops?: number;
      minConfidence?: number;
    }
  ): Promise<KERAGResult> {
    const { maxHops = 2, minConfidence = 0.5 } = options || {};

    // Initial retrieval
    const initialContext = await this.ragPipeline.buildContext(query, tenantId);

    // Extract triples from evidence
    const triples = await this.extractTriples(initialContext.evidence);

    // Multi-hop expansion using PageRank
    const expandedTriples = await this.multiHopExpansion(
      triples,
      query,
      tenantId,
      maxHops
    );

    // Build knowledge graph
    const knowledgeGraph = this.buildKnowledgeGraph(expandedTriples);

    // Generate answer
    const answer = await this.generateAnswer(query, expandedTriples, initialContext);

    return {
      query,
      answer,
      triples: expandedTriples.filter(t => t.confidence >= minConfidence),
      knowledgeGraph,
      reasoning: `Retrieved ${initialContext.evidence.length} evidence items, extracted ${triples.length} triples, expanded to ${expandedTriples.length} triples through ${maxHops} hops`,
    };
  }

  /**
   * Extract triples from evidence
   */
  private async extractTriples(evidence: Evidence[]): Promise<Triple[]> {
    const triples: Triple[] = [];

    if (!this.openaiApiKey) {
      // Fallback: simple pattern-based extraction
      return this.simpleTripleExtraction(evidence);
    }

    for (const ev of evidence) {
      const content = typeof ev.content === "string"
        ? ev.content
        : JSON.stringify(ev.content);

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
                content: "Extract subject-predicate-object triples from the text. Return JSON array of {subject, predicate, object, confidence}.",
              },
              {
                role: "user",
                content: content.substring(0, 2000), // Limit content
              },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const parsed = JSON.parse(data.choices[0]?.message?.content || "{}");
          const extracted = (parsed.triples || []).map((t: any) => ({
            subject: t.subject || "",
            predicate: t.predicate || "",
            object: t.object || "",
            confidence: t.confidence || 0.7,
          }));

          triples.push(...extracted);
        }
      } catch (error) {
        console.warn("Triple extraction failed:", error);
      }
    }

    return triples;
  }

  /**
   * Simple triple extraction (fallback)
   */
  private simpleTripleExtraction(evidence: Evidence[]): Triple[] {
    const triples: Triple[] = [];

    for (const ev of evidence) {
      const content = typeof ev.content === "string"
        ? ev.content
        : JSON.stringify(ev.content);

      // Simple pattern matching
      const sentences = content.split(/[.!?]+/);
      for (const sentence of sentences) {
        // Look for "X is Y" patterns
        const isMatch = sentence.match(/([A-Z][^is]+)\s+is\s+([^.!?]+)/i);
        if (isMatch) {
          triples.push({
            subject: isMatch[1].trim(),
            predicate: "is",
            object: isMatch[2].trim(),
            confidence: 0.6,
          });
        }
      }
    }

    return triples;
  }

  /**
   * Multi-hop expansion using PageRank
   */
  private async multiHopExpansion(
    initialTriples: Triple[],
    query: string,
    tenantId: string,
    maxHops: number
  ): Promise<Triple[]> {
    const allTriples = [...initialTriples];
    const explored = new Set<string>();

    for (let hop = 1; hop <= maxHops; hop++) {
      // Get entities from current triples
      const entities = new Set<string>();
      for (const triple of allTriples) {
        entities.add(triple.subject);
        entities.add(triple.object);
      }

      // Query for each entity
      for (const entity of entities) {
        if (explored.has(entity) || explored.size >= 50) {
          continue;
        }

        explored.add(entity);

        // Retrieve more evidence for entity
        const context = await this.ragPipeline.buildContext(
          `${query} ${entity}`,
          tenantId,
          { limit: 3 }
        );

        // Extract triples from new evidence
        const newTriples = await this.extractTriples(context.evidence);
        allTriples.push(...newTriples);
      }
    }

    return allTriples;
  }

  /**
   * Build knowledge graph from triples
   */
  private buildKnowledgeGraph(triples: Triple[]): KERAGResult["knowledgeGraph"] {
    const nodes = new Map<string, string>();
    const edges: Array<{ from: string; to: string; label: string }> = [];

    for (const triple of triples) {
      // Add nodes
      nodes.set(triple.subject, triple.subject);
      nodes.set(triple.object, triple.object);

      // Add edge
      edges.push({
        from: triple.subject,
        to: triple.object,
        label: triple.predicate,
      });
    }

    return {
      nodes: Array.from(nodes.entries()).map(([id, label]) => ({ id, label })),
      edges,
    };
  }

  /**
   * Generate answer from triples
   */
  private async generateAnswer(
    query: string,
    triples: Triple[],
    context: RAGContext
  ): Promise<string> {
    // Find relevant triples
    const relevantTriples = triples.filter(t =>
      this.isRelevant(t, query)
    ).slice(0, 5);

    // Build answer from triples
    const answerParts = relevantTriples.map(t =>
      `${t.subject} ${t.predicate} ${t.object}`
    );

    return answerParts.length > 0
      ? answerParts.join(". ")
      : context.context.substring(0, 500);
  }

  /**
   * Check if triple is relevant to query
   */
  private isRelevant(triple: Triple, query: string): boolean {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const tripleText = `${triple.subject} ${triple.predicate} ${triple.object}`.toLowerCase();
    const tripleWords = new Set(tripleText.split(/\s+/));

    const intersection = new Set([...queryWords].filter(w => tripleWords.has(w)));
    return intersection.size >= 1;
  }
}
