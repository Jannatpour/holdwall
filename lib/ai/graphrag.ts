/**
 * GraphRAG
 * 
 * Retrieval-augmented generation powered by semantic knowledge backbone.
 * Acts as "digital nerve center" providing agents with traceable logic and auditable reasoning.
 */

import { EmbeddingService } from "@/lib/vector/embeddings";
import { LLMProvider } from "@/lib/llm/providers";
import { leidenClustering, type GraphNode, type GraphEdge, type Community } from "./leiden-clustering";
import type { Evidence } from "../evidence/vault";

export interface KnowledgeGraph {
  entities: Map<string, {
    id: string;
    type: string;
    properties: Record<string, unknown>;
  }>;
  relationships: Array<{
    from: string;
    to: string;
    type: string;
    weight: number;
  }>;
  communities?: Map<string, Community>; // Leiden clustering communities
  hierarchy?: Map<number, Community[]>; // Hierarchical community structure
}

export interface GraphRAGResult {
  query: string;
  answer: string;
  reasoning: string;
  sources: Array<{
    entity: string;
    relationship: string;
    evidence: string;
  }>;
  confidence: number;
}

export class GraphRAG {
  private embeddings: EmbeddingService;
  private llmProvider: LLMProvider;
  private knowledgeGraph: KnowledgeGraph = {
    entities: new Map(),
    relationships: [],
  };
  private evidenceStore: Map<string, Evidence[]> = new Map(); // entityId -> Evidence[]

  constructor() {
    this.embeddings = new EmbeddingService();
    this.llmProvider = new LLMProvider();
  }

  /**
   * Build knowledge graph from evidence
   */
  async buildKnowledgeGraph(evidence: Evidence[]): Promise<KnowledgeGraph> {
    const entities = new Map<string, {
      id: string;
      type: string;
      properties: Record<string, unknown>;
    }>();

    const relationships: KnowledgeGraph["relationships"] = [];

    for (const ev of evidence) {
      // Extract entities from evidence
      const extracted = await this.extractEntities(ev);

      for (const entity of extracted) {
        entities.set(entity.id, entity);
        // Store evidence for entity
        if (!this.evidenceStore.has(entity.id)) {
          this.evidenceStore.set(entity.id, []);
        }
        this.evidenceStore.get(entity.id)!.push(ev);
      }

      // Extract relationships
      const extractedRelations = await this.extractRelationships(ev, extracted);
      relationships.push(...extractedRelations);
    }

    // Apply Leiden clustering for community detection
    const graphNodes = new Map<string, GraphNode>();
    const graphEdges: GraphEdge[] = [];

    // Convert entities to graph nodes
    for (const [entityId, entity] of entities.entries()) {
      graphNodes.set(entityId, {
        id: entityId,
        neighbors: new Set(),
        weight: 1.0,
      });
    }

    // Convert relationships to graph edges
    for (const rel of relationships) {
      graphEdges.push({
        from: rel.from,
        to: rel.to,
        weight: rel.weight,
      });

      // Update neighbors
      const fromNode = graphNodes.get(rel.from);
      const toNode = graphNodes.get(rel.to);
      if (fromNode) fromNode.neighbors.add(rel.to);
      if (toNode) toNode.neighbors.add(rel.from);
    }

    // Perform Leiden clustering
    const clusteringResult = await leidenClustering.cluster(graphNodes, graphEdges, {
      resolution: 1.0,
      hierarchical: true,
    });

    this.knowledgeGraph = {
      entities,
      relationships,
      communities: clusteringResult.communities,
      hierarchy: clusteringResult.hierarchy,
    };

    return this.knowledgeGraph;
  }

  /**
   * Query knowledge graph with RAG
   */
  async query(
    query: string,
    options?: {
      maxResults?: number;
      minConfidence?: number;
    }
  ): Promise<GraphRAGResult> {
    const { maxResults = 5, minConfidence = 0.7 } = options || {};

    // 1. Embed query
    const queryEmbeddingResult = await this.embeddings.embed(query);
    const queryEmbedding = queryEmbeddingResult.vector;

    // 2. Find relevant entities
    const relevantEntities = await this.findRelevantEntities(queryEmbedding, maxResults);

    // 3. Traverse graph to find connected entities
    const connectedEntities = this.traverseGraph(relevantEntities, maxResults);

    // 4. Retrieve evidence for entities
    const evidence = await this.retrieveEvidence(connectedEntities);

    // 5. Generate answer using RAG
    const answer = await this.generateAnswer(query, evidence);

    return {
      query,
      answer: answer.text,
      reasoning: answer.reasoning,
      sources: answer.sources,
      confidence: answer.confidence,
    };
  }

