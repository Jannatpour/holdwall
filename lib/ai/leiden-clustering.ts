/**
 * Leiden Clustering Algorithm
 * 
 * Advanced community detection algorithm for knowledge graphs.
 * Used to organize entities into hierarchical communities for efficient retrieval.
 * 
 * Based on the Leiden algorithm (Traag, V.A., Waltman, L. & van Eck, N.J. 2019)
 * which improves upon the Louvain algorithm with better guarantees.
 * 
 * Latest January 2026 implementation for GraphRAG enhancement.
 */

import { logger } from "@/lib/logging/logger";

export interface GraphNode {
  id: string;
  neighbors: Set<string>;
  weight?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  weight: number;
}

export interface Community {
  id: string;
  nodes: Set<string>;
  level: number; // Hierarchy level (0 = leaf, higher = more abstract)
  parent?: string; // Parent community ID
  children: string[]; // Child community IDs
  properties: {
    size: number;
    density: number;
    modularity: number;
  };
}

export interface LeidenClusteringResult {
  communities: Map<string, Community>;
  hierarchy: Map<number, Community[]>; // Level -> Communities
  modularity: number;
  iterations: number;
}

/**
 * Leiden Clustering
 * 
 * Performs hierarchical community detection on graphs
 */
export class LeidenClustering {
  private readonly resolution: number = 1.0; // Resolution parameter (higher = more communities)
  private readonly maxIterations: number = 100;
  private readonly minImprovement: number = 0.0001;

  /**
   * Perform Leiden clustering on a graph
   */
  async cluster(
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
    options?: {
      resolution?: number;
      maxIterations?: number;
      hierarchical?: boolean;
    }
  ): Promise<LeidenClusteringResult> {
    const startTime = Date.now();
    const resolution = options?.resolution ?? this.resolution;
    const maxIterations = options?.maxIterations ?? this.maxIterations;
    const hierarchical = options?.hierarchical ?? true;

    logger.info("Leiden clustering started", {
      nodeCount: nodes.size,
      edgeCount: edges.length,
      resolution,
      hierarchical,
    });

    // Build adjacency structure
    const adjacency = this.buildAdjacency(nodes, edges);

    // Initial partition: each node in its own community
    let partition = new Map<string, string>();
    for (const nodeId of nodes.keys()) {
      partition.set(nodeId, nodeId);
    }

    let modularity = this.calculateModularity(partition, nodes, edges, adjacency, resolution);
    let iterations = 0;
    let improved = true;

    // Leiden algorithm iterations
    while (improved && iterations < maxIterations) {
      iterations++;
      improved = false;

      // Local moving phase: move nodes to best community
      const newPartition = await this.localMoving(partition, nodes, edges, adjacency, resolution);
      const newModularity = this.calculateModularity(newPartition, nodes, edges, adjacency, resolution);

      if (newModularity > modularity + this.minImprovement) {
        partition = newPartition;
        modularity = newModularity;
        improved = true;
      }

      // Refinement phase: refine communities
      partition = await this.refine(partition, nodes, edges, adjacency, resolution);
      const refinedModularity = this.calculateModularity(partition, nodes, edges, adjacency, resolution);

      if (refinedModularity > modularity + this.minImprovement) {
        modularity = refinedModularity;
        improved = true;
      }

      logger.debug("Leiden iteration", {
        iteration: iterations,
        modularity,
        communityCount: new Set(partition.values()).size,
      });
    }

    // Build communities from partition
    const communities = this.buildCommunities(partition, nodes, edges, adjacency);

    // Build hierarchy if requested
    const hierarchy = hierarchical
      ? await this.buildHierarchy(communities, nodes, edges, adjacency, resolution)
      : new Map<number, Community[]>();

    const result: LeidenClusteringResult = {
      communities,
      hierarchy,
      modularity,
      iterations,
    };

    logger.info("Leiden clustering completed", {
      communityCount: communities.size,
      modularity,
      iterations,
      latencyMs: Date.now() - startTime,
    });

    return result;
  }

