"use strict";
/**
 * Production Belief Graph Implementation
 * Database-backed belief graph
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseBeliefGraphService = void 0;
const client_1 = require("@/lib/db/client");
const store_db_1 = require("@/lib/events/store-db");
const eventStore = new store_db_1.DatabaseEventStore();
class DatabaseBeliefGraphService {
    constructor() {
        this.calibrationEngine = null;
    }
    getCalibrationEngine() {
        if (!this.calibrationEngine) {
            this.calibrationEngine = (async () => {
                const { CalibrationEngine } = await Promise.resolve().then(() => __importStar(require("@/lib/graph/calibration")));
                return new CalibrationEngine();
            })();
        }
        return this.calibrationEngine;
    }
    async upsertNode(node) {
        // Apply calibration to trust score if calibration model exists
        let calibratedTrustScore = node.trust_score;
        try {
            const calibration = await this.getCalibrationEngine();
            const calibrated = calibration.calibrate(`${node.tenant_id}:trust`, node.trust_score);
            calibratedTrustScore = calibrated.calibrated_score;
        }
        catch (error) {
            // If calibration fails, use raw score
        }
        const result = await client_1.db.beliefNode.create({
            data: {
                tenantId: node.tenant_id,
                type: node.type.toUpperCase(),
                content: node.content,
                trustScore: calibratedTrustScore,
                decisiveness: node.decisiveness,
                actorWeights: node.actor_weights,
                decayFactor: node.decay_factor,
            },
        });
        // Emit event
        await eventStore.append({
            event_id: crypto.randomUUID(),
            tenant_id: node.tenant_id,
            actor_id: "belief-graph",
            type: "graph.node.created",
            occurred_at: new Date().toISOString(),
            correlation_id: crypto.randomUUID(),
            schema_version: "1.0",
            evidence_refs: [],
            payload: {
                node_id: result.id,
                type: node.type,
            },
            signatures: [],
        });
        return result.id;
    }
    async upsertEdge(edge) {
        const result = await client_1.db.beliefEdge.create({
            data: {
                tenantId: edge.tenant_id,
                fromNodeId: edge.from_node_id,
                toNodeId: edge.to_node_id,
                type: edge.type.toUpperCase(),
                weight: edge.weight,
                actorWeights: edge.actor_weights,
            },
        });
        // Emit event
        await eventStore.append({
            event_id: crypto.randomUUID(),
            tenant_id: edge.tenant_id,
            actor_id: "belief-graph",
            type: "graph.edge.created",
            occurred_at: new Date().toISOString(),
            correlation_id: crypto.randomUUID(),
            schema_version: "1.0",
            evidence_refs: [],
            payload: {
                edge_id: result.id,
                from_node_id: edge.from_node_id,
                to_node_id: edge.to_node_id,
                type: edge.type,
            },
            signatures: [],
        });
        return result.id;
    }
    async findPaths(from_node_id, to_node_id, max_depth = 5, options) {
        // Enhanced pathfinding with actor weighting and edge type filtering
        const paths = [];
        const queue = [
            { path: [from_node_id], depth: 0, trust_impact: 0, strength: 1, edges: [] },
        ];
        const visited = new Map(); // node_id -> best_strength
        while (queue.length > 0 && paths.length < 20) {
            // Sort queue by strength (best first)
            queue.sort((a, b) => b.strength - a.strength);
            const current = queue.shift();
            const currentNodeId = current.path[current.path.length - 1];
            if (currentNodeId === to_node_id) {
                // Found a path - fetch nodes and edges
                const nodes = await client_1.db.beliefNode.findMany({
                    where: { id: { in: current.path } },
                });
                const edgeIds = current.edges;
                const edges = await client_1.db.beliefEdge.findMany({
                    where: { id: { in: edgeIds } },
                });
                // Apply time decay to nodes
                const currentTime = new Date().toISOString();
                const processedNodes = await Promise.all(nodes.map(async (n) => {
                    const age_ms = new Date(currentTime).getTime() - n.createdAt.getTime();
                    const age_days = age_ms / (1000 * 60 * 60 * 24);
                    const decayed_trust = n.trustScore * Math.pow(n.decayFactor, age_days);
                    const decayed_decisiveness = n.decisiveness * Math.pow(n.decayFactor, age_days);
                    // Apply actor weighting if specified
                    let final_trust = decayed_trust;
                    let final_decisiveness = decayed_decisiveness;
                    if (options?.actor_id) {
                        const actorWeights = n.actorWeights || {};
                        const actorWeight = actorWeights[options.actor_id] || 1.0;
                        final_trust *= actorWeight;
                        final_decisiveness *= actorWeight;
                    }
                    return {
                        node_id: n.id,
                        tenant_id: n.tenantId,
                        type: n.type.toLowerCase(),
                        content: n.content,
                        trust_score: final_trust,
                        decisiveness: final_decisiveness,
                        actor_weights: n.actorWeights,
                        created_at: n.createdAt.toISOString(),
                        updated_at: n.updatedAt?.toISOString(),
                        decay_factor: n.decayFactor,
                    };
                }));
                // Calculate path metrics with actor weighting
                let pathTrustImpact = 0;
                let pathStrength = 1;
                for (const edge of edges) {
                    let edgeWeight = edge.weight;
                    if (options?.actor_id) {
                        const actorWeights = edge.actorWeights || {};
                        const actorWeight = actorWeights[options.actor_id] || 1.0;
                        edgeWeight *= actorWeight;
                    }
                    pathTrustImpact += edgeWeight;
                    pathStrength *= Math.abs(edgeWeight) || 0.1;
                }
                // Filter by minimum strength if specified
                if (options?.min_strength && pathStrength < options.min_strength) {
                    continue;
                }
                paths.push({
                    path_id: `path-${paths.length}`,
                    nodes: processedNodes,
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
                    trust_impact: pathTrustImpact,
                    strength: pathStrength,
                });
                continue;
            }
            if (current.depth >= max_depth) {
                continue;
            }
            // Skip if we've found a better path to this node
            const existingStrength = visited.get(currentNodeId);
            if (existingStrength && existingStrength >= current.strength) {
                continue;
            }
            visited.set(currentNodeId, current.strength);
            // Get outgoing edges
            const whereClause = { fromNodeId: currentNodeId };
            if (options?.edge_types && options.edge_types.length > 0) {
                whereClause.type = { in: options.edge_types.map(t => t.toUpperCase()) };
            }
            const edges = await client_1.db.beliefEdge.findMany({
                where: whereClause,
                take: 20,
                orderBy: { weight: "desc" }, // Prefer stronger edges
            });
            for (const edge of edges) {
                if (current.path.includes(edge.toNodeId)) {
                    continue; // Avoid cycles
                }
                // Calculate edge contribution with actor weighting
                let edgeWeight = edge.weight;
                if (options?.actor_id) {
                    const actorWeights = edge.actorWeights || {};
                    const actorWeight = actorWeights[options.actor_id] || 1.0;
                    edgeWeight *= actorWeight;
                }
                const newTrustImpact = current.trust_impact + edgeWeight;
                const newStrength = current.strength * Math.abs(edgeWeight) || 0.1;
                queue.push({
                    path: [...current.path, edge.toNodeId],
                    depth: current.depth + 1,
                    trust_impact: newTrustImpact,
                    strength: newStrength,
                    edges: [...current.edges, edge.id],
                });
            }
        }
        // Sort paths by strength (best first)
        return paths.sort((a, b) => b.strength - a.strength);
    }
    async applyTimeDecay(node_id, current_time) {
        const node = await client_1.db.beliefNode.findUnique({
            where: { id: node_id },
        });
        if (!node) {
            return;
        }
        const age_ms = new Date(current_time).getTime() - node.createdAt.getTime();
        const age_days = age_ms / (1000 * 60 * 60 * 24);
        const decayed_trust = node.trustScore * Math.pow(node.decayFactor, age_days);
        const decayed_decisiveness = node.decisiveness * Math.pow(node.decayFactor, age_days);
        await client_1.db.beliefNode.update({
            where: { id: node_id },
            data: {
                trustScore: decayed_trust,
                decisiveness: decayed_decisiveness,
                updatedAt: new Date(current_time),
            },
        });
    }
    /**
     * Get nodes for a tenant with optional filters
     */
    async getNodes(tenant_id, options) {
        const nodes = await client_1.db.beliefNode.findMany({
            where: {
                tenantId: tenant_id,
                ...(options?.type ? { type: options.type.toUpperCase() } : {}),
            },
            take: options?.limit || 100,
            orderBy: { createdAt: "desc" },
        });
        return nodes.map((n) => ({
            node_id: n.id,
            tenant_id: n.tenantId,
            type: n.type.toLowerCase(),
            content: n.content,
            trust_score: n.trustScore,
            decisiveness: n.decisiveness,
            actor_weights: n.actorWeights || {},
            created_at: n.createdAt.toISOString(),
            updated_at: n.updatedAt?.toISOString(),
            decay_factor: n.decayFactor,
        }));
    }
}
exports.DatabaseBeliefGraphService = DatabaseBeliefGraphService;
