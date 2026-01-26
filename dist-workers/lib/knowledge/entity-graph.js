"use strict";
/**
 * Entity Knowledge Graph
 *
 * Builds and maintains entity/relationship graph for ownership, policies,
 * incidents, and vendors to improve consistency and long-horizon reasoning.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityKnowledgeGraph = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
const entity_tracker_1 = require("@/lib/temporal/entity-tracker");
class EntityKnowledgeGraph {
    constructor() {
        this.entityTracker = new entity_tracker_1.EntityTracker();
    }
    /**
     * Extract entities from evidence
     */
    async extractEntitiesFromEvidence(evidenceId, tenantId) {
        try {
            const evidence = await client_1.db.evidence.findUnique({
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
            const entityIds = [];
            for (const entityName of entities) {
                const entityType = this.inferEntityType(entityName, content);
                const entity = await this.entityTracker.trackEntityChange(tenantId, entityType, entityName, {
                    source_evidence: evidenceId,
                    extracted_at: new Date().toISOString(),
                });
                entityIds.push(entity.id);
            }
            return entityIds;
        }
        catch (error) {
            logger_1.logger.error("Failed to extract entities from evidence", {
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
    async extractRelationshipsFromEvidence(evidenceId, tenantId) {
        try {
            const evidence = await client_1.db.evidence.findUnique({
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
            const storedRelationships = [];
            for (const rel of relationships) {
                const stored = await this.createRelationship(tenantId, rel.from_entity, rel.to_entity, rel.type, rel.strength);
                if (stored) {
                    storedRelationships.push(stored);
                }
            }
            return storedRelationships;
        }
        catch (error) {
            logger_1.logger.error("Failed to extract relationships from evidence", {
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
    async queryGraph(tenantId, query) {
        try {
            const entities = [];
            const relationships = [];
            // Find entities
            if (query.entity_id) {
                const entity = await client_1.db.entity.findUnique({
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
            }
            else if (query.entity_name || query.entity_type) {
                const where = { tenantId };
                if (query.entity_name) {
                    where.OR = [
                        { name: query.entity_name },
                        { aliases: { has: query.entity_name } },
                    ];
                }
                if (query.entity_type) {
                    where.type = query.entity_type;
                }
                const found = await client_1.db.entity.findMany({ where });
                entities.push(...found.map((e) => ({
                    id: e.id,
                    name: e.name,
                    type: e.type,
                    state: e.currentState,
                })));
            }
            // Find relationships
            const relationshipWhere = { tenantId };
            if (query.entity_id) {
                relationshipWhere.OR = [
                    { fromEntityId: query.entity_id },
                    { toEntityId: query.entity_id },
                ];
            }
            if (query.relationship_type) {
                relationshipWhere.relationshipType = query.relationship_type;
            }
            const foundRelationships = await client_1.db.entityRelationship.findMany({
                where: relationshipWhere,
                take: query.depth ? 100 : 1000, // Limit for depth queries
            });
            relationships.push(...foundRelationships.map((r) => ({
                id: r.id,
                tenant_id: r.tenantId,
                from_entity_id: r.fromEntityId,
                to_entity_id: r.toEntityId,
                relationship_type: r.relationshipType,
                strength: r.strength,
                metadata: r.metadata || undefined,
                created_at: r.createdAt.toISOString(),
                updated_at: r.updatedAt.toISOString(),
            })));
            // Find paths (simplified - in production use graph traversal)
            const paths = this.findPaths(entities, relationships, query.depth || 2);
            return {
                entities,
                relationships,
                paths,
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to query entity graph", {
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
    async checkConsistency(tenantId) {
        try {
            const contradictions = [];
            // Get all entities
            const entities = await client_1.db.entity.findMany({
                where: { tenantId },
            });
            // Check for contradictory states
            for (const entity of entities) {
                const state = entity.currentState;
                const history = entity.stateHistory || [];
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
        }
        catch (error) {
            logger_1.logger.error("Failed to check graph consistency", {
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
    extractEntityNames(content) {
        // Simple extraction (in production use NER)
        const entities = [];
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
    inferEntityType(name, content) {
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
    extractRelationships(content, tenantId) {
        const relationships = [];
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
    async createRelationship(tenantId, fromEntityName, toEntityName, type, strength) {
        try {
            // Find entities
            const fromEntity = await this.entityTracker.getEntity(tenantId, "OTHER", fromEntityName);
            const toEntity = await this.entityTracker.getEntity(tenantId, "OTHER", toEntityName);
            if (!fromEntity || !toEntity) {
                return null;
            }
            // Check if relationship exists
            const existing = await client_1.db.entityRelationship.findUnique({
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
                const updated = await client_1.db.entityRelationship.update({
                    where: { id: existing.id },
                    data: { strength: Math.max(existing.strength, strength) },
                });
                return {
                    id: updated.id,
                    tenant_id: updated.tenantId,
                    from_entity_id: updated.fromEntityId,
                    to_entity_id: updated.toEntityId,
                    relationship_type: updated.relationshipType,
                    strength: updated.strength,
                    metadata: updated.metadata || undefined,
                    created_at: updated.createdAt.toISOString(),
                    updated_at: updated.updatedAt.toISOString(),
                };
            }
            // Create new relationship
            const relationship = await client_1.db.entityRelationship.create({
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
                relationship_type: relationship.relationshipType,
                strength: relationship.strength,
                metadata: relationship.metadata || undefined,
                created_at: relationship.createdAt.toISOString(),
                updated_at: relationship.updatedAt.toISOString(),
            };
        }
        catch (error) {
            logger_1.logger.warn("Failed to create relationship", {
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
    findPaths(entities, relationships, maxDepth) {
        const paths = [];
        if (entities.length < 2) {
            return paths;
        }
        // Build adjacency map
        const adjacency = new Map();
        for (const rel of relationships) {
            if (!adjacency.has(rel.from_entity_id)) {
                adjacency.set(rel.from_entity_id, []);
            }
            adjacency.get(rel.from_entity_id).push({
                to: rel.to_entity_id,
                type: rel.relationship_type,
            });
        }
        // Find paths between all entity pairs (up to maxDepth)
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const path = this.bfs(entities[i].id, entities[j].id, adjacency, maxDepth);
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
    bfs(start, end, adjacency, maxDepth) {
        const queue = [
            { node: start, path: [start], types: [] },
        ];
        const visited = new Set([start]);
        while (queue.length > 0 && queue[0].path.length <= maxDepth + 1) {
            const current = queue.shift();
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
exports.EntityKnowledgeGraph = EntityKnowledgeGraph;
