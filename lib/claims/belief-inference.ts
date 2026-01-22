/**
 * Belief Inference
 * 
 * Fine-tuned GPT-4o for large-scale belief inference, mapping
 * interconnected belief networks from social media data.
 */

import type { Claim } from "./extraction";

export interface BeliefNode {
  id: string;
  claim: string;
  belief: number; // 0-1, strength of belief
  connections: Array<{
    target: string; // Other node ID
    type: "supports" | "contradicts" | "related";
    strength: number; // 0-1
  }>;
}

export interface BeliefNetwork {
  nodes: Map<string, BeliefNode>;
  clusters: Array<{
    id: string;
    nodes: string[];
    dominantBelief: string;
    coherence: number; // 0-1
  }>;
}

export class BeliefInference {
  private openaiApiKey: string | null = null;

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || null;
  }

  /**
   * Infer belief network from claims
   */
  async inferBeliefNetwork(
    claims: Claim[],
    socialData?: Array<{ content: string; author: string; timestamp: string }>
  ): Promise<BeliefNetwork> {
    if (!this.openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      // Use GPT-4o to infer beliefs and connections
      const claimTexts = claims.map(c => c.canonical_text).join("\n");
      const socialContext = socialData
        ? socialData.map(s => s.content).join("\n")
        : "";

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
              content: `You are a belief network inference system. Analyze claims and social data to infer:
1. Belief strength for each claim (0-1)
2. Connections between beliefs (supports, contradicts, related)
3. Belief clusters

Return JSON with: nodes (array of {id, claim, belief, connections}), clusters`,
            },
            {
              role: "user",
              content: `Claims:\n${claimTexts}\n\nSocial Context:\n${socialContext}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const parsed = JSON.parse(data.choices[0]?.message?.content || "{}");

      // Build belief network
      const nodes = new Map<string, BeliefNode>();
      
      for (const nodeData of parsed.nodes || []) {
        nodes.set(nodeData.id, {
          id: nodeData.id,
          claim: nodeData.claim,
          belief: nodeData.belief || 0.5,
          connections: nodeData.connections || [],
        });
      }

      // Build clusters
      const clusters = (parsed.clusters || []).map((c: any) => ({
        id: c.id || crypto.randomUUID(),
        nodes: c.nodes || [],
        dominantBelief: c.dominantBelief || "",
        coherence: c.coherence || 0.5,
      }));

      return {
        nodes,
        clusters,
      };
    } catch (error) {
      throw new Error(
        `Belief inference failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Calculate belief propagation
   */
  propagateBeliefs(
    network: BeliefNetwork,
    newClaim: string
  ): BeliefNetwork {
    // Add new claim to network
    const newNodeId = crypto.randomUUID();
    const newNode: BeliefNode = {
      id: newNodeId,
      claim: newClaim,
      belief: 0.5, // Initial belief
      connections: [],
    };

    // Find connections to existing nodes
    for (const [existingId, existingNode] of network.nodes.entries()) {
      const connection = this.determineConnection(newClaim, existingNode.claim);
      if (connection) {
        newNode.connections.push({
          target: existingId,
          ...connection,
        });

        // Add reverse connection
        existingNode.connections.push({
          target: newNodeId,
          ...connection,
        });
      }
    }

    network.nodes.set(newNodeId, newNode);

    // Update beliefs through propagation
    this.updateBeliefs(network);

    return network;
  }

  /**
   * Determine connection between claims
   */
  private determineConnection(
    claim1: string,
    claim2: string
  ): { type: "supports" | "contradicts" | "related"; strength: number } | null {
    // Simple semantic matching (in production, use embeddings + NLI)
    const words1 = new Set(claim1.toLowerCase().split(/\s+/));
    const words2 = new Set(claim2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter((w: string) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    const similarity = intersection.size / union.size;

    if (similarity < 0.2) {
      return null; // Not related
    }

    // Determine type (simplified)
    const contradictWords = ["not", "never", "no", "false", "wrong"];
    const hasContradict = [...words1, ...words2].some(w => contradictWords.includes(w));

    return {
      type: hasContradict ? "contradicts" : similarity > 0.5 ? "supports" : "related",
      strength: similarity,
    };
  }

  /**
   * Update beliefs through network propagation
   */
  private updateBeliefs(network: BeliefNetwork): void {
    // Simple belief propagation (in production, use proper graph algorithms)
    for (const [nodeId, node] of network.nodes.entries()) {
      let beliefSum = node.belief;
      let weightSum = 1;

      for (const connection of node.connections) {
        const connectedNode = network.nodes.get(connection.target);
        if (connectedNode) {
          const influence = connection.type === "supports" 
            ? connectedNode.belief * connection.strength
            : connection.type === "contradicts"
            ? (1 - connectedNode.belief) * connection.strength
            : connectedNode.belief * connection.strength * 0.5;

          beliefSum += influence;
          weightSum += connection.strength;
        }
      }

      // Update belief (weighted average)
      node.belief = Math.max(0, Math.min(1, beliefSum / weightSum));
    }
  }
}
