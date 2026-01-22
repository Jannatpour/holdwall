/**
 * CODEN (Continuous Dynamic Network)
 * 
 * Enables efficient, continuous predictions over time rather than
 * one-time snapshot forecasts for belief graph evolution.
 */

import type { BeliefNode, BeliefEdge } from "./belief";

export interface ContinuousPrediction {
  nodeId: string;
  timestamp: string;
  predictedTrust: number;
  predictedDecisiveness: number;
  confidence: number;
  factors: Array<{
    factor: string;
    impact: number;
  }>;
}

export interface ContinuousForecast {
  nodeId: string;
  predictions: ContinuousPrediction[];
  trend: "increasing" | "decreasing" | "stable";
  nextUpdate: string;
}

export class CODEN {
  private nodeHistory: Map<string, Array<{
    timestamp: string;
    trust: number;
    decisiveness: number;
  }>> = new Map();

  /**
   * Record node state
   */
  recordState(
    node: BeliefNode,
    timestamp: string = new Date().toISOString()
  ): void {
    if (!this.nodeHistory.has(node.node_id)) {
      this.nodeHistory.set(node.node_id, []);
    }

    this.nodeHistory.get(node.node_id)!.push({
      timestamp,
      trust: node.trust_score,
      decisiveness: node.decisiveness,
    });
  }

  /**
   * Predict continuous evolution
   */
  predict(
    node: BeliefNode,
    edges: BeliefEdge[],
    timeWindow: number = 7 // days
  ): ContinuousForecast {
    const history = this.nodeHistory.get(node.node_id) || [];

    if (history.length < 2) {
      // Not enough history
      return {
        nodeId: node.node_id,
        predictions: [],
        trend: "stable",
        nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    // Calculate trend
    const recent = history.slice(-Math.min(10, history.length));
    const trend = this.calculateTrend(recent);

    // Generate continuous predictions
    const predictions: ContinuousPrediction[] = [];
    const startTime = new Date();
    const hoursPerPrediction = 6; // Predict every 6 hours

    for (let i = 1; i <= (timeWindow * 24) / hoursPerPrediction; i++) {
      const predictionTime = new Date(startTime.getTime() + i * hoursPerPrediction * 60 * 60 * 1000);

      // Predict based on trend and edges
      const predicted = this.predictAtTime(
        node,
        edges,
        recent,
        predictionTime,
        trend
      );

      predictions.push(predicted);
    }

    return {
      nodeId: node.node_id,
      predictions,
      trend,
      nextUpdate: predictions[0]?.timestamp || new Date().toISOString(),
    };
  }

  /**
   * Calculate trend from history
   */
  private calculateTrend(
    history: Array<{ timestamp: string; trust: number; decisiveness: number }>
  ): "increasing" | "decreasing" | "stable" {
    if (history.length < 2) {
      return "stable";
    }

    const first = history[0];
    const last = history[history.length - 1];

    const trustChange = last.trust - first.trust;
    const decisivenessChange = last.decisiveness - first.decisiveness;

    const totalChange = trustChange + decisivenessChange;

    if (totalChange > 0.1) {
      return "increasing";
    } else if (totalChange < -0.1) {
      return "decreasing";
    } else {
      return "stable";
    }
  }

  /**
   * Predict state at specific time
   */
  private predictAtTime(
    node: BeliefNode,
    edges: BeliefEdge[],
    history: Array<{ timestamp: string; trust: number; decisiveness: number }>,
    targetTime: Date,
    trend: "increasing" | "decreasing" | "stable"
  ): ContinuousPrediction {
    const lastState = history[history.length - 1];
    const timeDiff = (targetTime.getTime() - new Date(lastState.timestamp).getTime()) / (1000 * 60 * 60); // hours

    // Base prediction from trend
    let predictedTrust = lastState.trust;
    let predictedDecisiveness = lastState.decisiveness;

    // Apply trend
    const trendRate = trend === "increasing" ? 0.01 : trend === "decreasing" ? -0.01 : 0;
    predictedTrust += trendRate * (timeDiff / 24); // Per day
    predictedDecisiveness += trendRate * (timeDiff / 24);

    // Apply edge influences
    const connectedEdges = edges.filter(e => 
      e.from_node_id === node.node_id || e.to_node_id === node.node_id
    );

    for (const edge of connectedEdges) {
      const influence = edge.weight * 0.1; // Scale influence
      predictedTrust += influence * (timeDiff / 24);
    }

    // Clamp values
    predictedTrust = Math.max(-1, Math.min(1, predictedTrust));
    predictedDecisiveness = Math.max(0, Math.min(1, predictedDecisiveness));

    // Calculate confidence (decreases with time)
    const confidence = Math.max(0.3, 0.9 - (timeDiff / (7 * 24)) * 0.6);

    return {
      nodeId: node.node_id,
      timestamp: targetTime.toISOString(),
      predictedTrust,
      predictedDecisiveness,
      confidence,
      factors: [
        { factor: "trend", impact: trendRate },
        { factor: "edge_influence", impact: connectedEdges.length * 0.05 },
      ],
    };
  }

  /**
   * Get node history
   */
  getHistory(nodeId: string): Array<{ timestamp: string; trust: number; decisiveness: number }> {
    return this.nodeHistory.get(nodeId) || [];
  }
}
