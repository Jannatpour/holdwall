"use strict";
/**
 * Neural Graphical Models (NGMs)
 *
 * Hybrids using GNNs to represent probability functions for
 * complex reasoning over graph structures.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NeuralGraphicalModel = void 0;
class NeuralGraphicalModel {
    constructor() {
        this.openaiApiKey = null;
        this.openaiApiKey = process.env.OPENAI_API_KEY || null;
    }
    /**
     * Reason over graph with probabilistic model
     */
    async reason(query, nodes, edges) {
        // Build probability distributions for each node
        const distributions = [];
        for (const node of nodes) {
            const distribution = await this.buildProbabilityDistribution(node, edges.filter(e => e.from_node_id === node.node_id || e.to_node_id === node.node_id), nodes);
            distributions.push(distribution);
        }
        // Aggregate to find most likely outcome
        const mostLikelyOutcome = this.findMostLikelyOutcome(distributions, query);
        // Generate reasoning
        const reasoning = await this.generateReasoning(query, distributions, nodes, edges);
        return {
            query,
            distributions,
            reasoning,
            mostLikelyOutcome,
        };
    }
    /**
     * Build probability distribution for node
     */
    async buildProbabilityDistribution(node, connectedEdges, allNodes) {
        const outcomes = [];
        // Outcome 1: Reinforcement
        const reinforcementProb = this.calculateOutcomeProbability(node, "reinforcement", connectedEdges.filter(e => e.type === "reinforcement"));
        outcomes.push({
            outcome: "reinforcement",
            probability: reinforcementProb,
        });
        // Outcome 2: Neutralization
        const neutralizationProb = this.calculateOutcomeProbability(node, "neutralization", connectedEdges.filter(e => e.type === "neutralization"));
        outcomes.push({
            outcome: "neutralization",
            probability: neutralizationProb,
        });
        // Outcome 3: Decay
        const age = (Date.now() - new Date(node.created_at).getTime()) / (1000 * 60 * 60 * 24);
        const decayProb = age > 30 ? Math.min(0.6, age / 100) : 0.2;
        outcomes.push({
            outcome: "decay",
            probability: decayProb,
        });
        // Outcome 4: Stability
        const stabilityProb = 1 - reinforcementProb - neutralizationProb - decayProb;
        outcomes.push({
            outcome: "stability",
            probability: Math.max(0, stabilityProb),
        });
        // Normalize probabilities
        const total = outcomes.reduce((sum, o) => sum + o.probability, 0);
        for (const outcome of outcomes) {
            outcome.probability = total > 0 ? outcome.probability / total : 0.25;
        }
        return {
            nodeId: node.node_id,
            outcomes,
            confidence: this.calculateDistributionConfidence(outcomes, connectedEdges),
        };
    }
    /**
     * Calculate outcome probability
     */
    calculateOutcomeProbability(node, outcome, relevantEdges) {
        if (relevantEdges.length === 0) {
            return 0.2; // Low base probability
        }
        // Base probability from edge count
        let probability = Math.min(0.6, relevantEdges.length * 0.15);
        // Adjust based on node state
        if (outcome === "reinforcement" && node.trust_score > 0) {
            probability += 0.2;
        }
        else if (outcome === "neutralization" && node.trust_score < 0) {
            probability += 0.2;
        }
        // Edge weight contribution
        const avgWeight = relevantEdges.reduce((sum, e) => sum + Math.abs(e.weight), 0) /
            relevantEdges.length;
        probability += avgWeight * 0.2;
        return Math.min(0.8, probability);
    }
    /**
     * Calculate distribution confidence
     */
    calculateDistributionConfidence(outcomes, edges) {
        // Higher confidence if one outcome dominates
        const maxProb = Math.max(...outcomes.map(o => o.probability));
        const entropy = -outcomes.reduce((sum, o) => {
            if (o.probability > 0) {
                return sum + o.probability * Math.log2(o.probability);
            }
            return sum;
        }, 0);
        // Lower entropy = higher confidence
        const confidence = 1 - (entropy / Math.log2(outcomes.length));
        // Edge count boost
        const edgeBoost = Math.min(0.2, edges.length * 0.05);
        return Math.min(1, confidence + edgeBoost);
    }
    /**
     * Find most likely outcome
     */
    findMostLikelyOutcome(distributions, query) {
        // Aggregate outcomes across all nodes
        const outcomeScores = {};
        for (const dist of distributions) {
            for (const outcome of dist.outcomes) {
                outcomeScores[outcome.outcome] =
                    (outcomeScores[outcome.outcome] || 0) + outcome.probability * dist.confidence;
            }
        }
        // Find highest scoring outcome
        const mostLikely = Object.entries(outcomeScores)
            .sort((a, b) => b[1] - a[1])[0];
        return mostLikely?.[0] || "stability";
    }
    /**
     * Generate reasoning
     */
    async generateReasoning(query, distributions, nodes, edges) {
        if (!this.openaiApiKey) {
            return `Probabilistic reasoning over ${nodes.length} nodes suggests ${this.findMostLikelyOutcome(distributions, query)}`;
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
                            content: "Provide probabilistic reasoning about belief graph outcomes.",
                        },
                        {
                            role: "user",
                            content: `Query: ${query}\n\nProbability distributions: ${JSON.stringify(distributions.slice(0, 3))}\n\nReason:`,
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
        return `Probabilistic analysis of ${nodes.length} nodes`;
    }
}
exports.NeuralGraphicalModel = NeuralGraphicalModel;