  /**
   * Extract entities from evidence using LLM-based NER
   */
  private async extractEntities(evidence: Evidence): Promise<Array<{
    id: string;
    type: string;
    properties: Record<string, unknown>;
  }>> {
    const content = typeof evidence.content === "string" 
      ? evidence.content 
      : (evidence.content?.raw || evidence.content?.normalized || JSON.stringify(evidence.content));

    if (!content || content.trim().length === 0) {
      return [];
    }

    const entities: Array<{ id: string; type: string; properties: Record<string, unknown> }> = [];

    try {
      // Use LLM for structured entity extraction
      const prompt = `Extract all named entities from the following text. Identify:
1. Organizations (companies, institutions, groups)
2. People (names of individuals)
3. Locations (cities, countries, places)
4. Products (product names, services)
5. Dates (specific dates, time periods)
6. Events (named events, incidents)

For each entity, provide:
- type: one of "Organization", "Person", "Location", "Product", "Date", "Event"
- name: the entity name
- context: brief context where it appears (optional)

Text:
${content.substring(0, 4000)}

Return a JSON array of entities with this structure:
[
  {
    "type": "Organization|Person|Location|Product|Date|Event",
    "name": "entity name",
    "context": "optional context"
  }
]`;

      const response = await this.llmProvider.call({
        model: "gpt-4o",
        prompt,
        system_prompt: "You are a Named Entity Recognition (NER) system. Extract all named entities from the text and return them as a JSON array. Be thorough and accurate.",
        temperature: 0.2,
        max_tokens: 2000,
      });

      // Parse LLM response
      let extractedEntities: Array<{ type: string; name: string; context?: string }> = [];
      try {
        const jsonMatch = response.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          extractedEntities = JSON.parse(jsonMatch[0]);
        } else {
          // Try parsing the entire response
          extractedEntities = JSON.parse(response.text);
        }
      } catch (parseError) {
        console.warn("Failed to parse LLM entity extraction response, using fallback:", parseError);
      }

      // Convert to entity format
      for (const extracted of extractedEntities) {
        if (extracted.name && extracted.type) {
          const entityId = `entity-${extracted.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
          entities.push({
            id: entityId,
            type: extracted.type,
            properties: {
              name: extracted.name,
              ...(extracted.context ? { context: extracted.context } : {}),
            },
          });
        }
      }
    } catch (error) {
      console.warn("LLM entity extraction failed, using fallback patterns:", error);
    }

    // Fallback: Use regex patterns for common entities if LLM fails or returns no results
    if (entities.length === 0) {
      const orgPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Inc|LLC|Ltd|Corp|Corporation|Company|Co\.)/gi;
      const personPattern = /(?:Mr|Ms|Mrs|Dr|Prof)\.\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/g;
      const locationPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:City|County|State|Country|Nation)\b/gi;
      const datePattern = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi;

      let match;
      while ((match = orgPattern.exec(content)) !== null) {
        entities.push({
          id: `entity-${match[1].toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
          type: "Organization",
          properties: { name: match[1] },
        });
      }

      while ((match = personPattern.exec(content)) !== null) {
        entities.push({
          id: `entity-${match[1].toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
          type: "Person",
          properties: { name: match[1] },
        });
      }

      while ((match = locationPattern.exec(content)) !== null) {
        entities.push({
          id: `entity-${match[1].toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
          type: "Location",
          properties: { name: match[1] },
        });
      }

      while ((match = datePattern.exec(content)) !== null) {
        entities.push({
          id: `entity-${match[0].toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
          type: "Date",
          properties: { name: match[0] },
        });
      }
    }

    // Deduplicate entities by name and type
    const seen = new Set<string>();
    return entities.filter(entity => {
      const key = `${entity.type}:${entity.properties.name}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Extract relationships between entities using LLM-based relation extraction
   */
  private async extractRelationships(
    evidence: Evidence,
    entities: Array<{ id: string; type: string; properties: Record<string, unknown> }>
  ): Promise<KnowledgeGraph["relationships"]> {
    if (entities.length < 2) {
      return [];
    }

    const content = typeof evidence.content === "string" 
      ? evidence.content 
      : (evidence.content?.raw || evidence.content?.normalized || JSON.stringify(evidence.content));

    if (!content || content.trim().length === 0) {
      return [];
    }

    const relationships: KnowledgeGraph["relationships"] = [];
    const entityMap = new Map(entities.map(e => [e.id, e]));

    try {
      // Use LLM for relation extraction
      const entityList = entities.map(e => ({
        id: e.id,
        type: e.type,
        name: e.properties.name as string || e.id,
      }));

      const prompt = `Analyze the relationships between the following entities in the text. For each pair of entities that have a relationship, identify:
1. The relationship type (e.g., "causes", "supports", "contradicts", "owns", "works_for", "located_in", "related_to", "mentions", "references")
2. The direction (from entity1 to entity2)
3. The strength/confidence (0.0-1.0)

Entities:
${JSON.stringify(entityList, null, 2)}

Text:
${content.substring(0, 4000)}

Return a JSON array of relationships with this structure:
[
  {
    "from": "entity_id_1",
    "to": "entity_id_2",
    "type": "relationship_type",
    "weight": 0.0-1.0,
    "evidence": "brief text evidence for this relationship"
  }
]`;

      const response = await this.llmProvider.call({
        model: "gpt-4o",
        prompt,
        system_prompt: "You are a relation extraction system. Identify semantic relationships between entities in the text. Return only relationships that are explicitly stated or strongly implied.",
        temperature: 0.2,
        max_tokens: 2000,
      });

      // Parse LLM response
      let extractedRelations: Array<{
        from: string;
        to: string;
        type: string;
        weight?: number;
        evidence?: string;
      }> = [];

      try {
        const jsonMatch = response.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          extractedRelations = JSON.parse(jsonMatch[0]);
        } else {
          extractedRelations = JSON.parse(response.text);
        }
      } catch (parseError) {
        console.warn("Failed to parse LLM relation extraction response, using fallback:", parseError);
      }

      // Convert to relationship format
      for (const rel of extractedRelations) {
        if (rel.from && rel.to && entityMap.has(rel.from) && entityMap.has(rel.to)) {
          // Normalize relationship type
          const normalizedType = this.normalizeRelationshipType(rel.type);
          relationships.push({
            from: rel.from,
            to: rel.to,
            type: normalizedType,
            weight: Math.max(0, Math.min(1, rel.weight || 0.5)),
          });
        }
      }
    } catch (error) {
      console.warn("LLM relation extraction failed, using fallback:", error);
    }

    // Fallback: Create co-occurrence relationships for entities mentioned together
    if (relationships.length === 0 && entities.length >= 2) {
      // Use dependency parsing heuristics: entities in same sentence are likely related
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const entityNames = new Map(entities.map(e => [e.id, (e.properties.name as string || e.id).toLowerCase()]));

      for (const sentence of sentences) {
        const sentenceLower = sentence.toLowerCase();
        const entitiesInSentence = entities.filter(e => {
          const name = entityNames.get(e.id) || "";
          return name && sentenceLower.includes(name);
        });

        // Create relationships between entities in the same sentence
        for (let i = 0; i < entitiesInSentence.length; i++) {
          for (let j = i + 1; j < entitiesInSentence.length; j++) {
            relationships.push({
              from: entitiesInSentence[i].id,
              to: entitiesInSentence[j].id,
              type: "related",
              weight: 0.4, // Lower weight for co-occurrence
            });
          }
        }
      }

      // Deduplicate relationships
      const seen = new Set<string>();
      return relationships.filter(rel => {
        const key = `${rel.from}-${rel.to}-${rel.type}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    }

    return relationships;
  }

  /**
   * Normalize relationship type to standard set
   */
  private normalizeRelationshipType(type: string): string {
    const normalized = type.toLowerCase().trim();
    
    // Map common variations to standard types
    const typeMap: Record<string, string> = {
      "causes": "causes",
      "caused_by": "caused_by",
      "supports": "supports",
      "supported_by": "supported_by",
      "contradicts": "contradicts",
      "contradicted_by": "contradicted_by",
      "owns": "owns",
      "owned_by": "owned_by",
      "works_for": "works_for",
      "employs": "employs",
      "located_in": "located_in",
      "contains": "contains",
      "related_to": "related",
      "mentions": "mentions",
      "references": "references",
      "part_of": "part_of",
      "has_part": "has_part",
    };

    // Check for exact match
    if (typeMap[normalized]) {
      return typeMap[normalized];
    }

    // Check for partial matches
    for (const [key, value] of Object.entries(typeMap)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }

    // Default to "related" for unknown types
    return "related";
  }

  /**
   * Find relevant entities using embeddings
   */
  private async findRelevantEntities(
    queryEmbedding: number[],
    maxResults: number
  ): Promise<string[]> {
    const entities = Array.from(this.knowledgeGraph.entities.entries());
    const scored = await Promise.all(
      entities.map(async ([entityId, entity]) => {
        const entityText = `${entity.type}: ${JSON.stringify(entity.properties)}`;
        const entityEmbedding = await this.embeddings.embed(entityText);
        const similarity = this.embeddings.cosineSimilarity(queryEmbedding, entityEmbedding.vector);
        return { entityId, score: similarity };
      })
    );

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map((item) => item.entityId);
  }

  /**
   * Traverse graph to find connected entities
   * Enhanced with Leiden community-aware traversal
   */
  private traverseGraph(
    startEntities: string[],
    maxDepth: number = 2
  ): string[] {
    const visited = new Set<string>();
    const queue: Array<{ entity: string; depth: number }> = startEntities.map(e => ({ entity: e, depth: 0 }));

    // Use community information if available for more efficient traversal
    const communities = this.knowledgeGraph.communities;
    const startCommunities = new Set<string>();

    if (communities) {
      for (const entityId of startEntities) {
        for (const [commId, community] of communities.entries()) {
          if (community.nodes.has(entityId)) {
            startCommunities.add(commId);
          }
        }
      }
    }

    while (queue.length > 0) {
      const { entity, depth } = queue.shift()!;

      if (visited.has(entity) || depth > maxDepth) {
        continue;
      }

      visited.add(entity);

      // Add connected entities
      for (const rel of this.knowledgeGraph.relationships) {
        if (rel.from === entity && !visited.has(rel.to)) {
          // Prioritize entities in same community
          const shouldAdd = !communities || startCommunities.size === 0 || 
            Array.from(startCommunities).some(commId => {
              const comm = communities.get(commId);
              return comm?.nodes.has(rel.to);
            });

          if (shouldAdd) {
            queue.push({ entity: rel.to, depth: depth + 1 });
          }
        } else if (rel.to === entity && !visited.has(rel.from)) {
          const shouldAdd = !communities || startCommunities.size === 0 ||
            Array.from(startCommunities).some(commId => {
              const comm = communities.get(commId);
              return comm?.nodes.has(rel.from);
            });

          if (shouldAdd) {
            queue.push({ entity: rel.from, depth: depth + 1 });
          }
        }
      }
    }

    return Array.from(visited);
  }

  /**
   * Retrieve evidence for entities
   */
  private async retrieveEvidence(entityIds: string[]): Promise<Evidence[]> {
    const evidenceSet = new Set<Evidence>();
    for (const entityId of entityIds) {
      const entityEvidence = this.evidenceStore.get(entityId) || [];
      for (const ev of entityEvidence) {
        evidenceSet.add(ev);
      }
    }
    return Array.from(evidenceSet);
  }

  /**
   * Generate answer using RAG
   */
  private async generateAnswer(
    query: string,
    evidence: Evidence[]
  ): Promise<{
    text: string;
    reasoning: string;
    sources: GraphRAGResult["sources"];
    confidence: number;
  }> {
    if (evidence.length === 0) {
      return {
        text: `Based on the knowledge graph, I found no relevant evidence for: ${query}`,
        reasoning: "No evidence retrieved from knowledge graph",
        sources: [],
        confidence: 0.3,
      };
    }

    // Build context from evidence
    const context = evidence
      .slice(0, 5)
      .map((ev, idx) => {
        const content = ev.content.raw || ev.content.normalized || "";
        return `[Evidence ${idx + 1}]: ${content.substring(0, 500)}`;
      })
      .join("\n\n");

    try {
      const response = await this.llmProvider.call({
        model: "gpt-4o",
        prompt: `Query: ${query}\n\nContext from knowledge graph:\n${context}\n\nProvide a comprehensive answer based on the context. Include reasoning about how the knowledge graph entities relate to the query.`,
        system_prompt: "You are a knowledge graph reasoning system. Answer queries using the provided evidence context and explain your reasoning.",
        temperature: 0.3,
        max_tokens: 2000,
      });

      // Extract sources from evidence
      const sources: GraphRAGResult["sources"] = evidence.slice(0, 5).map((ev, idx) => ({
        entity: ev.evidence_id,
        relationship: "supports",
        evidence: ev.evidence_id,
      }));

      return {
        text: response.text,
        reasoning: `Retrieved ${evidence.length} evidence items from knowledge graph. Used ${sources.length} top items for answer generation.`,
        sources,
        confidence: Math.min(0.9, 0.5 + (evidence.length / 10) * 0.4),
      };
    } catch (error) {
      console.warn("GraphRAG answer generation failed:", error);
      return {
        text: `Based on the knowledge graph with ${evidence.length} evidence items, ${query}`,
        reasoning: `Retrieved ${evidence.length} evidence items from knowledge graph`,
        sources: evidence.slice(0, 5).map((ev) => ({
          entity: ev.evidence_id,
          relationship: "supports",
          evidence: ev.evidence_id,
        })),
        confidence: 0.6,
      };
    }
  }
}
