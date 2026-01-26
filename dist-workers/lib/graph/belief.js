"use strict";
/**
 * Belief Graph Engineering (BGE)
 *
 * Model reinforcement/decay paths, time decay, actor weighting, reinforcement/neutralization edges
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BeliefGraphService = void 0;
class BeliefGraphService {
    constructor(eventStore) {
        this.eventStore = eventStore;
        this.nodes = new Map();
        this.edges = new Map();
    }
    /**
     * Create or update a belief node
     */
    async upsertNode(node) {
        const node_id = `node-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const fullNode = {
            ...node,
            node_id,
            created_at: new Date().toISOString(),
        };
        this.nodes.set(node_id, fullNode);
        // Emit event
        const event = {
            event_id: crypto.randomUUID(),
            tenant_id: node.tenant_id,
            actor_id: "belief-graph",
            type: "graph.node.created",
            occurred_at: new Date().toISOString(),
            correlation_id: crypto.randomUUID(),
            schema_version: "1.0",
            evidence_refs: [],
            payload: {
                node_id,
                type: node.type,
            },
            signatures: [],
        };
        await this.eventStore.append(event);
        return node_id;
    }
    /**
     * Create or update a belief edge
     */
    async upsertEdge(edge) {
        const edge_id = `edge-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const fullEdge = {
            ...edge,
            edge_id,
            created_at: new Date().toISOString(),
        };
        this.edges.set(edge_id, fullEdge);
        // Emit event
        const event = {
            event_id: crypto.randomUUID(),
            tenant_id: edge.tenant_id,
            actor_id: "belief-graph",
            type: "graph.edge.created",
            occurred_at: new Date().toISOString(),
            correlation_id: crypto.randomUUID(),
            schema_version: "1.0",
            evidence_refs: [],
            payload: {
                edge_id,
                from_node_id: edge.from_node_id,
                to_node_id: edge.to_node_id,
                type: edge.type,
            },
            signatures: [],
        };
        await this.eventStore.append(event);
        return edge_id;
    }
    /**
     * Apply time decay to nodes
     */
    async applyTimeDecay(node_id, current_time) {
        const node = this.nodes.get(node_id);
        if (!node) {
            return;
        }
        const age_ms = new Date(current_time).getTime() - new Date(node.created_at).getTime();
        const age_days = age_ms / (1000 * 60 * 60 * 24);
        // Apply decay: trust_score *= decay_factor^age_days
        const decayed_trust = node.trust_score * Math.pow(node.decay_factor, age_days);
        const decayed_decisiveness = node.decisiveness * Math.pow(node.decay_factor, age_days);
        node.trust_score = decayed_trust;
        node.decisiveness = decayed_decisiveness;
        node.updated_at = current_time;
        this.nodes.set(node_id, node);
    }
    /**
     * Find reinforcement/neutralization paths
     */
    async findPaths(from_node_id, to_node_id, max_depth = 5) {
        const paths = [];
        // Simple BFS pathfinding
        const queue = [{ path: [from_node_id], trust_impact: 0, strength: 1 }];
        while (queue.length > 0 && paths.length < 10) {
            const current = queue.shift();
            const current_node_id = current.path[current.path.length - 1];
            if (current_node_id === to_node_id) {
                // Found a path
                const nodes = current.path.map((id) => this.nodes.get(id)).filter(Boolean);
                const edges = [];
                for (let i = 0; i < current.path.length - 1; i++) {
                    const edge = Array.from(this.edges.values()).find((e) => e.from_node_id === current.path[i] &&
                        e.to_node_id === current.path[i + 1]);
                    if (edge) {
                        edges.push(edge);
                    }
                }
                paths.push({
                    path_id: `path-${paths.length}`,
                    nodes,
                    edges,
                    trust_impact: current.trust_impact,
                    strength: current.strength,
                });
                continue;
            }
            if (current.path.length >= max_depth) {
                continue;
            }
            // Find neighbors
            const neighbors = Array.from(this.edges.values())
                .filter((e) => e.from_node_id === current_node_id)
                .map((e) => e.to_node_id);
            for (const neighbor_id of neighbors) {
                if (current.path.includes(neighbor_id)) {
                    continue; // Avoid cycles
                }
                const edge = Array.from(this.edges.values()).find((e) => e.from_node_id === current_node_id && e.to_node_id === neighbor_id);
                if (edge) {
                    queue.push({
                        path: [...current.path, neighbor_id],
                        trust_impact: current.trust_impact + edge.weight,
                        strength: current.strength * Math.abs(edge.weight),
                    });
                }
            }
        }
        return paths;
    }
    /**
     * Get node with actor weighting applied
     */
    getNodeWithWeighting(node_id, actor_id) {
        const node = this.nodes.get(node_id);
        if (!node) {
            return null;
        }
        if (!actor_id) {
            return node;
        }
        // Apply actor weighting
        const actor_weight = node.actor_weights[actor_id] || 1.0;
        return {
            ...node,
            trust_score: node.trust_score * actor_weight,
            decisiveness: node.decisiveness * actor_weight,
        };
    }
    /**
     * Get nodes for a tenant with optional filters
     */
    async getNodes(tenant_id, options) {
        const allNodes = Array.from(this.nodes.values()).filter((n) => n.tenant_id === tenant_id && (!options?.type || n.type === options.type));
        // Sort by created_at descending and limit
        const sorted = allNodes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return sorted.slice(0, options?.limit || 100);
    }
}
exports.BeliefGraphService = BeliefGraphService;
