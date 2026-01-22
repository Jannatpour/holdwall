/**
 * Graph Page Guide
 * Comprehensive guide for the Belief Graph Explorer page
 */

import type { PageGuide } from "./types";

export const graphGuide: PageGuide = {
  pageId: "graph",
  title: "Belief Graph Explorer",
  description: "Explore reinforcement and neutralization paths in the belief graph. Model narrative dynamics with time-decay and actor-weighted belief modeling",
  
  quickStart: [
    {
      id: "graph-quick-1",
      type: "tooltip",
      title: "Welcome to Belief Graph",
      description: "This interactive graph visualizes how beliefs and narratives evolve over time. Nodes represent claims, emotions, and proof points.",
      targetSelector: "[data-guide='graph-header']",
      position: "bottom",
    },
    {
      id: "graph-quick-2",
      type: "tooltip",
      title: "Graph Canvas",
      description: "The main canvas shows nodes (claims/emotions/proof points) and edges (relationships). Click nodes to see details.",
      targetSelector: "[data-guide='graph-canvas']",
      position: "top",
    },
  ],

  sections: [
    {
      id: "graph-basics-section",
      title: "Understanding the Graph",
      description: "Basic concepts and navigation",
      order: 1,
      steps: [
        {
          id: "basics-1",
          type: "modal",
          title: "Belief Graph",
          description: "The belief graph models how narratives evolve through reinforcement and neutralization. Nodes represent claims, emotions, and proof points. Edges show relationships and influence paths.",
          content: "Time-decay modeling means weak narratives lose decisiveness over time, while reinforced narratives grow stronger. Actor weighting accounts for source credibility and influence.",
        },
        {
          id: "basics-2",
          type: "tooltip",
          title: "Node Types",
          description: "Three node types: Claims (narrative statements), Emotions (sentiment/feeling), Proof Points (supporting evidence).",
          targetSelector: "[data-guide='node-types']",
          position: "right",
        },
        {
          id: "basics-3",
          type: "tooltip",
          title: "Edge Types",
          description: "Edges show relationships: reinforces (strengthens), neutralizes (weakens), supports (provides evidence), contradicts (opposes).",
          targetSelector: "[data-guide='edge-types']",
          position: "right",
        },
        {
          id: "basics-4",
          type: "tooltip",
          title: "Navigation",
          description: "Pan: Click and drag. Zoom: Scroll or pinch. Select: Click node. View details: Click node to see inspector panel.",
          targetSelector: "[data-guide='graph-canvas']",
          position: "top",
        },
      ],
    },
    {
      id: "controls-section",
      title: "Graph Controls",
      description: "Using filters and controls",
      order: 2,
      steps: [
        {
          id: "controls-1",
          type: "tooltip",
          title: "Time Range",
          description: "Filter graph by time period: Last 7 Days, 30 Days, 90 Days, or All Time. Shows how graph evolved over time.",
          targetSelector: "[data-guide='time-range']",
          position: "bottom",
        },
        {
          id: "controls-2",
          type: "tooltip",
          title: "Node Type Filters",
          description: "Toggle visibility of Claims, Emotions, and Proof Points. Use to focus on specific node types.",
          targetSelector: "[data-guide='node-filters']",
          position: "bottom",
        },
        {
          id: "controls-3",
          type: "tooltip",
          title: "Time Slider",
          description: "Use the time slider to see graph snapshots at different points in time. Watch how narratives evolve.",
          targetSelector: "[data-guide='time-slider']",
          position: "top",
        },
        {
          id: "controls-4",
          type: "tooltip",
          title: "Recompute",
          description: "Click to recompute the graph with latest data. Useful after new signals or claims are processed.",
          targetSelector: "[data-guide='recompute']",
          position: "left",
        },
      ],
    },
    {
      id: "inspector-section",
      title: "Inspector Panel",
      description: "Viewing node and edge details",
      order: 3,
      steps: [
        {
          id: "inspector-1",
          type: "tooltip",
          title: "Inspector Panel",
          description: "When you select a node or edge, details appear in the inspector panel on the right.",
          targetSelector: "[data-guide='inspector-panel']",
          position: "left",
        },
        {
          id: "inspector-2",
          type: "modal",
          title: "Node Details",
          description: "Node details include: ID, type, text/content, decisiveness score, timestamp, connected nodes, and evidence links.",
          content: "For claim nodes, you'll see verification scores (FactReasoner, VERITAS-NLI). For emotion nodes, you'll see sentiment scores. For proof points, you'll see evidence metadata.",
        },
        {
          id: "inspector-3",
          type: "tooltip",
          title: "Edge Details",
          description: "Edge details show relationship type, strength, direction, and timestamp. Reinforce edges are green, neutralize edges are red.",
          targetSelector: "[data-guide='edge-details']",
          position: "left",
        },
      ],
    },
    {
      id: "paths-section",
      title: "Path Finding",
      description: "Finding paths between nodes",
      order: 4,
      steps: [
        {
          id: "paths-1",
          type: "modal",
          title: "Path Finding",
          description: "Find paths between nodes to understand how narratives propagate. Useful for understanding influence flows and narrative evolution.",
          content: "Paths show sequences of relationships connecting nodes. Shortest paths indicate direct influence, while longer paths show indirect connections.",
        },
        {
          id: "paths-2",
          type: "tooltip",
          title: "Find Path",
          description: "Select two nodes and click 'Find Path' to see connecting paths. Useful for understanding narrative relationships.",
          targetSelector: "[data-guide='find-path']",
          position: "top",
        },
      ],
    },
    {
      id: "snapshots-section",
      title: "Time Snapshots",
      description: "Viewing graph at different time points",
      order: 5,
      steps: [
        {
          id: "snapshot-1",
          type: "tooltip",
          title: "Graph Snapshots",
          description: "View the graph at specific points in time to see how it evolved. Use the time slider or snapshot API.",
          targetSelector: "[data-guide='snapshot-control']",
          position: "top",
        },
        {
          id: "snapshot-2",
          type: "modal",
          title: "Time-Decay Modeling",
          description: "The graph models time-decay: weak narratives lose decisiveness over time, while reinforced narratives grow stronger. Snapshots show this evolution.",
          content: "Use snapshots to understand narrative lifecycle: emergence, growth, peak, and decay. This helps predict future narrative states.",
        },
      ],
    },
  ],

  apiEndpoints: [
    {
      method: "GET",
      path: "/api/graph",
      description: "Get graph data (nodes and edges) with optional filters (range, timestamp, node_id)",
    },
    {
      method: "GET",
      path: "/api/graph/snapshot",
      description: "Get graph snapshot at specific timestamp",
    },
    {
      method: "GET",
      path: "/api/graph/paths",
      description: "Find paths between nodes",
      example: { from: "node-id-1", to: "node-id-2" },
    },
  ],

  features: [
    {
      name: "Interactive Visualization",
      description: "Pan, zoom, and explore the belief graph interactively",
      icon: "Network",
    },
    {
      name: "Time-Decay Modeling",
      description: "Visualize how narratives evolve and decay over time",
      icon: "Clock",
    },
    {
      name: "Path Finding",
      description: "Find paths between nodes to understand narrative propagation",
      icon: "Route",
    },
    {
      name: "Time Snapshots",
      description: "View graph at different points in time",
      icon: "History",
    },
    {
      name: "Node Filtering",
      description: "Filter by node type (claims, emotions, proof points)",
      icon: "Filter",
    },
    {
      name: "Inspector Panel",
      description: "Detailed view of selected nodes and edges",
      icon: "Search",
    },
  ],

  workflow: [
    {
      step: 1,
      title: "Explore Graph",
      description: "Start by exploring the graph canvas. Pan and zoom to understand the structure",
      action: "Navigate graph canvas",
    },
    {
      step: 2,
      title: "Filter Nodes",
      description: "Use filters to focus on specific node types or time ranges",
      action: "Apply filters",
    },
    {
      step: 3,
      title: "Select Nodes",
      description: "Click nodes to view details in the inspector panel",
      action: "Click nodes",
    },
    {
      step: 4,
      title: "Find Paths",
      description: "Select two nodes and find paths to understand relationships",
      action: "Use path finding",
    },
    {
      step: 5,
      title: "View Snapshots",
      description: "Use time slider to see how graph evolved over time",
      action: "Adjust time slider",
    },
  ],
};
