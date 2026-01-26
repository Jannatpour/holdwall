"use strict";
/**
 * TGNF (Temporally Evolving GNN)
 *
 * Models dynamic diffusion patterns for fake news/misinformation
 * detection in belief graphs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TGNF = void 0;
class TGNF {
    constructor() {
        this.nodeHistory = new Map();
    }
    /**
     * Record node state over time
     */
    recordState(node, edges, timestamp = new Date().toISOString()) {
        if (!this.nodeHistory.has(node.node_id)) {
            this.nodeHistory.set(node.node_id, []);
        }
        this.nodeHistory.get(node.node_id).push({
            timestamp,
            trust: node.trust_score,
            connections: edges.filter(e => e.from_node_id === node.node_id || e.to_node_id === node.node_id).length,
        });
    }
    /**
     * Detect misinformation using diffusion patterns
     */
    async detect(node, edges, allNodes) {
        // Analyze diffusion patterns
        const patterns = this.analyzeDiffusion(node, edges, allNodes);
        // Check for suspicious patterns
        const suspiciousPatterns = patterns.filter(p => p.velocity > 5 || p.strength > 0.8);
        // Calculate misinformation likelihood
        const isMisinformation = suspiciousPatterns.length > 0;
        const confidence = this.calculateConfidence(patterns, node);
        // Generate reasoning
        const reasoning = this.generateReasoning(node, patterns, suspiciousPatterns);
        return {
            nodeId: node.node_id,
            isMisinformation,
            confidence,
            patterns,
            reasoning,
        };
    }
    /**
     * Analyze diffusion patterns
     */
    analyzeDiffusion(node, edges, allNodes) {
        const patterns = [];
        // Find paths from this node
        const connectedNodes = edges
            .filter(e => e.from_node_id === node.node_id)
            .map(e => allNodes.find(n => n.node_id === e.to_node_id))
            .filter((n) => n !== undefined);
        for (const targetNode of connectedNodes) {
            // Calculate path strength
            const edge = edges.find(e => e.from_node_id === node.node_id && e.to_node_id === targetNode.node_id);
            if (edge) {
                // Calculate velocity (simplified)
                const nodeHistory = this.nodeHistory.get(node.node_id) || [];
                const targetHistory = this.nodeHistory.get(targetNode.node_id) || [];
                const velocity = this.calculateVelocity(nodeHistory, targetHistory);
                patterns.push({
                    sourceNode: node.node_id,
                    path: [node.node_id, targetNode.node_id],
                    strength: Math.abs(edge.weight),
                    velocity,
                    detectedAt: new Date().toISOString(),
                });
            }
        }
        return patterns;
    }
    /**
     * Calculate diffusion velocity
     */
    calculateVelocity(sourceHistory, targetHistory) {
        if (sourceHistory.length < 2 || targetHistory.length < 2) {
            return 0;
        }
        // Calculate how quickly connections grew
        const sourceGrowth = sourceHistory[sourceHistory.length - 1].connections -
            sourceHistory[0].connections;
        const targetGrowth = targetHistory[targetHistory.length - 1].connections -
            targetHistory[0].connections;
        const timeDiff = (new Date(targetHistory[0].timestamp).getTime() -
            new Date(sourceHistory[0].timestamp).getTime()) / (1000 * 60 * 60 * 24);
        if (timeDiff > 0) {
            return (sourceGrowth + targetGrowth) / timeDiff;
        }
        return 0;
    }
    /**
     * Calculate confidence
     */
    calculateConfidence(patterns, node) {
        let confidence = 0.5;
        // High velocity = higher confidence in detection
        const maxVelocity = patterns.length > 0
            ? Math.max(...patterns.map(p => p.velocity))
            : 0;
        if (maxVelocity > 10) {
            confidence = 0.9;
        }
        else if (maxVelocity > 5) {
            confidence = 0.7;
        }
        // Low trust = higher confidence it's misinformation
        if (node.trust_score < -0.5) {
            confidence += 0.1;
        }
        return Math.min(1, confidence);
    }
    /**
     * Generate reasoning
     */
    generateReasoning(node, patterns, suspicious) {
        if (suspicious.length > 0) {
            return `Detected ${suspicious.length} suspicious diffusion patterns with high velocity (${suspicious[0].velocity.toFixed(1)} nodes/day). This suggests coordinated propagation.`;
        }
        if (patterns.length > 0) {
            return `Normal diffusion patterns detected. ${patterns.length} propagation paths identified.`;
        }
        return "No significant diffusion patterns detected.";
    }
}
exports.TGNF = TGNF;
