"use strict";
/**
 * Relational Graph Perceiver (RGP)
 *
 * Cross-attention-based latent bottleneck integrating long-range
 * spatial and temporal dependencies for belief graph reasoning.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelationalGraphPerceiver = void 0;
class RelationalGraphPerceiver {
    constructor() {
        this.openaiApiKey = null;
        this.openaiApiKey = process.env.OPENAI_API_KEY || null;
    }
    /**
     * Process graph with cross-attention
     */
    async process(query, nodes, edges, options) {
        const { maxNodes = 20, temporalWindow = 30 } = options || {};
        // Filter nodes by temporal relevance
        const now = Date.now();
        const relevantNodes = nodes.filter(node => {
            const nodeTime = new Date(node.created_at).getTime();
            const age = (now - nodeTime) / (1000 * 60 * 60 * 24); // days
            return age <= temporalWindow;
        }).slice(0, maxNodes);
        // Build attention mechanism
        const attention = await this.buildAttention(query, relevantNodes, edges);
        // Generate reasoning
        const reasoning = await this.generateReasoning(query, relevantNodes, edges, attention);
        return {
            query,
            nodes: relevantNodes,
            edges: edges.filter(e => relevantNodes.some(n => n.node_id === e.from_node_id || n.node_id === e.to_node_id)),
            attention,
            reasoning,
            confidence: this.calculateConfidence(attention, relevantNodes),
        };
    }
    /**
     * Build cross-attention mechanism
     */
    async buildAttention(query, nodes, edges) {
        const attentions = [];
        // For each node, calculate attention to other nodes
        for (const queryNode of nodes) {
            const keyNodes = nodes.filter(n => n.node_id !== queryNode.node_id);
            const attentionWeights = [];
            for (const keyNode of keyNodes) {
                // Calculate attention weight
                const weight = this.calculateAttentionWeight(queryNode, keyNode, edges, query);
                attentionWeights.push(weight);
            }
            attentions.push({
                queryNode: queryNode.node_id,
                keyNodes: keyNodes.map(n => n.node_id),
                attentionWeights,
                context: this.buildContext(queryNode, keyNodes, edges),
            });
        }
        return attentions;
    }
    /**
     * Calculate attention weight
     */
    calculateAttentionWeight(queryNode, keyNode, edges, query) {
        let weight = 0.5; // Base weight
        // Check if nodes are connected
        const edge = edges.find(e => (e.from_node_id === queryNode.node_id && e.to_node_id === keyNode.node_id) ||
            (e.from_node_id === keyNode.node_id && e.to_node_id === queryNode.node_id));
        if (edge) {
            weight += Math.abs(edge.weight) * 0.3;
        }
        // Semantic similarity to query
        const queryWords = new Set(query.toLowerCase().split(/\s+/));
        const nodeWords = new Set((queryNode.content + " " + keyNode.content).toLowerCase().split(/\s+/));
        const intersection = new Set([...queryWords].filter((w) => nodeWords.has(w)));
        const similarity = queryWords.size > 0 ? intersection.size / queryWords.size : 0;
        weight += similarity * 0.2;
        return Math.min(1, weight);
    }
    /**
     * Build context from attention
     */
    buildContext(queryNode, keyNodes, edges) {
        const contextParts = [];
        contextParts.push(`Query node: ${queryNode.content}`);
        // Add connected nodes
        const connected = keyNodes.filter(kn => {
            return edges.some(e => (e.from_node_id === queryNode.node_id && e.to_node_id === kn.node_id) ||
                (e.from_node_id === kn.node_id && e.to_node_id === queryNode.node_id));
        });
        if (connected.length > 0) {
            contextParts.push(`Connected nodes: ${connected.map(n => n.content).join(", ")}`);
        }
        return contextParts.join(". ");
    }
    /**
     * Generate reasoning
     */
    async generateReasoning(query, nodes, edges, attention) {
        if (!this.openaiApiKey) {
            return `Analyzed ${nodes.length} nodes and ${edges.length} edges using cross-attention`;
        }
        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.openaiApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: "Provide reasoning about belief graph relationships using cross-attention analysis.",
                        },
                        {
                            role: "user",
                            content: `Query: ${query}\n\nNodes: ${nodes.map(n => n.content).join(", ")}\n\nAnalyze relationships:`,
                        },
                    ],
                    temperature: 0.3,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                return data.choices[0]?.message?.content || "";
            }
        }
        catch (error) {
            console.warn("Reasoning generation failed:", error);
        }
        return `Analyzed ${nodes.length} nodes with cross-attention`;
    }
    /**
     * Calculate confidence
     */
    calculateConfidence(attention, nodes) {
        if (attention.length === 0 || nodes.length === 0) {
            return 0.5;
        }
        // Average attention weights
        const avgAttention = attention.reduce((sum, a) => {
            const avg = a.attentionWeights.reduce((s, w) => s + w, 0) / a.attentionWeights.length;
            return sum + avg;
        }, 0) / attention.length;
        // Node trust scores
        const avgTrust = nodes.reduce((sum, n) => sum + n.trust_score, 0) / nodes.length;
        return (avgAttention + (avgTrust + 1) / 2) / 2; // Normalize trust to 0-1
    }
}
exports.RelationalGraphPerceiver = RelationalGraphPerceiver;
