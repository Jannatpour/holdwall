"use strict";
/**
 * Explainable Temporal Relation Tree-Graphs
 *
 * Forecast events within knowledge graphs with explainable
 * reasoning traces.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExplainableForecastEngine = void 0;
class ExplainableForecastEngine {
    constructor() {
        this.openaiApiKey = null;
        this.openaiApiKey = process.env.OPENAI_API_KEY || null;
    }
    /**
     * Forecast events with explanations
     */
    async forecast(query, nodes, edges, timeWindow = 7 // days
    ) {
        const events = [];
        // Analyze each node for potential events
        for (const node of nodes) {
            const nodeEvents = await this.forecastNodeEvents(node, edges.filter(e => e.from_node_id === node.node_id || e.to_node_id === node.node_id), timeWindow);
            events.push(...nodeEvents);
        }
        // Generate explanation
        const explanation = await this.generateExplanation(query, events, nodes, edges);
        return {
            query,
            events: events.sort((a, b) => b.probability - a.probability),
            explanation,
        };
    }
    /**
     * Forecast events for a node
     */
    async forecastNodeEvents(node, connectedEdges, timeWindow) {
        const events = [];
        // Analyze reinforcement potential
        const reinforcementEdges = connectedEdges.filter(e => e.type === "reinforcement");
        if (reinforcementEdges.length > 0) {
            const probability = this.calculateEventProbability(node, "reinforcement", reinforcementEdges);
            if (probability > 0.3) {
                events.push({
                    nodeId: node.node_id,
                    eventType: "reinforcement",
                    probability,
                    timeframe: {
                        start: new Date().toISOString(),
                        end: new Date(Date.now() + timeWindow * 24 * 60 * 60 * 1000).toISOString(),
                    },
                    reasoning: `${reinforcementEdges.length} reinforcement edges suggest strengthening`,
                    factors: reinforcementEdges.map(e => ({
                        factor: `Edge ${e.edge_id}`,
                        contribution: e.weight,
                    })),
                });
            }
        }
        // Analyze neutralization potential
        const neutralizationEdges = connectedEdges.filter(e => e.type === "neutralization");
        if (neutralizationEdges.length > 0) {
            const probability = this.calculateEventProbability(node, "neutralization", neutralizationEdges);
            if (probability > 0.3) {
                events.push({
                    nodeId: node.node_id,
                    eventType: "neutralization",
                    probability,
                    timeframe: {
                        start: new Date().toISOString(),
                        end: new Date(Date.now() + timeWindow * 24 * 60 * 60 * 1000).toISOString(),
                    },
                    reasoning: `${neutralizationEdges.length} neutralization edges suggest weakening`,
                    factors: neutralizationEdges.map(e => ({
                        factor: `Edge ${e.edge_id}`,
                        contribution: Math.abs(e.weight),
                    })),
                });
            }
        }
        // Analyze decay potential
        const age = (Date.now() - new Date(node.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (age > 30 && node.decay_factor < 0.9) {
            events.push({
                nodeId: node.node_id,
                eventType: "decay",
                probability: Math.min(0.8, age / 100),
                timeframe: {
                    start: new Date().toISOString(),
                    end: new Date(Date.now() + timeWindow * 24 * 60 * 60 * 1000).toISOString(),
                },
                reasoning: `Node age ${Math.round(age)} days with decay factor ${node.decay_factor}`,
                factors: [
                    { factor: "age", contribution: age / 100 },
                    { factor: "decay_factor", contribution: 1 - node.decay_factor },
                ],
            });
        }
        return events;
    }
    /**
     * Calculate event probability
     */
    calculateEventProbability(node, eventType, edges) {
        let probability = 0.3; // Base probability
        // Edge strength contribution
        const edgeStrength = edges.reduce((sum, e) => sum + Math.abs(e.weight), 0) / edges.length;
        probability += edgeStrength * 0.3;
        // Node state contribution
        if (eventType === "reinforcement" && node.trust_score > 0) {
            probability += 0.2;
        }
        else if (eventType === "neutralization" && node.trust_score < 0) {
            probability += 0.2;
        }
        return Math.min(0.9, probability);
    }
    /**
     * Generate explanation
     */
    async generateExplanation(query, events, nodes, edges) {
        if (!this.openaiApiKey) {
            return {
                summary: `Forecast ${events.length} potential events across ${nodes.length} nodes`,
                reasoning: events.map(e => e.reasoning),
                confidence: 0.7,
            };
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
                            content: "Explain forecast events in the belief graph with clear reasoning.",
                        },
                        {
                            role: "user",
                            content: `Query: ${query}\n\nEvents: ${JSON.stringify(events.slice(0, 5))}\n\nExplain:`,
                        },
                    ],
                    temperature: 0.3,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                const explanationText = data.choices[0]?.message?.content || "";
                return {
                    summary: explanationText.substring(0, 200),
                    reasoning: explanationText.split("\n").filter((s) => s.trim().length > 0),
                    confidence: 0.8,
                };
            }
        }
        catch (error) {
            console.warn("Explanation generation failed:", error);
        }
        return {
            summary: `Forecast ${events.length} potential events`,
            reasoning: events.map(e => e.reasoning),
            confidence: 0.7,
        };
    }
}
exports.ExplainableForecastEngine = ExplainableForecastEngine;