  /**
   * Build adjacency structure from nodes and edges
   */
  private buildAdjacency(
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[]
  ): Map<string, Map<string, number>> {
    const adjacency = new Map<string, Map<string, number>>();

    // Initialize adjacency for all nodes
    for (const nodeId of nodes.keys()) {
      adjacency.set(nodeId, new Map());
    }

    // Add edges
    for (const edge of edges) {
      if (!adjacency.has(edge.from)) {
        adjacency.set(edge.from, new Map());
      }
      if (!adjacency.has(edge.to)) {
        adjacency.set(edge.to, new Map());
      }

      adjacency.get(edge.from)!.set(edge.to, edge.weight);
      adjacency.get(edge.to)!.set(edge.from, edge.weight); // Undirected
    }

    return adjacency;
  }

  /**
   * Local moving phase: move nodes to best community
   */
  private async localMoving(
    partition: Map<string, string>,
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
    adjacency: Map<string, Map<string, number>>,
    resolution: number
  ): Promise<Map<string, string>> {
    const newPartition = new Map(partition);
    const nodeIds = Array.from(nodes.keys());
    
    // Randomize order for better convergence
    this.shuffle(nodeIds);

    for (const nodeId of nodeIds) {
      const currentCommunity = newPartition.get(nodeId)!;
      const neighbors = adjacency.get(nodeId) || new Map();

      // Calculate modularity gain for each possible community
      let bestCommunity = currentCommunity;
      let bestGain = 0;

      // Check current community and neighbor communities
      const candidateCommunities = new Set<string>([currentCommunity]);
      for (const neighborId of neighbors.keys()) {
        candidateCommunities.add(newPartition.get(neighborId)!);
      }

      for (const candidateCommunity of candidateCommunities) {
        const gain = this.calculateModularityGain(
          nodeId,
          candidateCommunity,
          currentCommunity,
          nodes,
          edges,
          adjacency,
          newPartition,
          resolution
        );

        if (gain > bestGain) {
          bestGain = gain;
          bestCommunity = candidateCommunity;
        }
      }

      if (bestCommunity !== currentCommunity) {
        newPartition.set(nodeId, bestCommunity);
      }
    }

    return newPartition;
  }

