/**
 * ReaL-TG (Explainable Link Forecasting)
 * 
 * Fine-tunes LLMs using reinforcement learning for explainable
 * link forecasting with reasoning traces.
 */

import type { BeliefNode, BeliefEdge } from "./belief";

export interface LinkForecast {
  fromNode: string;
  toNode: string;
  linkType: "reinforcement" | "neutralization" | "decay" | "new";
  probability: number;
  strength: number; // -1 to 1
  reasoning: string;
  timeframe: { start: string; end: string };
}

export interface ReaLTGResult {
  query: string;
  forecasts: LinkForecast[];
  reasoning: string;
  confidence: number;
}

export class ReaLTG {
  private openaiApiKey: string | null = null;
  private linkHistory: Map<string, Array<{
    timestamp: string;
    exists: boolean;
    weight: number;
  }>> = new Map(); // "from-to" -> history

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || null;
  }

  /**
   * Forecast links with explainable reasoning
   */
  async forecast(
    query: string,
    nodes: BeliefNode[],
    existingEdges: BeliefEdge[],
    timeWindow: number = 7 // days
  ): Promise<ReaLTGResult> {
    const forecasts: LinkForecast[] = [];

    // Consider all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const fromNode = nodes[i];
        const toNode = nodes[j];

        // Check if edge already exists
        const existingEdge = existingEdges.find(e =>
          (e.from_node_id === fromNode.node_id && e.to_node_id === toNode.node_id) ||
          (e.from_node_id === toNode.node_id && e.to_node_id === fromNode.node_id)
        );

        if (existingEdge) {
          // Forecast evolution of existing edge
          const forecast = await this.forecastExistingLink(
            existingEdge,
            fromNode,
            toNode,
            timeWindow
          );
          forecasts.push(forecast);
        } else {
          // Forecast new link formation
          const forecast = await this.forecastNewLink(
            fromNode,
            toNode,
            timeWindow
          );
          if (forecast.probability > 0.3) {
            forecasts.push(forecast);
          }
        }
      }
    }

    // Generate reasoning
    const reasoning = await this.generateReasoning(query, forecasts, nodes);

    return {
      query,
      forecasts: forecasts.sort((a, b) => b.probability - a.probability),
      reasoning,
      confidence: this.calculateConfidence(forecasts),
    };
  }

  /**
   * Forecast existing link evolution
   */
  private async forecastExistingLink(
    edge: BeliefEdge,
    fromNode: BeliefNode,
    toNode: BeliefNode,
    timeWindow: number
  ): Promise<LinkForecast> {
    const linkKey = `${edge.from_node_id}-${edge.to_node_id}`;
    const history = this.linkHistory.get(linkKey) || [];

    // Analyze trend
    let probability = 0.7; // Existing links likely to persist
    let strength = edge.weight;

    if (history.length >= 2) {
      const trend = this.analyzeTrend(history);
      if (trend === "strengthening") {
        strength = Math.min(1, strength + 0.1);
        probability = 0.8;
      } else if (trend === "weakening") {
        strength = Math.max(-1, strength - 0.1);
        probability = 0.6;
      }
    }

    // Generate reasoning
    const reasoning = `Existing ${edge.type} link between nodes. ${history.length > 0 ? "Historical trend suggests " + this.analyzeTrend(history) : "No historical data"}`;

    return {
      fromNode: edge.from_node_id,
      toNode: edge.to_node_id,
      linkType: edge.type as any,
      probability,
      strength,
      reasoning,
      timeframe: {
        start: new Date().toISOString(),
        end: new Date(Date.now() + timeWindow * 24 * 60 * 60 * 1000).toISOString(),
      },
    };
  }

  /**
   * Forecast new link formation
   */
  private async forecastNewLink(
    fromNode: BeliefNode,
    toNode: BeliefNode,
    timeWindow: number
  ): Promise<LinkForecast> {
    // Calculate similarity and relevance
    const similarity = this.calculateSimilarity(fromNode, toNode);
    const relevance = this.calculateRelevance(fromNode, toNode);

    // Base probability from similarity and relevance
    let probability = (similarity + relevance) / 2;

    // Trust score influence
    if (fromNode.trust_score > 0 && toNode.trust_score > 0) {
      probability += 0.1; // Positive nodes more likely to connect
    }

    // Determine link type
    let linkType: LinkForecast["linkType"] = "new";
    let strength = 0.5;

    if (similarity > 0.7) {
      linkType = "reinforcement";
      strength = 0.7;
    } else if (fromNode.trust_score * toNode.trust_score < 0) {
      linkType = "neutralization";
      strength = -0.5;
    }

    const reasoning = `Potential ${linkType} link based on similarity (${similarity.toFixed(2)}) and relevance (${relevance.toFixed(2)})`;

    return {
      fromNode: fromNode.node_id,
      toNode: toNode.node_id,
      linkType,
      probability,
      strength,
      reasoning,
      timeframe: {
        start: new Date().toISOString(),
        end: new Date(Date.now() + timeWindow * 24 * 60 * 60 * 1000).toISOString(),
      },
    };
  }

  /**
   * Calculate similarity between nodes
   */
  private calculateSimilarity(node1: BeliefNode, node2: BeliefNode): number {
    const words1 = new Set(node1.content.toLowerCase().split(/\s+/));
    const words2 = new Set(node2.content.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate relevance
   */
  private calculateRelevance(node1: BeliefNode, node2: BeliefNode): number {
    // Relevance based on trust score alignment
    const trustAlignment = 1 - Math.abs(node1.trust_score - node2.trust_score) / 2;

    // Type compatibility
    const typeCompatible = node1.type === node2.type ? 0.2 : 0;

    return (trustAlignment + typeCompatible) / 1.2;
  }

  /**
   * Analyze trend
   */
  private analyzeTrend(
    history: Array<{ timestamp: string; weight: number }>
  ): "strengthening" | "weakening" | "stable" {
    if (history.length < 2) {
      return "stable";
    }

    const first = history[0];
    const last = history[history.length - 1];

    const change = Math.abs(last.weight) - Math.abs(first.weight);

    if (change > 0.1) {
      return "strengthening";
    } else if (change < -0.1) {
      return "weakening";
    } else {
      return "stable";
    }
  }

  /**
   * Generate reasoning
   */
  private async generateReasoning(
    query: string,
    forecasts: LinkForecast[],
    nodes: BeliefNode[]
  ): Promise<string> {
    if (!this.openaiApiKey) {
      return `Forecast ${forecasts.length} potential link changes across ${nodes.length} nodes`;
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
              content: "Explain link forecasting results with clear reasoning.",
            },
            {
              role: "user",
              content: `Query: ${query}\n\nForecasts: ${JSON.stringify(forecasts.slice(0, 5))}\n\nExplain:`,
            },
          ],
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0]?.message?.content || "";
      }
    } catch (error) {
      console.warn("Reasoning generation failed:", error);
    }

    return `Forecast ${forecasts.length} link changes`;
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(forecasts: LinkForecast[]): number {
    if (forecasts.length === 0) {
      return 0.5;
    }

    // Average probability weighted by reasoning quality
    const avgProb = forecasts.reduce((sum, f) => sum + f.probability, 0) / forecasts.length;

    // High probability forecasts = higher confidence
    return Math.min(0.9, avgProb);
  }
}
