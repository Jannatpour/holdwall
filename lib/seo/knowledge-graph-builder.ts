/**
 * Knowledge Graph Builder
 * 
 * Builds knowledge graphs that connect brand to authoritative sources
 * and make entity relationships visible to AI crawlers.
 */

import { EntityMapper, Entity, EntityRelationship } from "./entity-mapper";

export interface KnowledgeGraph {
  brand: Entity;
  entities: Entity[];
  relationships: EntityRelationship[];
  jsonld: object;
}

export interface KnowledgeGraphOptions {
  brandName: string;
  brandProperties?: Record<string, unknown>;
  authoritativeSources?: Array<{
    name: string;
    type: string;
    url?: string;
    authority: number;
  }>;
  relatedEntities?: Array<{
    name: string;
    type: Entity["type"];
    relationship: EntityRelationship["type"];
  }>;
}

export class KnowledgeGraphBuilder {
  private entityMapper: EntityMapper;

  constructor() {
    this.entityMapper = new EntityMapper();
  }

  /**
   * Build knowledge graph for brand
   */
  async buildGraph(
    options: KnowledgeGraphOptions
  ): Promise<KnowledgeGraph> {
    const { brandName, brandProperties = {}, authoritativeSources = [], relatedEntities = [] } = options;

    // Register brand entity
    const brandId = `brand-${brandName.toLowerCase().replace(/\s+/g, "-")}`;
    const brandEntity: Entity = {
      id: brandId,
      name: brandName,
      type: "brand",
      properties: {
        ...brandProperties,
        "@type": "Brand",
      },
    };

    this.entityMapper.registerEntity(brandEntity);

    // Map to authoritative sources
    if (authoritativeSources.length > 0) {
      this.entityMapper.mapBrandToSources(brandId, authoritativeSources);
    }

    // Add related entities
    for (const related of relatedEntities) {
      const relatedId = `entity-${related.name.toLowerCase().replace(/\s+/g, "-")}`;

      // Register related entity
      if (!this.entityMapper["graph"].entities.has(relatedId)) {
        this.entityMapper.registerEntity({
          id: relatedId,
          name: related.name,
          type: related.type,
          properties: {},
        });
      }

      // Create relationship
      this.entityMapper.createRelationship({
        from: brandId,
        to: relatedId,
        type: related.relationship,
        strength: 0.8,
      });
    }

    // Get all entities and relationships
    const entities = Array.from(this.entityMapper["graph"].entities.values());
    const relationships = this.entityMapper["graph"].relationships;

    // Generate JSON-LD
    const jsonld = this.entityMapper.toJSONLD();

    return {
      brand: brandEntity,
      entities,
      relationships,
      jsonld,
    };
  }

  /**
   * Add entity to existing graph
   */
  addEntity(
    brandName: string,
    entity: Entity,
    relationship: EntityRelationship
  ): void {
    const brandId = `brand-${brandName.toLowerCase().replace(/\s+/g, "-")}`;

    this.entityMapper.registerEntity(entity);
    this.entityMapper.createRelationship({
      ...relationship,
      from: brandId,
    });
  }

  /**
   * Get knowledge graph as JSON-LD for embedding in pages
   */
  getJSONLD(brandName: string): object {
    return this.entityMapper.toJSONLD();
  }

  /**
   * Export knowledge graph
   */
  exportGraph(brandName: string): KnowledgeGraph {
    const brandId = `brand-${brandName.toLowerCase().replace(/\s+/g, "-")}`;
    const brand = this.entityMapper["graph"].entities.get(brandId);

    if (!brand) {
      throw new Error(`Brand ${brandName} not found in graph`);
    }

    const entities = Array.from(this.entityMapper["graph"].entities.values());
    const relationships = this.entityMapper["graph"].relationships.filter(
      r => r.from === brandId || r.to === brandId
    );

    return {
      brand,
      entities,
      relationships,
      jsonld: this.entityMapper.toJSONLD(),
    };
  }
}
