/**
 * GORAG
 * 
 * Graph-based RAG (Retrieval-Augmented Generation)
 * 
 * Enhanced RAG system that uses graph structure for more efficient and accurate retrieval.
 * Leverages graph topology, community structure, and path-based reasoning.
 * 
 * Latest January 2026 AI technology for knowledge graph retrieval.
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { AIOrchestrator } from "@/lib/ai/orchestrator";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { GraphRAG, type KnowledgeGraph } from "./graphrag";
import { leidenClustering, type Community } from "./leiden-clustering";
import type { Evidence } from "../evidence/vault";

const evidenceVault = new DatabaseEvidenceVault();
const orchestrator = new AIOrchestrator(evidenceVault);
const graphRAG = new GraphRAG();

export interface GORAGQuery {
  query: string;
  maxHops?: number;
  useCommunities?: boolean;
  usePathReasoning?: boolean;
}

export interface GORAGResult {
  answer: string;
  reasoning: string;
  retrievedNodes: Array<{
    nodeId: string;
    relevance: number;
    path: string[];
  }>;
  communities: Community[];
  confidence: number;
  metadata: {
    nodesRetrieved: number;
    communitiesUsed: number;
    pathsExplored: number;
    latencyMs: number;
  };
}

/**
 * GORAG
 * 
 * Graph-based RAG for enhanced retrieval
 */
export class GORAG {
  private knowledgeGraph: KnowledgeGraph | null = null;
  private communities: Map<string, Community> | null = null;

  /**
   * Initialize GORAG with knowledge graph
   */
  async initialize(evidence: Evidence[]): Promise<void> {
    logger.info("GORAG initializing", { evidenceCount: evidence.length });

    // Build knowledge graph using GraphRAG
    this.knowledgeGraph = await graphRAG.buildKnowledgeGraph(evidence);

    // Extract communities if available
    if (this.knowledgeGraph.communities) {
      this.communities = this.knowledgeGraph.communities;
    }

    logger.info("GORAG initialized", {
      entityCount: this.knowledgeGraph.entities.size,
      relationshipCount: this.knowledgeGraph.relationships.length,
      communityCount: this.communities?.size || 0,
    });
  }

