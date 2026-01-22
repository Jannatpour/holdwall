/**
 * Entity Mapper
 * 
 * Maps entity relationships to build knowledge graphs that connect
 * brand to authoritative sources for better AI understanding.
 */

export interface Entity {
  id: string;
  name: string;
  type: "brand" | "person" | "organization" | "product" | "concept";
  properties: Record<string, unknown>;
}

export interface EntityRelationship {
  from: string; // Entity ID
  to: string; // Entity ID
  type: "relatedTo" | "partOf" | "createdBy" | "mentionedIn" | "authorOf";
  strength: number; // 0-1
  evidence?: string[];
}

export interface EntityGraph {
  entities: Map<string, Entity>;
  relationships: EntityRelationship[];
}

export class EntityMapper {
  private graph: EntityGraph = {
    entities: new Map(),
    relationships: [],
  };

  /**
   * Register an entity
   */
  registerEntity(entity: Entity): void {
    this.graph.entities.set(entity.id, entity);
  }

  /**
   * Create relationship between entities
   */
  createRelationship(relationship: EntityRelationship): void {
    // Validate entities exist
    if (!this.graph.entities.has(relationship.from)) {
      throw new Error(`Entity ${relationship.from} not found`);
    }
    if (!this.graph.entities.has(relationship.to)) {
      throw new Error(`Entity ${relationship.to} not found`);
    }

    this.graph.relationships.push(relationship);
  }

  /**
   * Map brand to authoritative sources
   */
  mapBrandToSources(
    brandId: string,
    sources: Array<{ name: string; type: string; url?: string; authority: number }>
  ): void {
    // Ensure brand entity exists
    if (!this.graph.entities.has(brandId)) {
      this.registerEntity({
        id: brandId,
        name: brandId,
        type: "brand",
        properties: {},
      });
    }

    // Create relationships to sources
    for (const source of sources) {
      const sourceId = `source-${source.name.toLowerCase().replace(/\s+/g, "-")}`;

      // Register source entity
      if (!this.graph.entities.has(sourceId)) {
        this.registerEntity({
          id: sourceId,
          name: source.name,
          type: "organization",
          properties: {
            url: source.url,
            authority: source.authority,
          },
        });
      }

      // Create relationship
      this.createRelationship({
        from: brandId,
        to: sourceId,
        type: "mentionedIn",
        strength: source.authority,
        evidence: source.url ? [source.url] : undefined,
      });
    }
  }

  /**
   * Get entity graph as JSON-LD
   */
  toJSONLD(): object {
    const entities: any[] = [];
    const relationships: any[] = [];

    // Convert entities
    for (const entity of this.graph.entities.values()) {
      entities.push({
        "@id": `#${entity.id}`,
        "@type": this.mapEntityType(entity.type),
        name: entity.name,
        ...entity.properties,
      });
    }

    // Convert relationships
    for (const rel of this.graph.relationships) {
      relationships.push({
        "@id": `#${rel.from}`,
        [this.mapRelationshipType(rel.type)]: {
          "@id": `#${rel.to}`,
        },
      });
    }

    return {
      "@context": "https://schema.org",
      "@graph": [...entities, ...relationships],
    };
  }

  /**
   * Map entity type to schema.org type
   */
  private mapEntityType(type: Entity["type"]): string {
    const mapping: Record<Entity["type"], string> = {
      brand: "Brand",
      person: "Person",
      organization: "Organization",
      product: "Product",
      concept: "Thing",
    };

    return mapping[type] || "Thing";
  }

  /**
   * Map relationship type to schema.org property
   */
  private mapRelationshipType(type: EntityRelationship["type"]): string {
    const mapping: Record<EntityRelationship["type"], string> = {
      relatedTo: "relatedTo",
      partOf: "partOf",
      createdBy: "creator",
      mentionedIn: "mentions",
      authorOf: "author",
    };

    return mapping[type] || "relatedTo";
  }

  /**
   * Find related entities
   */
  findRelated(entityId: string, maxDepth: number = 2): Entity[] {
    const related = new Set<string>();
    const visited = new Set<string>();

    const traverse = (id: string, depth: number) => {
      if (depth > maxDepth || visited.has(id)) {
        return;
      }

      visited.add(id);

      for (const rel of this.graph.relationships) {
        if (rel.from === id) {
          related.add(rel.to);
          traverse(rel.to, depth + 1);
        } else if (rel.to === id) {
          related.add(rel.from);
          traverse(rel.from, depth + 1);
        }
      }
    };

    traverse(entityId, 0);

    return Array.from(related)
      .map(id => this.graph.entities.get(id))
      .filter((e): e is Entity => e !== undefined);
  }

  /**
   * Get graph statistics
   */
  getStats(): {
    entityCount: number;
    relationshipCount: number;
    averageRelationships: number;
  } {
    const entityCount = this.graph.entities.size;
    const relationshipCount = this.graph.relationships.length;
    const averageRelationships = entityCount > 0 
      ? relationshipCount / entityCount 
      : 0;

    return {
      entityCount,
      relationshipCount,
      averageRelationships,
    };
  }
}
