/**
 * Relationship Extractor
 * 
 * Extracts relationships between entities from evidence using NLP/LLM.
 */

import { logger } from "@/lib/logging/logger";
import { EmbeddingService } from "@/lib/vector/embeddings";
import type { RelationshipType } from "./entity-graph";

export interface ExtractedRelationship {
  from_entity: string;
  to_entity: string;
  relationship_type: RelationshipType;
  confidence: number;
  evidence: string;
}

export class RelationshipExtractor {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Extract relationships from content
   */
  async extractRelationships(
    content: string,
    tenantId: string
  ): Promise<ExtractedRelationship[]> {
    try {
      const relationships: ExtractedRelationship[] = [];

      // Extract using pattern matching (simplified - in production use LLM)
      const patterns = this.getRelationshipPatterns();

      for (const pattern of patterns) {
        const matches = content.matchAll(pattern.regex);
        for (const match of matches) {
          relationships.push({
            from_entity: match[1],
            to_entity: match[2],
            relationship_type: pattern.type,
            confidence: pattern.confidence,
            evidence: match[0],
          });
        }
      }

      // Deduplicate
      const unique = new Map<string, ExtractedRelationship>();
      for (const rel of relationships) {
        const key = `${rel.from_entity}:${rel.to_entity}:${rel.relationship_type}`;
        if (!unique.has(key) || unique.get(key)!.confidence < rel.confidence) {
          unique.set(key, rel);
        }
      }

      return Array.from(unique.values());
    } catch (error) {
      logger.error("Failed to extract relationships", {
        error: error instanceof Error ? error.message : String(error),
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return [];
    }
  }

  /**
   * Get relationship patterns
   */
  private getRelationshipPatterns(): Array<{
    regex: RegExp;
    type: RelationshipType;
    confidence: number;
  }> {
    return [
      {
        regex: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:owns|acquired|bought|purchased)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
        type: "OWNS",
        confidence: 0.9,
      },
      {
        regex: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:manages|runs|leads|directs)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
        type: "MANAGES",
        confidence: 0.8,
      },
      {
        regex: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:reports to|works for|under)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
        type: "REPORTS_TO",
        confidence: 0.8,
      },
      {
        regex: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:supplies|provides|sells to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
        type: "SUPPLIES",
        confidence: 0.7,
      },
      {
        regex: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:changed|revised|updated)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
        type: "CHANGED",
        confidence: 0.7,
      },
      {
        regex: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:affected by|impacted by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
        type: "AFFECTED_BY",
        confidence: 0.7,
      },
    ];
  }
}
