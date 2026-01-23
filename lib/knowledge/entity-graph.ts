/**
 * Entity Knowledge Graph
 * 
 * Builds and maintains entity/relationship graph for ownership, policies,
 * incidents, and vendors to improve consistency and long-horizon reasoning.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { EntityTracker, type EntityType } from "@/lib/temporal/entity-tracker";

export type RelationshipType =
  | "OWNS"
  | "CHANGED"
  | "REPORTS_TO"
  | "WORKS_WITH"
  | "SUPPLIES"
  | "MANAGES"
  | "AFFECTED_BY"
  | "RELATED_TO";

export interface EntityRelationship {
  id: string;
  tenant_id: string;
  from_entity_id: string;
  to_entity_id: string;
  relationship_type: RelationshipType;
  strength: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EntityGraphQuery {
  entity_id?: string;
  entity_name?: string;
  entity_type?: EntityType;
  relationship_type?: RelationshipType;
  depth?: number;
}

export interface EntityGraphResult {
  entities: Array<{
    id: string;
    name: string;
    type: EntityType;
    state: Record<string, unknown>;
  }>;
  relationships: EntityRelationship[];
  paths: Array<{
    from: string;
    to: string;
    path: string[];
    relationship_types: RelationshipType[];
  }>;
}

export class EntityKnowledgeGraph {
  private entityTracker: EntityTracker;

  constructor() {
    this.entityTracker = new EntityTracker();
  }

  /**
   * Extract entities from evidence
   */
  async extractEntitiesFromEvidence(
    evidenceId: string,
    tenantId: string
  ): Promise<string[]> {
    try {
      const evidence = await db.evidence.findUnique({
        where: { id: evidenceId },
      });

      if (!evidence || evidence.tenantId !== tenantId) {
        return [];
      }

      const content = evidence.contentRaw || evidence.contentNormalized || "";
      if (!content.trim()) {
        return [];
      }

      // Extract entities (simplified - in production use NER)
      const entities = this.extractEntityNames(content);

      // Track entities
      const entityIds: string[] = [];
      for (const entityName of entities) {
        const entityType = this.inferEntityType(entityName, content);
        const entity = await this.entityTracker.trackEntityChange(
          tenantId,
          entityType,
          entityName,
          {
            source_evidence: evidenceId,
            extracted_at: new Date().toISOString(),
          }
        );
        entityIds.push(entity.id);
      }

      return entityIds;
    } catch (error) {
      logger.error("Failed to extract entities from evidence", {
        error: error instanceof Error ? error.message : String(error),
        evidence_id: evidenceId,
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return [];
    }
  }

  /**
   * Extract relationships from evidence
   */
  async extractRelationshipsFromEvidence(
    evidenceId: string,
    tenantId: string
  ): Promise<EntityRelationship[]> {
    try {
      const evidence = await db.evidence.findUnique({
        where: { id: evidenceId },
      });

      if (!evidence || evidence.tenantId !== tenantId) {
        return [];
      }

      const content = evidence.contentRaw || evidence.contentNormalized || "";
      if (!content.trim()) {
        return [];
      }

      // Extract relationships (simplified - in production use NLP/LLM)
      const relationships = this.extractRelationships(content, tenantId);

      // Store relationships
      const storedRelationships: EntityRelationship[] = [];
      for (const rel of relationships) {
        const stored = await this.createRelationship(
          tenantId,
          rel.from_entity,
          rel.to_entity,
          rel.type,
          rel.strength
        );
        if (stored) {
          storedRelationships.push(stored);
        }
      }

      return storedRelationships;
    } catch (error) {
      logger.error("Failed to extract relationships from evidence", {
        error: error instanceof Error ? error.message : String(error),
        evidence_id: evidenceId,
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return [];
    }
  }

  /**
   * Query entity graph
   */
  async queryGraph(
    tenantId: string,
    query: EntityGraphQuery
  ): Promise<EntityGraphResult> {
    try {
      const entities: any[] = [];
      const relationships: EntityRelationship[] = [];

      // Find entities
      if (query.entity_id) {
        const entity = await db.entity.findUnique({
          where: { id: query.entity_id },
        });
        if (entity && entity.tenantId === tenantId) {
          entities.push({
            id: entity.id,
            name: entity.name,
            type: entity.type,
            state: entity.currentState,
          });
        }
      } else if (query.entity_name || query.entity_type) {
        const where: any = { tenantId };
        if (query.entity_name) {
          where.OR = [
            { name: query.entity_name },
            { aliases: { has: query.entity_name } },
          ];
        }
        if (query.entity_type) {
          where.type = query.entity_type;
        }

        const found = await db.entity.findMany({ where });
        entities.push(
          ...found.map((e) => ({
            id: e.id,
            name: e.name,
            type: e.type,
            state: e.currentState,
          }))
        );
      }

      // Find relationships
      const relationshipWhere: any = { tenantId };
      if (query.entity_id) {
        relationshipWhere.OR = [
          { fromEntityId: query.entity_id },
          { toEntityId: query.entity_id },
        ];
      }
      if (query.relationship_type) {
        relationshipWhere.relationshipType = query.relationship_type;
      }

      const foundRelationships = await db.entityRelationship.findMany({
        where: relationshipWhere,
        take: query.depth ? 100 : 1000, // Limit for depth queries
      });

      relationships.push(
        ...foundRelationships.map((r) => ({
          id: r.id,
          tenant_id: r.tenantId,
          from_entity_id: r.fromEntityId,
          to_entity_id: r.toEntityId,
          relationship_type: r.relationshipType as RelationshipType,
          strength: r.strength,
          metadata: (r.metadata as Record<string, unknown>) || undefined,
          created_at: r.createdAt.toISOString(),
          updated_at: r.updatedAt.toISOString(),
        }))
      );

      // Find paths (simplified - in production use graph traversal)
      const paths = this.findPaths(entities, relationships, query.depth || 2);

      return {
        entities,
        relationships,
        paths,
      };
    } catch (error) {
      logger.error("Failed to query entity graph", {
        error: error instanceof Error ? error.message : String(error),
        tenant_id: tenantId,
        query,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Check graph consistency
   */
  async checkConsistency(tenantId: string): Promise<{
    consistent: boolean;
    contradictions: Array<{
      entity_id: string;
      entity_name: string;
      contradiction: string;
    }>;
  }> {
    try {
      const contradictions: Array<{
        entity_id: string;
        entity_name: string;
        contradiction: string;
      }> = [];

      // Get all entities
      const entities = await db.entity.findMany({
        where: { tenantId },
      });

      // Check for contradictory states
      for (const entity of entities) {
        const state = entity.currentState as Record<string, unknown>;
        const history = (entity.stateHistory as any[]) || [];

        // Check for ownership contradictions
        if (state.owner) {
          const ownershipEvents = history.filter((h) => h.state?.owner);
          const uniqueOwners = new Set(ownershipEvents.map((e) => e.state.owner));
          if (uniqueOwners.size > 1 && !history.some((h) => h.change_reason?.includes("transfer"))) {
            contradictions.push({
              entity_id: entity.id,
              entity_name: entity.name,
              contradiction: `Multiple owners without transfer: ${Array.from(uniqueOwners).join(", ")}`,
            });
          }
        }
      }

      return {
        consistent: contradictions.length === 0,
        contradictions,
      };
    } catch (error) {
      logger.error("Failed to check graph consistency", {
        error: error instanceof Error ? error.message : String(error),
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return { consistent: true, contradictions: [] };
    }
  }

  /**
   * Extract entity names from content (simplified)
   */
  private extractEntityNames(content: string): string[] {
    // Simple extraction (in production use NER)
    const entities: string[] = [];

    // Extract capitalized phrases (potential entity names)
    const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    const matches = content.match(capitalizedPattern);
    if (matches) {
      entities.push(...matches.filter((m) => m.length > 2 && m.length < 50));
    }

    // Extract quoted names
    const quotedPattern = /"([^"]+)"/g;
    const quotedMatches = content.match(quotedPattern);
    if (quotedMatches) {
      entities.push(...quotedMatches.map((m) => m.replace(/"/g, "")));
    }

    return Array.from(new Set(entities));
  }

  /**
   * Infer entity type from name and context
   */
  private inferEntityType(name: string, content: string): EntityType {
    const lower = content.toLowerCase();
    const nameLower = name.toLowerCase();

    if (nameLower.includes("policy") || nameLower.includes("rule") || nameLower.includes("regulation")) {
      return "POLICY";
    }
    if (nameLower.includes("vendor") || nameLower.includes("supplier") || nameLower.includes("partner")) {
      return "VENDOR";
    }
    if (lower.includes("owns") || lower.includes("ownership") || lower.includes("acquired")) {
      return "ORGANIZATION";
    }
    if (lower.includes("ceo") || lower.includes("president") || lower.includes("director")) {
      return "PERSON";
    }

    return "OTHER";
  }

  /**
   * Extract relationships from content (simplified)
   */
  private extractRelationships(
    content: string,
    tenantId: string
  ): Array<{
    from_entity: string;
    to_entity: string;
    type: RelationshipType;
    strength: number;
  }> {
    const relationships: Array<{
      from_entity: string;
      to_entity: string;
      type: RelationshipType;
      strength: number;
    }> = [];

    const lower = content.toLowerCase();

    // Extract ownership relationships
    const ownsPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:owns|acquired|bought)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;
    const ownsMatches = content.matchAll(ownsPattern);
    for (const match of ownsMatches) {
      relationships.push({
        from_entity: match[1],
        to_entity: match[2],
        type: "OWNS",
        strength: 1.0,
      });
    }

    // Extract management relationships
    const managesPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:manages|runs|leads)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;
    const managesMatches = content.matchAll(managesPattern);
    for (const match of managesMatches) {
      relationships.push({
        from_entity: match[1],
        to_entity: match[2],
        type: "MANAGES",
        strength: 0.8,
      });
    }

    return relationships;
  }

  /**
   * Create relationship
   */
  private async createRelationship(
    tenantId: string,
    fromEntityName: string,
    toEntityName: string,
    type: RelationshipType,
    strength: number
  ): Promise<EntityRelationship | null> {
    try {
      // Find entities
      const fromEntity = await this.entityTracker.getEntity(tenantId, "OTHER", fromEntityName);
      const toEntity = await this.entityTracker.getEntity(tenantId, "OTHER", toEntityName);

      if (!fromEntity || !toEntity) {
        return null;
      }

      // Check if relationship exists
      const existing = await db.entityRelationship.findUnique({
        where: {
          fromEntityId_toEntityId_relationshipType: {
            fromEntityId: fromEntity.id,
            toEntityId: toEntity.id,
            relationshipType: type,
          },
        },
      });

      if (existing) {
        // Update strength
        const updated = await db.entityRelationship.update({
          where: { id: existing.id },
          data: { strength: Math.max(existing.strength, strength) },
        });

        return {
          id: updated.id,
          tenant_id: updated.tenantId,
          from_entity_id: updated.fromEntityId,
          to_entity_id: updated.toEntityId,
          relationship_type: updated.relationshipType as RelationshipType,
          strength: updated.strength,
          metadata: (updated.metadata as Record<string, unknown>) || undefined,
          created_at: updated.createdAt.toISOString(),
          updated_at: updated.updatedAt.toISOString(),
        };
      }

      // Create new relationship
      const relationship = await db.entityRelationship.create({
        data: {
          tenantId,
          fromEntityId: fromEntity.id,
          toEntityId: toEntity.id,
          relationshipType: type,
          strength,
        },
      });

      return {
        id: relationship.id,
        tenant_id: relationship.tenantId,
        from_entity_id: relationship.fromEntityId,
        to_entity_id: relationship.toEntityId,
        relationship_type: relationship.relationshipType as RelationshipType,
        strength: relationship.strength,
        metadata: (relationship.metadata as Record<string, unknown>) || undefined,
        created_at: relationship.createdAt.toISOString(),
        updated_at: relationship.updatedAt.toISOString(),
      };
    } catch (error) {
      logger.warn("Failed to create relationship", {
        error: error instanceof Error ? error.message : String(error),
        tenant_id: tenantId,
        from_entity: fromEntityName,
        to_entity: toEntityName,
      });
      return null;
    }
  }

  /**
   * Find paths between entities (simplified BFS)
   */
  private findPaths(
    entities: Array<{ id: string; name: string }>,
    relationships: EntityRelationship[],
    maxDepth: number
  ): Array<{
    from: string;
    to: string;
    path: string[];
    relationship_types: RelationshipType[];
  }> {
    const paths: Array<{
      from: string;
      to: string;
      path: string[];
      relationship_types: RelationshipType[];
    }> = [];

    if (entities.length < 2) {
      return paths;
    }

    // Build adjacency map
    const adjacency = new Map<string, Array<{ to: string; type: RelationshipType }>>();
    for (const rel of relationships) {
      if (!adjacency.has(rel.from_entity_id)) {
        adjacency.set(rel.from_entity_id, []);
      }
      adjacency.get(rel.from_entity_id)!.push({
        to: rel.to_entity_id,
        type: rel.relationship_type,
      });
    }

    // Find paths between all entity pairs (up to maxDepth)
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const path = this.bfs(
          entities[i].id,
          entities[j].id,
          adjacency,
          maxDepth
        );
        if (path) {
          paths.push({
            from: entities[i].name,
            to: entities[j].name,
            path: path.nodes,
            relationship_types: path.types,
          });
        }
      }
    }

    return paths;
  }

  /**
   * BFS path finding
   */
  private bfs(
    start: string,
    end: string,
    adjacency: Map<string, Array<{ to: string; type: RelationshipType }>>,
    maxDepth: number
  ): { nodes: string[]; types: RelationshipType[] } | null {
    const queue: Array<{ node: string; path: string[]; types: RelationshipType[] }> = [
      { node: start, path: [start], types: [] },
    ];
    const visited = new Set<string>([start]);

    while (queue.length > 0 && queue[0].path.length <= maxDepth + 1) {
      const current = queue.shift()!;

      if (current.node === end) {
        return { nodes: current.path, types: current.types };
      }

      const neighbors = adjacency.get(current.node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.to)) {
          visited.add(neighbor.to);
          queue.push({
            node: neighbor.to,
            path: [...current.path, neighbor.to],
            types: [...current.types, neighbor.type],
          });
        }
      }
    }

    return null;
  }
}