  /**
   * Query using graph-based retrieval
   */
  async query(
    input: GORAGQuery,
    tenantId: string
  ): Promise<GORAGResult> {
    const startTime = Date.now();

    if (!this.knowledgeGraph) {
      throw new Error("GORAG not initialized. Call initialize() first.");
    }

    try {
      logger.info("GORAG query started", {
        query: input.query,
        maxHops: input.maxHops,
        useCommunities: input.useCommunities,
      });

      // Step 1: Find relevant starting nodes
      const startNodes = await this.findStartNodes(input.query, tenantId);

      // Step 2: Graph traversal with path reasoning
      const retrievedNodes = await this.traverseWithPaths(
        startNodes,
        input.maxHops || 3,
        input.usePathReasoning ?? true
      );

      // Step 3: Community-aware retrieval
      const communities = input.useCommunities
        ? await this.getRelevantCommunities(retrievedNodes)
        : [];

      // Step 4: Generate answer with graph context
      const answer = await this.generateAnswer(
        input.query,
        retrievedNodes,
        communities,
        tenantId
      );

      const latencyMs = Date.now() - startTime;

      const result: GORAGResult = {
        answer: answer.text,
        reasoning: answer.reasoning,
        retrievedNodes: retrievedNodes.map((n) => ({
          nodeId: n.nodeId,
          relevance: n.relevance,
          path: n.path,
        })),
        communities,
        confidence: answer.confidence,
        metadata: {
          nodesRetrieved: retrievedNodes.length,
          communitiesUsed: communities.length,
          pathsExplored: retrievedNodes.reduce((sum, n) => sum + n.path.length, 0),
          latencyMs,
        },
      };

      metrics.increment("gorag.queries");
      metrics.observe("gorag.latency", latencyMs);
      metrics.gauge("gorag.confidence", answer.confidence);
      metrics.gauge("gorag.nodes_retrieved", retrievedNodes.length);

      logger.info("GORAG query completed", {
        nodesRetrieved: retrievedNodes.length,
        communitiesUsed: communities.length,
        confidence: answer.confidence,
        latencyMs,
      });

      return result;
    } catch (error) {
      logger.error("GORAG query failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Find starting nodes for query
   */
  private async findStartNodes(
    query: string,
    tenantId: string
  ): Promise<Array<{ nodeId: string; relevance: number }>> {
    // Use semantic search to find relevant entities
    const entities = Array.from(this.knowledgeGraph!.entities.entries());
    const relevant: Array<{ nodeId: string; relevance: number }> = [];

    // Simplified: use keyword matching
    // In production, use embeddings for semantic similarity
    const queryLower = query.toLowerCase();
    for (const [entityId, entity] of entities) {
      const entityText = JSON.stringify(entity.properties).toLowerCase();
      const relevance = queryLower.split(" ").some((word) => entityText.includes(word)) ? 0.7 : 0.3;
      if (relevance > 0.3) {
        relevant.push({ nodeId: entityId, relevance });
      }
    }

    // Sort by relevance and return top nodes
    relevant.sort((a, b) => b.relevance - a.relevance);
    return relevant.slice(0, 10);
  }

  /**
   * Traverse graph with path reasoning
   */
  private async traverseWithPaths(
    startNodes: Array<{ nodeId: string; relevance: number }>,
    maxHops: number,
    usePathReasoning: boolean
  ): Promise<Array<{
    nodeId: string;
    relevance: number;
    path: string[];
  }>> {
    const visited = new Set<string>();
    const result: Array<{
      nodeId: string;
      relevance: number;
      path: string[];
    }> = [];

    // BFS traversal with path tracking
    const queue: Array<{
      nodeId: string;
      path: string[];
      depth: number;
      relevance: number;
    }> = startNodes.map((n) => ({
      nodeId: n.nodeId,
      path: [n.nodeId],
      depth: 0,
      relevance: n.relevance,
    }));

    while (queue.length > 0 && result.length < 50) {
      const { nodeId, path, depth, relevance } = queue.shift()!;

      if (visited.has(nodeId) || depth >= maxHops) {
        continue;
      }

      visited.add(nodeId);
      result.push({
        nodeId,
        relevance: usePathReasoning ? this.calculatePathRelevance(path, relevance) : relevance,
        path: [...path],
      });

      // Add neighbors
      const neighbors = this.knowledgeGraph!.relationships
        .filter((rel) => rel.from === nodeId || rel.to === nodeId)
        .map((rel) => (rel.from === nodeId ? rel.to : rel.from));

      for (const neighborId of neighbors) {
        if (!visited.has(neighborId) && !path.includes(neighborId)) {
          queue.push({
            nodeId: neighborId,
            path: [...path, neighborId],
            depth: depth + 1,
            relevance: relevance * 0.8, // Decay relevance with distance
          });
        }
      }
    }

    return result;
  }

  /**
   * Calculate path-based relevance
   */
  private calculatePathRelevance(path: string[], baseRelevance: number): number {
    // Path relevance decreases with length but increases with connectivity
    const pathLength = path.length;
    const connectivity = this.calculatePathConnectivity(path);

    return baseRelevance * (1 / pathLength) * (1 + connectivity * 0.2);
  }

  /**
   * Calculate path connectivity (how well-connected the path is)
   */
  private calculatePathConnectivity(path: string[]): number {
    if (path.length < 2) return 0;

    let connections = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const hasEdge = this.knowledgeGraph!.relationships.some(
        (rel) =>
          (rel.from === path[i] && rel.to === path[i + 1]) ||
          (rel.to === path[i] && rel.from === path[i + 1])
      );
      if (hasEdge) connections++;
    }

    return connections / (path.length - 1);
  }

  /**
   * Get relevant communities
   */
  private async getRelevantCommunities(
    nodes: Array<{ nodeId: string; relevance: number; path: string[] }>
  ): Promise<Community[]> {
    if (!this.communities) {
      return [];
    }

    const nodeIds = new Set(nodes.map((n) => n.nodeId));
    const relevantCommunities: Community[] = [];

    for (const community of this.communities.values()) {
      // Check if community contains any retrieved nodes
      const overlap = Array.from(community.nodes).filter((n) => nodeIds.has(n)).length;
      if (overlap > 0) {
        relevantCommunities.push(community);
      }
    }

    return relevantCommunities;
  }

  /**
   * Generate answer with graph context
   */
  private async generateAnswer(
    query: string,
    retrievedNodes: Array<{ nodeId: string; relevance: number; path: string[] }>,
    communities: Community[],
    tenantId: string
  ): Promise<{
    text: string;
    reasoning: string;
    confidence: number;
  }> {
    // Build context from retrieved nodes
    const nodeContext = retrievedNodes
      .slice(0, 10)
      .map((n, idx) => {
        const entity = this.knowledgeGraph!.entities.get(n.nodeId);
        return `Node ${idx + 1} (${n.nodeId}): ${JSON.stringify(entity?.properties || {}).substring(0, 200)} (Relevance: ${n.relevance.toFixed(2)}, Path: ${n.path.join(" -> ")})`;
      })
      .join("\n");

    const communityContext = communities
      .slice(0, 5)
      .map((c, idx) => `Community ${idx + 1}: ${c.id} (Size: ${c.properties.size}, Density: ${c.properties.density.toFixed(2)})`)
      .join("\n");

    const prompt = `Answer this query using graph-based retrieval.

Query: ${query}

Retrieved Nodes (${retrievedNodes.length}):
${nodeContext}

Relevant Communities (${communities.length}):
${communityContext}

Provide a comprehensive answer that:
1. Uses information from the retrieved graph nodes
2. Explains the reasoning path
3. References relevant communities if applicable
4. Provides confidence score (0.0-1.0)

Return JSON:
{
  "text": "comprehensive answer",
  "reasoning": "detailed reasoning explanation",
  "confidence": 0.0-1.0
}`;

    try {
      const response = await orchestrator.orchestrate({
        query: prompt,
        tenant_id: tenantId,
        use_rag: true,
        use_kag: true,
        model: "o1-mini", // Latest 2026 reasoning model for graph-oriented RAG
        temperature: 0.3,
        max_tokens: 3000,
      });

      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          text: parsed.text || "Unable to generate answer",
          reasoning: parsed.reasoning || "Reasoning unavailable",
          confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
        };
      }
    } catch (error) {
      logger.warn("GORAG answer generation failed", { error });
    }

    // Fallback
    return {
      text: `Based on graph retrieval with ${retrievedNodes.length} nodes, ${query}`,
      reasoning: `Retrieved ${retrievedNodes.length} nodes from graph, explored ${communities.length} communities`,
      confidence: 0.6,
    };
  }
}

export const gorag = new GORAG();
