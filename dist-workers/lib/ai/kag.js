"use strict";
/**
 * KAG (Knowledge-Augmented Generation) Pipeline
 * Production KAG implementation for knowledge graph augmentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KAGPipeline = void 0;
const client_1 = require("@/lib/db/client");
class KAGPipeline {
    /**
     * Retrieve knowledge graph context for a query
     */
    async retrieve(query, tenant_id, options) {
        const maxNodes = options?.max_nodes || 20;
        const maxDepth = options?.max_depth || 3;
        // Search for relevant nodes
        const nodes = await client_1.db.beliefNode.findMany({
            where: {
                tenantId: tenant_id,
                OR: [
                    { content: { contains: query, mode: "insensitive" } },
                ],
            },
            take: maxNodes,
        });
        const nodeIds = nodes.map((n) => n.id);
        // Get edges connecting these nodes
        const edges = await client_1.db.beliefEdge.findMany({
            where: {
                tenantId: tenant_id,
                OR: [
                    { fromNodeId: { in: nodeIds } },
                    { toNodeId: { in: nodeIds } },
                ],
            },
        });
        // Build knowledge graph structure
        const knowledge_graph = {
            nodes: nodes.map((n) => ({
                id: n.id,
                content: n.content,
                trust_score: n.trustScore,
                type: n.type,
            })),
            edges: edges.map((e) => ({
                from: e.fromNodeId,
                to: e.toNodeId,
                type: e.type,
                weight: e.weight,
            })),
        };
        // Build context string
        const contextParts = nodes.map((node) => {
            return `[Node: ${node.type}] ${node.content} (Trust: ${node.trustScore.toFixed(2)})`;
        });
        const context = contextParts.join("\n");
        return {
            query,
            nodes: nodes.map((n) => ({
                node_id: n.id,
                tenant_id: n.tenantId,
                type: n.type.toLowerCase(),
                content: n.content,
                trust_score: n.trustScore,
                decisiveness: n.decisiveness,
                actor_weights: n.actorWeights,
                created_at: n.createdAt.toISOString(),
                updated_at: n.updatedAt?.toISOString(),
                decay_factor: n.decayFactor,
            })),
            edges: edges.map((e) => ({
                edge_id: e.id,
                tenant_id: e.tenantId,
                from_node_id: e.fromNodeId,
                to_node_id: e.toNodeId,
                type: e.type.toLowerCase(),
                weight: e.weight,
                actor_weights: e.actorWeights,
                created_at: e.createdAt.toISOString(),
                updated_at: e.updatedAt?.toISOString(),
            })),
            knowledge_graph,
            context,
        };
    }
}
exports.KAGPipeline = KAGPipeline;
