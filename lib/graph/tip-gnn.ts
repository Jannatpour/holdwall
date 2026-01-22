/**
 * TIP-GNN (Transition-Informed Propagation GNN)
 * 
 * Uses transition propagation to handle evolution of node neighbors
 * for dynamic belief graph updates.
 */

import type { BeliefNode, BeliefEdge } from "./belief";

export interface Transition {
  fromState: { trust: number; decisiveness: number };
  toState: { trust: number; decisiveness: number };
  timestamp: string;
  factors: string[];
}

export interface TIPGNNPrediction {
  nodeId: string;
  currentState: { trust: number; decisiveness: number };
  predictedState: { trust: number; decisiveness: number };
  transitionProbability: number;
  neighborInfluences: Array<{
    neighborId: string;
    influence: number;
  }>;
}

export class TIPGNN {
  private transitions: Map<string, Transition[]> = new Map(); // nodeId -> transitions

  /**
   * Record transition
   */
  recordTransition(
    nodeId: string,
    transition: Transition
  ): void {
    if (!this.transitions.has(nodeId)) {
      this.transitions.set(nodeId, []);
    }

    this.transitions.get(nodeId)!.push(transition);
  }

  /**
   * Predict using transition-informed propagation
   */
  predict(
    node: BeliefNode,
    neighbors: Array<{ node: BeliefNode; edge: BeliefEdge }>,
    timeSteps: number = 1
  ): TIPGNNPrediction {
    const currentState = {
      trust: node.trust_score,
      decisiveness: node.decisiveness,
    };

    // Get transition patterns
    const nodeTransitions = this.transitions.get(node.node_id) || [];
    const transitionPattern = this.analyzeTransitions(nodeTransitions);

    // Calculate neighbor influences
    const neighborInfluences = neighbors.map(({ node: neighbor, edge }) => {
      const influence = this.calculateInfluence(neighbor, edge, transitionPattern);
      return {
        neighborId: neighbor.node_id,
        influence,
      };
    });

    // Aggregate influences
    const totalInfluence = neighborInfluences.reduce((sum, n) => sum + n.influence, 0);

    // Predict next state
    const predictedState = {
      trust: Math.max(-1, Math.min(1, currentState.trust + totalInfluence * 0.1)),
      decisiveness: Math.max(0, Math.min(1, currentState.decisiveness + totalInfluence * 0.05)),
    };

    // Calculate transition probability
    const transitionProbability = this.calculateTransitionProbability(
      currentState,
      predictedState,
      transitionPattern
    );

    return {
      nodeId: node.node_id,
      currentState,
      predictedState,
      transitionProbability,
      neighborInfluences,
    };
  }

  /**
   * Analyze transition patterns
   */
  private analyzeTransitions(transitions: Transition[]): {
    averageChange: number;
    direction: "increasing" | "decreasing" | "stable";
  } {
    if (transitions.length === 0) {
      return {
        averageChange: 0,
        direction: "stable",
      };
    }

    const changes = transitions.map(t => 
      (t.toState.trust - t.fromState.trust) + (t.toState.decisiveness - t.fromState.decisiveness)
    );

    const averageChange = changes.reduce((sum, c) => sum + c, 0) / changes.length;

    return {
      averageChange,
      direction: averageChange > 0.1 ? "increasing" :
                averageChange < -0.1 ? "decreasing" : "stable",
    };
  }

  /**
   * Calculate influence from neighbor
   */
  private calculateInfluence(
    neighbor: BeliefNode,
    edge: BeliefEdge,
    transitionPattern: { averageChange: number; direction: string }
  ): number {
    // Base influence from edge weight
    let influence = edge.weight;

    // Adjust based on neighbor trust
    influence *= neighbor.trust_score;

    // Adjust based on transition pattern
    if (transitionPattern.direction === "increasing") {
      influence *= 1.1;
    } else if (transitionPattern.direction === "decreasing") {
      influence *= 0.9;
    }

    // Edge type adjustment
    if (edge.type === "reinforcement") {
      influence *= 1.2;
    } else if (edge.type === "neutralization") {
      influence *= -0.8;
    } else if (edge.type === "decay") {
      influence *= 0.5;
    }

    return influence;
  }

  /**
   * Calculate transition probability
   */
  private calculateTransitionProbability(
    current: { trust: number; decisiveness: number },
    predicted: { trust: number; decisiveness: number },
    transitionPattern: { averageChange: number; direction: string }
  ): number {
    const change = Math.abs(predicted.trust - current.trust) + 
                   Math.abs(predicted.decisiveness - current.decisiveness);

    // Higher change = lower probability (more uncertain)
    const baseProbability = 1 - Math.min(1, change);

    // Adjust based on historical pattern
    const patternAdjustment = transitionPattern.direction === "stable" ? 0.1 : 0;

    return Math.max(0.3, Math.min(0.9, baseProbability + patternAdjustment));
  }
}
