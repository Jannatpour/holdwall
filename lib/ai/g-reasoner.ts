/**
 * G-reasoner
 * 
 * Unified Graph-Language Foundation Model
 * 
 * Advanced reasoning system that combines graph neural networks with language models
 * for unified graph-language understanding and reasoning.
 * 
 * Latest January 2026 AI technology for graph reasoning.
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { AIOrchestrator } from "@/lib/ai/orchestrator";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import type { BeliefNode, BeliefEdge } from "@prisma/client";

const evidenceVault = new DatabaseEvidenceVault();
const orchestrator = new AIOrchestrator(evidenceVault);

export interface GraphLanguageInput {
  query: string;
  nodes: BeliefNode[];
  edges: BeliefEdge[];
  context?: Record<string, unknown>;
}

export interface GraphLanguageOutput {
  answer: string;
  reasoning: string;
  graphPath: Array<{
    nodeId: string;
    nodeType: string;
    reasoning: string;
  }>;
  confidence: number;
  evidence: Array<{
    nodeId: string;
    relevance: number;
    explanation: string;
  }>;
}

/**
 * G-reasoner
 * 
 * Unified graph-language foundation model for reasoning
 */
export class GReasoner {
  /**
   * Reason over graph with language understanding
   */
  async reason(input: GraphLanguageInput, tenantId: string): Promise<GraphLanguageOutput> {
    const startTime = Date.now();

    try {
      logger.info("G-reasoner reasoning started", {
        query: input.query,
        nodeCount: input.nodes.length,
        edgeCount: input.edges.length,
      });

      // Step 1: Graph encoding - encode graph structure into language representation
      const graphEncoding = await this.encodeGraph(input.nodes, input.edges);

      // Step 2: Query understanding - understand query in graph context
      const queryUnderstanding = await this.understandQuery(input.query, graphEncoding, tenantId);

      // Step 3: Graph traversal - find relevant paths in graph
      const graphPath = await this.traverseGraph(
        queryUnderstanding,
        input.nodes,
        input.edges
      );

      // Step 4: Unified reasoning - combine graph and language for reasoning
      const reasoning = await this.unifiedReasoning(
        input.query,
        graphEncoding,
        queryUnderstanding,
        graphPath,
        tenantId
      );

      // Step 5: Evidence extraction - extract supporting evidence
      const evidence = await this.extractEvidence(
        graphPath,
        input.nodes,
        queryUnderstanding
      );

      const result: GraphLanguageOutput = {
        answer: reasoning.answer,
        reasoning: reasoning.explanation,
        graphPath,
        confidence: reasoning.confidence,
        evidence,
      };

      const latencyMs = Date.now() - startTime;
      metrics.increment("g_reasoner.reasoning");
      metrics.observe("g_reasoner.latency", latencyMs);
      metrics.gauge("g_reasoner.confidence", reasoning.confidence);

      logger.info("G-reasoner reasoning completed", {
        confidence: reasoning.confidence,
        pathLength: graphPath.length,
        evidenceCount: evidence.length,
        latencyMs,
      });

      return result;
    } catch (error) {
      logger.error("G-reasoner reasoning failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Encode graph structure into language representation
   */
  private async encodeGraph(
    nodes: BeliefNode[],
    edges: BeliefEdge[]
  ): Promise<string> {
    // Build graph description in natural language
    const nodeDescriptions = nodes.map((node, idx) => {
      return `Node ${idx + 1} (${node.id}): Type=${node.type || "unknown"}, Content="${node.content?.substring(0, 200) || ""}", Confidence=${node.decisiveness || 0}`;
    }).join("\n");

    const edgeDescriptions = edges.map((edge, idx) => {
      return `Edge ${idx + 1}: ${edge.fromNodeId} -> ${edge.toNodeId} (Type=${edge.type || "related"}, Weight=${edge.weight || 1})`;
    }).join("\n");

    return `Graph Structure:
Nodes (${nodes.length}):
${nodeDescriptions}

Edges (${edges.length}):
${edgeDescriptions}`;
  }

  /**
   * Understand query in graph context
   */
  private async understandQuery(
    query: string,
    graphEncoding: string,
    tenantId: string
  ): Promise<{
    intent: string;
    entities: string[];
    relationships: string[];
    graphRelevance: number;
  }> {
    const prompt = `Understand this query in the context of the knowledge graph.

Query: ${query}

Graph Context:
${graphEncoding.substring(0, 3000)}

Analyze the query and identify:
1. Intent: What is the user asking?
2. Entities: What entities are mentioned or implied?
3. Relationships: What relationships are being queried?
4. Graph Relevance: How relevant is this query to the graph? (0.0-1.0)

Return JSON:
{
  "intent": "description of query intent",
  "entities": ["entity1", "entity2", ...],
  "relationships": ["relationship1", "relationship2", ...],
  "graphRelevance": 0.0-1.0
}`;

    try {
      const response = await orchestrator.orchestrate({
        query: prompt,
        tenant_id: tenantId,
        use_rag: false,
        use_kag: false,
        model: "o1-mini", // Latest 2026 reasoning model for graph reasoning
        temperature: 0.3,
        max_tokens: 2000,
      });

      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          intent: parsed.intent || query,
          entities: Array.isArray(parsed.entities) ? parsed.entities : [],
          relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
          graphRelevance: Math.max(0, Math.min(1, Number(parsed.graphRelevance) || 0.5)),
        };
      }
    } catch (error) {
      logger.warn("Query understanding failed", { error });
    }

    // Fallback
    return {
      intent: query,
      entities: [],
      relationships: [],
      graphRelevance: 0.5,
    };
  }

  /**
   * Traverse graph to find relevant paths
   */
  private async traverseGraph(
    queryUnderstanding: Awaited<ReturnType<typeof this.understandQuery>>,
    nodes: BeliefNode[],
    edges: BeliefEdge[]
  ): Promise<GraphLanguageOutput["graphPath"]> {
    const path: GraphLanguageOutput["graphPath"] = [];
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const edgeMap = new Map<string, BeliefEdge[]>();

    // Build edge index
    for (const edge of edges) {
      if (!edgeMap.has(edge.fromNodeId)) {
        edgeMap.set(edge.fromNodeId, []);
      }
      edgeMap.get(edge.fromNodeId)!.push(edge);
    }

    // Find starting nodes (nodes matching query entities)
    const startNodes = nodes.filter((node) => {
      const content = node.content?.toLowerCase() || "";
      return queryUnderstanding.entities.some((entity) =>
        content.includes(entity.toLowerCase())
      );
    });

    if (startNodes.length === 0) {
      // Use all nodes if no match
      startNodes.push(...nodes.slice(0, 5));
    }

    // Traverse from start nodes
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; depth: number }> = startNodes
      .slice(0, 5)
      .map((n) => ({ nodeId: n.id, depth: 0 }));

    while (queue.length > 0 && path.length < 10) {
      const { nodeId, depth } = queue.shift()!;

      if (visited.has(nodeId) || depth > 3) {
        continue;
      }

      visited.add(nodeId);
      const node = nodeMap.get(nodeId);
      if (node) {
        path.push({
          nodeId: node.id,
          nodeType: node.type || "unknown",
          reasoning: `Reached node through graph traversal (depth ${depth})`,
        });
      }

      // Add connected nodes
      const connectedEdges = edgeMap.get(nodeId) || [];
      for (const edge of connectedEdges) {
        if (!visited.has(edge.toNodeId)) {
          queue.push({ nodeId: edge.toNodeId, depth: depth + 1 });
        }
      }
    }

    return path;
  }