  /**
   * Refinement phase: refine communities by splitting
   */
  private async refine(
    partition: Map<string, string>,
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
    adjacency: Map<string, Map<string, number>>,
    resolution: number
  ): Promise<Map<string, string>> {
    const newPartition = new Map(partition);
    const communities = new Set(partition.values());

    // For each community, try to refine by splitting
    for (const communityId of communities) {
      const communityNodes = Array.from(newPartition.entries())
        .filter(([_, c]) => c === communityId)
        .map(([nodeId]) => nodeId);

      if (communityNodes.length <= 1) {
        continue;
      }

      // Try splitting community
      const split = await this.trySplit(communityNodes, nodes, edges, adjacency, resolution);

      if (split) {
        // Apply split
        const newCommunityId = `community-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        for (const nodeId of split) {
          newPartition.set(nodeId, newCommunityId);
        }
      }
    }

    return newPartition;
  }

  /**
   * Try to split a community
   */
  private async trySplit(
    nodes: string[],
    allNodes: Map<string, GraphNode>,
    edges: GraphEdge[],
    adjacency: Map<string, Map<string, number>>,
    resolution: number
  ): Promise<string[] | null> {
    if (nodes.length <= 2) {
      return null;
    }

    // Create subgraph
    const subgraphNodes = new Map<string, GraphNode>();
    const subgraphEdges: GraphEdge[] = [];

    for (const nodeId of nodes) {
      const node = allNodes.get(nodeId);
      if (node) {
        subgraphNodes.set(nodeId, {
          id: nodeId,
          neighbors: new Set(
            Array.from(node.neighbors).filter((n) => nodes.includes(n))
          ),
        });
      }
    }

    for (const edge of edges) {
      if (nodes.includes(edge.from) && nodes.includes(edge.to)) {
        subgraphEdges.push(edge);
      }
    }

    // Recursively cluster subgraph
    const subgraphAdjacency = this.buildAdjacency(subgraphNodes, subgraphEdges);
    let subgraphPartition = new Map<string, string>();
    for (const nodeId of nodes) {
      subgraphPartition.set(nodeId, nodeId);
    }

    // Run local moving on subgraph
    subgraphPartition = await this.localMoving(
      subgraphPartition,
      subgraphNodes,
      subgraphEdges,
      subgraphAdjacency,
      resolution
    );

    // Check if split improves modularity
    const originalModularity = this.calculateModularity(
      new Map(nodes.map((n) => [n, nodes[0]])), // All in one community
      subgraphNodes,
      subgraphEdges,
      subgraphAdjacency,
      resolution
    );

    const splitModularity = this.calculateModularity(
      subgraphPartition,
      subgraphNodes,
      subgraphEdges,
      subgraphAdjacency,
      resolution
    );

    if (splitModularity > originalModularity + this.minImprovement) {
      // Return nodes that should be in new community
      const communities = new Set(subgraphPartition.values());
      if (communities.size > 1) {
        // Return largest community (excluding first)
        const communitySizes = Array.from(communities).map((c) => ({
          id: c,
          size: Array.from(subgraphPartition.entries()).filter(([_, comm]) => comm === c).length,
        }));
        communitySizes.sort((a, b) => b.size - a.size);

        if (communitySizes.length > 1) {
          const newCommunityId = communitySizes[1].id;
          return Array.from(subgraphPartition.entries())
            .filter(([_, c]) => c === newCommunityId)
            .map(([nodeId]) => nodeId);
        }
      }
    }

    return null;
  }

  /**
   * Calculate modularity
   */
  private calculateModularity(
    partition: Map<string, string>,
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
    adjacency: Map<string, Map<string, number>>,
    resolution: number
  ): number {
    const communities = new Set(partition.values());
    let modularity = 0;
    let totalWeight = 0;

    // Calculate total edge weight
    for (const edge of edges) {
      totalWeight += edge.weight;
    }

    if (totalWeight === 0) {
      return 0;
    }

    // Calculate modularity for each community
    for (const communityId of communities) {
      const communityNodes = Array.from(partition.entries())
        .filter(([_, c]) => c === communityId)
        .map(([nodeId]) => nodeId);

      let internalWeight = 0;
      let totalDegree = 0;

      for (const nodeId of communityNodes) {
        const neighbors = adjacency.get(nodeId) || new Map();
        totalDegree += Array.from(neighbors.values()).reduce((sum, w) => sum + w, 0);

        for (const neighborId of neighbors.keys()) {
          if (communityNodes.includes(neighborId)) {
            internalWeight += neighbors.get(neighborId)!;
          }
        }
      }

      // Modularity formula: (internal_weight / total_weight) - resolution * (total_degree / (2 * total_weight))^2
      const term1 = internalWeight / totalWeight;
      const term2 = resolution * Math.pow(totalDegree / (2 * totalWeight), 2);
      modularity += term1 - term2;
    }

    return modularity;
  }

  /**
   * Calculate modularity gain from moving a node
   */
  private calculateModularityGain(
    nodeId: string,
    targetCommunity: string,
    currentCommunity: string,
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
    adjacency: Map<string, Map<string, number>>,
    partition: Map<string, string>,
    resolution: number
  ): number {
    if (targetCommunity === currentCommunity) {
      return 0;
    }

    // Simplified gain calculation
    // In production, use full modularity difference calculation
    const neighbors = adjacency.get(nodeId) || new Map();
    let connectionsToTarget = 0;
    let connectionsToCurrent = 0;

    for (const [neighborId, weight] of neighbors.entries()) {
      const neighborCommunity = partition.get(neighborId);
      if (neighborCommunity === targetCommunity) {
        connectionsToTarget += weight;
      }
      if (neighborCommunity === currentCommunity) {
        connectionsToCurrent += weight;
      }
    }

    // Gain is difference in connections
    return connectionsToTarget - connectionsToCurrent;
  }

  /**
   * Build communities from partition
   */
  private buildCommunities(
    partition: Map<string, string>,
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
    adjacency: Map<string, Map<string, number>>
  ): Map<string, Community> {
    const communities = new Map<string, Community>();
    const communityNodes = new Map<string, Set<string>>();

    // Group nodes by community
    for (const [nodeId, communityId] of partition.entries()) {
      if (!communityNodes.has(communityId)) {
        communityNodes.set(communityId, new Set());
      }
      communityNodes.get(communityId)!.add(nodeId);
    }

    // Build community objects
    for (const [communityId, nodeSet] of communityNodes.entries()) {
      const nodeArray = Array.from(nodeSet);
      
      // Calculate density
      let internalEdges = 0;
      let totalPossibleEdges = nodeArray.length * (nodeArray.length - 1) / 2;

      for (let i = 0; i < nodeArray.length; i++) {
        for (let j = i + 1; j < nodeArray.length; j++) {
          const node1 = nodeArray[i];
          const node2 = nodeArray[j];
          if (adjacency.get(node1)?.has(node2)) {
            internalEdges++;
          }
        }
      }

      const density = totalPossibleEdges > 0 ? internalEdges / totalPossibleEdges : 0;

      communities.set(communityId, {
        id: communityId,
        nodes: nodeSet,
        level: 0,
        children: [],
        properties: {
          size: nodeSet.size,
          density,
          modularity: 0, // Will be calculated separately if needed
        },
      });
    }

    return communities;
  }

  /**
   * Build hierarchical structure
   */
  private async buildHierarchy(
    communities: Map<string, Community>,
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
    adjacency: Map<string, Map<string, number>>,
    resolution: number
  ): Promise<Map<number, Community[]>> {
    const hierarchy = new Map<number, Community[]>();

    // Level 0: leaf communities
    hierarchy.set(0, Array.from(communities.values()));

    // Build higher levels by merging communities
    let currentLevel = 0;
    let currentCommunities = Array.from(communities.values());

    while (currentCommunities.length > 1 && currentLevel < 5) {
      // Create supergraph: communities as nodes
      const superNodes = new Map<string, GraphNode>();
      const superEdges: GraphEdge[] = [];

      for (const community of currentCommunities) {
        superNodes.set(community.id, {
          id: community.id,
          neighbors: new Set(),
        });
      }

      // Add edges between communities
      for (const edge of edges) {
        const fromCommunity = Array.from(communities.entries()).find(([_, c]) =>
          c.nodes.has(edge.from)
        )?.[1];
        const toCommunity = Array.from(communities.entries()).find(([_, c]) =>
          c.nodes.has(edge.to)
        )?.[1];

        if (fromCommunity && toCommunity && fromCommunity.id !== toCommunity.id) {
          const existingEdge = superEdges.find(
            (e) => e.from === fromCommunity.id && e.to === toCommunity.id
          );

          if (existingEdge) {
            existingEdge.weight += edge.weight;
          } else {
            superEdges.push({
              from: fromCommunity.id,
              to: toCommunity.id,
              weight: edge.weight,
            });
          }
        }
      }

      // Cluster supergraph
      const superAdjacency = this.buildAdjacency(superNodes, superEdges);
      let superPartition = new Map<string, string>();
      for (const community of currentCommunities) {
        superPartition.set(community.id, community.id);
      }

      superPartition = await this.localMoving(
        superPartition,
        superNodes,
        superEdges,
        superAdjacency,
        resolution * 0.5 // Lower resolution for higher levels
      );

      // Build next level communities
      const nextLevelCommunities = new Map<string, Community>();
      const superCommunities = new Set(superPartition.values());

      for (const superCommunityId of superCommunities) {
        const memberCommunities = Array.from(superPartition.entries())
          .filter(([_, c]) => c === superCommunityId)
          .map(([commId]) => commId);

        const allNodes = new Set<string>();
        for (const commId of memberCommunities) {
          const comm = currentCommunities.find((c) => c.id === commId);
          if (comm) {
            for (const nodeId of comm.nodes) {
              allNodes.add(nodeId);
            }
          }
        }

        const nextLevelCommunity: Community = {
          id: `level-${currentLevel + 1}-${superCommunityId}`,
          nodes: allNodes,
          level: currentLevel + 1,
          children: memberCommunities,
          properties: {
            size: allNodes.size,
            density: 0, // Simplified
            modularity: 0,
          },
        };

        nextLevelCommunities.set(nextLevelCommunity.id, nextLevelCommunity);
      }

      currentLevel++;
      currentCommunities = Array.from(nextLevelCommunities.values());
      hierarchy.set(currentLevel, currentCommunities);
    }

    return hierarchy;
  }

  /**
   * Shuffle array (Fisher-Yates)
   */
  private shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

export const leidenClustering = new LeidenClustering();