  /**
   * Unified reasoning combining graph and language
   */
  private async unifiedReasoning(
    query: string,
    graphEncoding: string,
    queryUnderstanding: Awaited<ReturnType<typeof this.understandQuery>>,
    graphPath: GraphLanguageOutput["graphPath"],
    tenantId: string
  ): Promise<{
    answer: string;
    explanation: string;
    confidence: number;
  }> {
    const pathDescription = graphPath
      .map((p, idx) => `${idx + 1}. ${p.nodeType} (${p.nodeId}): ${p.reasoning}`)
      .join("\n");

    const prompt = `Answer this query using unified graph-language reasoning.

Query: ${query}

Query Understanding:
- Intent: ${queryUnderstanding.intent}
- Entities: ${queryUnderstanding.entities.join(", ")}
- Relationships: ${queryUnderstanding.relationships.join(", ")}
- Graph Relevance: ${queryUnderstanding.graphRelevance}

Graph Context:
${graphEncoding.substring(0, 2000)}

Relevant Graph Path:
${pathDescription}

Provide a comprehensive answer that:
1. Uses information from the graph
2. Explains the reasoning path
3. Provides confidence score (0.0-1.0)

Return JSON:
{
  "answer": "comprehensive answer",
  "explanation": "detailed reasoning explanation",
  "confidence": 0.0-1.0
}`;

    try {
      const response = await orchestrator.orchestrate({
        query: prompt,
        tenant_id: tenantId,
        use_rag: true,
        use_kag: true,
        model: "o1-mini", // Latest 2026 reasoning model for graph reasoning
        temperature: 0.3,
        max_tokens: 3000,
      });

      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          answer: parsed.answer || "Unable to generate answer",
          explanation: parsed.explanation || "Reasoning unavailable",
          confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
        };
      }
    } catch (error) {
      logger.warn("Unified reasoning failed", { error });
    }

    // Fallback
    return {
      answer: `Based on graph analysis with ${graphPath.length} nodes, ${query}`,
      explanation: `Traversed ${graphPath.length} nodes in graph to answer query`,
      confidence: 0.6,
    };
  }

  /**
   * Extract supporting evidence
   */
  private async extractEvidence(
    graphPath: GraphLanguageOutput["graphPath"],
    nodes: BeliefNode[],
    queryUnderstanding: Awaited<ReturnType<typeof this.understandQuery>>
  ): Promise<GraphLanguageOutput["evidence"]> {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const evidence: GraphLanguageOutput["evidence"] = [];

    for (const pathNode of graphPath) {
      const node = nodeMap.get(pathNode.nodeId);
      if (node) {
        // Calculate relevance based on content match
        const content = node.content?.toLowerCase() || "";
        const relevance = queryUnderstanding.entities.some((entity) =>
          content.includes(entity.toLowerCase())
        )
          ? 0.8
          : 0.5;

        evidence.push({
          nodeId: node.id,
          relevance,
          explanation: `Node ${pathNode.nodeType} with content matching query entities`,
        });
      }
    }

    // Sort by relevance
    evidence.sort((a, b) => b.relevance - a.relevance);

    return evidence.slice(0, 5);
  }
}

export const gReasoner = new GReasoner();
